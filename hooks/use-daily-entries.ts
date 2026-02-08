/**
 * React Query hook for fetching daily calorie entries
 * 
 * Query key: ['entries', userId, entryDate]
 * staleTime: 3min, gcTime: 24h, refetchOnWindowFocus: false (per guidelines)
 * 
 * Uses placeholderData to show cached data immediately while fetching fresh data in background.
 * This prevents loading states when navigating between dates that are already cached.
 */

import { useAuth } from '@/contexts/AuthContext';
import { getPersistentCache, setPersistentCache } from '@/lib/persistentCache';
import { getEntriesForDate } from '@/lib/services/calorieEntries';
import { toDateKey } from '@/utils/dateKey';
import type { CalorieEntry, DailyEntriesWithStatus } from '@/utils/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const DAILY_ENTRIES_MAX_AGE_MS = 120 * 24 * 60 * 60 * 1000; // ~180 days

export function useDailyEntries(entryDate: string | Date) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  // Normalize to canonical date key
  const dateKey = toDateKey(entryDate);

  const cacheKey = entriesCacheKey(userId, dateKey);

  // NEW: read persistent snapshot once when hook is created
  const snapshot =
    cacheKey !== null
      ? getPersistentCache<DailyEntriesWithStatus | CalorieEntry[]>(cacheKey, DAILY_ENTRIES_MAX_AGE_MS)
      : null;

  const normalizeEntriesPayload = (
    value: DailyEntriesWithStatus | CalorieEntry[] | null | undefined
  ): DailyEntriesWithStatus | undefined => {
    if (!value) return value ?? undefined;
    if (Array.isArray(value)) return { entries: value, log_status: null };
    return value;
  };

  return useQuery<DailyEntriesWithStatus>({
    queryKey: ['entries', userId, dateKey],
    queryFn: async () => {
      const networkStart = performance.now();
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const data = await getEntriesForDate(userId, dateKey);

      if (cacheKey !== null) {
        setPersistentCache(cacheKey, data);
      }

      // Only log in development mode for slow fetches (>500ms) to help identify performance issues
      if (process.env.NODE_ENV !== 'production') {
        const fetchTime = performance.now() - networkStart;
        if (fetchTime > 500) {
          console.log(
            `[useDailyEntries] slow network fetch for ${cacheKey} returned ${data.length} rows in ${Math.round(fetchTime)}ms`
          );
        }
      }

      return data;
    },
    enabled: !!userId && !!dateKey,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    // UPDATED: use previousData, then in-memory cache, then persistent snapshot
    placeholderData: (previousData) => {
      // 1) If we have previous data from the same query within this runtime, use it
      if (previousData !== undefined) {
        return previousData;
      }

      // 2) Otherwise, check React Query's in-memory cache
      const cachedData = queryClient.getQueryData<DailyEntriesWithStatus | CalorieEntry[]>([
        'entries',
        userId,
        dateKey,
      ]);
      const normalizedCached = normalizeEntriesPayload(cachedData);
      if (normalizedCached !== undefined) {
        return normalizedCached;
      }

      // 3) Finally, fall back to persistent snapshot (survives full reloads)
      return normalizeEntriesPayload(snapshot) ?? undefined;
    },
  });
}

function entriesCacheKey(userId: string | undefined, date: string) {
  if (!userId) return null;
  return `dailyEntries:${userId}:${date}`; // e.g. dailyEntries:abc123:2025-12-09
}