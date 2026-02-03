import { showAppToast } from '@/components/ui/app-toast';
import { useAuth } from '@/contexts/AuthContext';
import { dailySumBurnedQueryKey } from '@/hooks/use-daily-sum-burned';
import { dailySumExercisesStepsKey } from '@/hooks/use-daily-sum-exercises';
import { useUserConfig } from '@/hooks/use-user-config';
import { isWearableCaloriesEnabled } from '@/lib/domain/fitbit/isWearableCaloriesEnabled';
import { syncFitbitNow, syncFitbitStepsNow, syncFitbitWeightNow } from '@/lib/services/fitbit/fitbitConnection';
import { getTodayKey } from '@/utils/dateKey';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { data: userConfig } = useUserConfig();

  const activitySyncOn = isWearableCaloriesEnabled(userConfig);
  const weightProvider = userConfig?.weight_sync_provider === 'fitbit' ? 'fitbit' : 'none';
  const stepsSyncOn = userConfig?.exercise_sync_steps === true;

  return {
    weightProvider,
    async syncFitbitAllNow(params: Params): Promise<FitbitOrchestratorResult> {
      if (!userId) throw new Error('UNAUTHORIZED');

      const dateKey = params.dateKey;
      const includeBurnApply = Boolean(params.includeBurnApply);
      if (includeBurnApply && !dateKey) throw new Error('MISSING_DATEKEY');

      // 1) Sync burned calories only when opted-in (default on).
      let syncedBurnDates: string[] | null = null;
      let skippedMissingRowDates: string[] | null = null;
      if (activitySyncOn) {
        const result = await syncFitbitNow();
        const synced = result.synced_dates;
        syncedBurnDates = Array.isArray(synced) ? synced.filter((d): d is string => typeof d === 'string') : null;

        const skipped = (result as any)?.skipped_missing_row;
        const skippedLegacy = (result as any)?.skipped_missing_daily_row_dates;
        const list = Array.isArray(skipped)
          ? skipped
          : Array.isArray(skippedLegacy)
            ? skippedLegacy
            : [];
        skippedMissingRowDates = list.filter((d: unknown): d is string => typeof d === 'string');
        const todayKey = getTodayKey();
        if (skippedMissingRowDates.includes(todayKey)) {
          showAppToast(t('burned.fitbit.toast.burned_row_needed'));
        }
      }

      // Edge functions write authoritative burned values directly; no client-side apply step needed.
      const burnDatesToInvalidate =
        activitySyncOn && (syncedBurnDates?.length || dateKey)
          ? syncedBurnDates?.length
            ? syncedBurnDates
            : dateKey
              ? [dateKey]
              : []
          : [];

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
      if (burnDatesToInvalidate.length) {
        for (const d of burnDatesToInvalidate) {
          const key = dailySumBurnedQueryKey(userId, d);
          queryClient.invalidateQueries({ queryKey: key });
          // Ensure the currently viewed day updates immediately.
          if (d === dateKey) {
            queryClient.refetchQueries({ queryKey: key, type: 'active' });
          }
        }
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

