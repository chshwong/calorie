import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserConfig } from '@/hooks/use-user-config';
import { dailySumBurnedQueryKey } from '@/hooks/use-daily-sum-burned';
import { dailySumExercisesStepsKey } from '@/hooks/use-daily-sum-exercises';
import { useApplyRawToFinals } from '@/hooks/use-burned-mutations';
import { syncFitbitNow, syncFitbitStepsNow, syncFitbitWeightNow } from '@/lib/services/fitbit/fitbitConnection';

type Params = {
  /** YYYY-MM-DD */
  dateKey?: string;
  includeBurnApply?: boolean;
};

export type FitbitOrchestratorResult = {
  /** Activity sync succeeded (and apply succeeded if includeBurnApply=true). */
  activityOk: true;
  /** Weight sync ran and succeeded (only when opted-in). */
  weightOk: boolean | null;
  /** If weight sync failed (non-fatal), normalized error code. */
  weightErrorCode: string | null;
  /** Steps sync ran and succeeded (only when exercise_sync_steps is on). */
  stepsOk: boolean | null;
  /** If steps sync failed (non-fatal), normalized error code. */
  stepsErrorCode: string | null;
};

function getLast7LocalDateKeys(): string[] {
  const keys: string[] = [];
  const d = new Date();
  for (let i = 0; i < 7; i++) {
    const x = new Date(d.getTime());
    x.setDate(x.getDate() - i);
    keys.push(
      `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`,
    );
  }
  return keys;
}

function errCode(e: unknown): string {
  return String((e as any)?.message ?? 'UNKNOWN');
}

export function useFitbitSyncOrchestrator() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: userConfig } = useUserConfig();
  const applyRawMutation = useApplyRawToFinals();

  const weightProvider = userConfig?.weight_sync_provider === 'fitbit' ? 'fitbit' : 'none';
  const stepsSyncOn = userConfig?.exercise_sync_steps === true;

  return {
    weightProvider,
    async syncFitbitAllNow(params: Params): Promise<FitbitOrchestratorResult> {
      if (!userId) throw new Error('UNAUTHORIZED');

      const dateKey = params.dateKey;
      const includeBurnApply = Boolean(params.includeBurnApply);
      if (includeBurnApply && !dateKey) throw new Error('MISSING_DATEKEY');

      // 1) Always sync activity first.
      await syncFitbitNow();

      // 2) Optional burned apply.
      if (includeBurnApply && dateKey) {
        await applyRawMutation.mutateAsync({ entryDate: dateKey });
      }

      // 3) Optional weight sync (non-fatal failures).
      let weightOk: boolean | null = null;
      let weightErrorCode: string | null = null;
      if (weightProvider === 'fitbit') {
        try {
          await syncFitbitWeightNow();
          weightOk = true;
        } catch (e) {
          weightOk = false;
          weightErrorCode = errCode(e);
        }
      }

      // 4) Optional steps sync (non-fatal failures).
      let stepsOk: boolean | null = null;
      let stepsErrorCode: string | null = null;
      let syncedStepsDates: string[] | null = null;
      if (stepsSyncOn) {
        try {
          const result = await syncFitbitStepsNow();
          stepsOk = true;
          syncedStepsDates = result.synced_dates ?? null;
        } catch (e) {
          stepsOk = false;
          stepsErrorCode = errCode(e);
        }
      }

      // Cache invalidation (best-effort, non-blocking).
      queryClient.invalidateQueries({ queryKey: ['fitbitConnectionPublic', userId] });
      if (includeBurnApply && dateKey) {
        const key = dailySumBurnedQueryKey(userId, dateKey);
        queryClient.invalidateQueries({ queryKey: key });
        queryClient.refetchQueries({ queryKey: key, type: 'active' });
      }
      if (weightProvider === 'fitbit') {
        queryClient.invalidateQueries({ queryKey: ['weightLogs366d', userId] });
        queryClient.invalidateQueries({ queryKey: ['weightLogs', userId] });
        queryClient.invalidateQueries({ queryKey: ['weightLogs', userId, 'earliest'] });
      }
      if (stepsOk === true && userId) {
        const datesToInvalidate = syncedStepsDates?.length
          ? syncedStepsDates
          : getLast7LocalDateKeys();
        for (const date of datesToInvalidate) {
          queryClient.invalidateQueries({ queryKey: dailySumExercisesStepsKey(userId, date) });
        }
      }

      return { activityOk: true, weightOk, weightErrorCode, stepsOk, stepsErrorCode };
    },
  };
}

