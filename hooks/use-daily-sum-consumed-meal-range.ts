/**
 * React Query hook for fetching daily_sum_consumed_meal for a date range (dashboards).
 *
 * IMPORTANT:
 * - Dashboards must fetch by date range (no per-day queries).
 * - Persistent cache TTL: 180 days.
 * - Data should be treated as stale ONLY via explicit invalidation for affected dates.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_CACHE_MAX_AGE_MS, getPersistentCache, setPersistentCache } from '@/lib/persistentCache';
import { getDailySumConsumedMealForRange } from '@/lib/services/consumed/dailySumConsumed';
import type { DailySumConsumedMealRow } from '@/utils/types';

export function dailySumConsumedMealRangeQueryKey(
  userId: string | undefined,
  startDate: string,
  endDate: string
) {
  return ['dailySumConsumedMealRange', userId, startDate, endDate] as const;
}

export function useDailySumConsumedMealRange(
  userId: string | undefined,
  startDate: string,
  endDate: string
) {
  const queryClient = useQueryClient();

  const cacheKey = userId ? `dailySumConsumedMealRange:${userId}:${startDate}:${endDate}` : null;
  const snapshot =
    cacheKey !== null
      ? getPersistentCache<DailySumConsumedMealRow[]>(cacheKey, DEFAULT_CACHE_MAX_AGE_MS)
      : null;

  return useQuery<DailySumConsumedMealRow[]>({
    queryKey: dailySumConsumedMealRangeQueryKey(userId, startDate, endDate),
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      const rows = await getDailySumConsumedMealForRange(userId, startDate, endDate);
      if (cacheKey !== null) {
        setPersistentCache(cacheKey, rows);
      }
      return rows;
    },
    enabled: !!userId && !!startDate && !!endDate,
    staleTime: Infinity,
    gcTime: DEFAULT_CACHE_MAX_AGE_MS,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => {
      if (previousData !== undefined) return previousData;

      const cached = queryClient.getQueryData<DailySumConsumedMealRow[]>(
        dailySumConsumedMealRangeQueryKey(userId, startDate, endDate)
      );
      if (cached !== undefined) return cached;

      return snapshot ?? undefined;
    },
  });
}

