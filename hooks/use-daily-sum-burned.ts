/**
 * React Query hook for fetching (and lazily creating) daily_sum_burned.
 *
 * Query key: ['dailySumBurned', userId, entryDate]
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toDateKey } from '@/utils/dateKey';
import type { DailySumBurned } from '@/utils/types';
import { getOrCreateDailySumBurned } from '@/lib/services/burned/getOrCreateDailySumBurned';
import { getPersistentCache, setPersistentCache } from '@/lib/persistentCache';

const DAILY_BURNED_MAX_AGE_MS = 120 * 24 * 60 * 60 * 1000; // ~180 days

export const dailySumBurnedQueryKey = (userId: string, dateKey: string) => ['dailySumBurned', userId, dateKey];

export function useDailySumBurned(entryDate: string | Date, opts?: { enabled?: boolean }) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const dateKey = toDateKey(entryDate);
  const enabled = (opts?.enabled ?? true) && !!userId && !!dateKey;

  const cacheKey = burnedCacheKey(userId, dateKey);
  const snapshot =
    cacheKey !== null ? getPersistentCache<DailySumBurned | null>(cacheKey, DAILY_BURNED_MAX_AGE_MS) : null;

  return useQuery<DailySumBurned | null>({
    queryKey: dailySumBurnedQueryKey(userId, dateKey),
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      const row = await getOrCreateDailySumBurned(userId, dateKey);
      if (cacheKey !== null) {
        setPersistentCache(cacheKey, row);
      }
      return row;
    },
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => {
      if (previousData !== undefined) return previousData;

      const cached = queryClient.getQueryData<DailySumBurned | null>(dailySumBurnedQueryKey(userId, dateKey));
      if (cached !== undefined) return cached;

      return snapshot ?? undefined;
    },
  });
}

function burnedCacheKey(userId: string | undefined, date: string) {
  if (!userId) return null;
  return `dailySumBurned:${userId}:${date}`;
}


