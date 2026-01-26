import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useUserConfig } from '@/hooks/use-user-config';
import { dailySumBurnedQueryKey } from '@/hooks/use-daily-sum-burned';
import { useApplyRawToFinals } from '@/hooks/use-burned-mutations';
import { syncFitbitNow, syncFitbitWeightNow } from '@/lib/services/fitbit/fitbitConnection';

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
};

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

      return { activityOk: true, weightOk, weightErrorCode };
    },
  };
}

