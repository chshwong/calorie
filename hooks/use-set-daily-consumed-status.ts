/**
 * React Query mutation hook for setting daily food-log status (unknown/completed/fasted).
 *
 * On success, invalidates only affected dailySumConsumedRange queries that include the date.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { DailyLogStatus, DailySumConsumed } from '@/utils/types';
import { setDailyConsumedStatus } from '@/lib/services/consumed/dailySumConsumed';
import { invalidateDailySumConsumedRangesForDate } from '@/lib/services/consumed/invalidateDailySumConsumedRanges';
import { dailySumConsumedRangeQueryKey } from '@/hooks/use-daily-sum-consumed-range';
import { buildOptimisticDailySumConsumedRow } from '@/lib/services/consumed/optimisticDailySumConsumed';

export function useSetDailyConsumedStatus() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async (vars: { entryDate: string; status: DailyLogStatus }) => {
      if (!userId) return {};

      const key = dailySumConsumedRangeQueryKey(userId, vars.entryDate, vars.entryDate);
      const previous = queryClient.getQueryData<DailySumConsumed[]>(key);

      const nowIso = new Date().toISOString();
      const nextRow = buildOptimisticDailySumConsumedRow({
        userId,
        entryDate: vars.entryDate,
        status: vars.status,
        nowIso,
        previous: previous?.[0] ?? null,
      });

      queryClient.setQueryData<DailySumConsumed[]>(key, [nextRow]);

      return { previous, key };
    },
    mutationFn: async (params: { entryDate: string; status: DailyLogStatus }) => {
      const ok = await setDailyConsumedStatus(params);
      if (!ok) throw new Error('Failed to set daily consumed status');
      return params;
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.key) {
        queryClient.setQueryData(ctx.key, ctx.previous);
      }
    },
    onSuccess: (vars) => {
      invalidateDailySumConsumedRangesForDate(queryClient, userId, vars.entryDate);
    },
  });
}


