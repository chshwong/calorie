/**
 * React Query hook for fetching daily_sum_consumed for a date range (dashboards).
 *
 * IMPORTANT:
 * - Dashboards must fetch by date range (no per-day queries).
 * - Persistent cache TTL: 180 days.
 * - Data should be treated as stale ONLY via explicit invalidation for affected dates.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_CACHE_MAX_AGE_MS, getPersistentCache, setPersistentCache } from '@/lib/persistentCache';
import { getDailySumConsumedForRange } from '@/lib/services/consumed/dailySumConsumed';
import type { DailySumConsumed } from '@/utils/types';

export function dailySumConsumedRangeQueryKey(userId: string | undefined, startDate: string, endDate: string) {
  return ['dailySumConsumedRange', userId, startDate, endDate] as const;
}

export function useDailySumConsumedRange(
  userId: string | undefined,
  startDate: string,
  endDate: string
) {
  const queryClient = useQueryClient();

  const cacheKey = userId ? `dailySumConsumedRange:${userId}:${startDate}:${endDate}` : null;
  const snapshot =
    cacheKey !== null ? getPersistentCache<DailySumConsumed[]>(cacheKey, DEFAULT_CACHE_MAX_AGE_MS) : null;

  return useQuery<DailySumConsumed[]>({
    queryKey: dailySumConsumedRangeQueryKey(userId, startDate, endDate),
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      const rows = await getDailySumConsumedForRange(userId, startDate, endDate);
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

      const cached = queryClient.getQueryData<DailySumConsumed[]>(
        dailySumConsumedRangeQueryKey(userId, startDate, endDate)
      );
      if (cached !== undefined) return cached;

      return snapshot ?? undefined;
    },
  });
}


