/**
 * React Query hook for fetching daily calorie entries
 * 
 * Query key: ['entries', userId, entryDate]
 * staleTime: 3min, gcTime: 24h, refetchOnWindowFocus: false (per guidelines)
 * 
 * Uses placeholderData to show cached data immediately while fetching fresh data in background.
 * This prevents loading states when navigating between dates that are already cached.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getEntriesForDate } from '@/lib/services/calorieEntries';
import type { CalorieEntry } from '@/utils/types';
import { getPersistentCache, setPersistentCache } from '@/lib/persistentCache';

const DAILY_ENTRIES_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // ~180 days

export function useDailyEntries(entryDate: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const cacheKey = entriesCacheKey(userId, entryDate);

  // NEW: read persistent snapshot once when hook is created
  const snapshot =
    cacheKey !== null
      ? getPersistentCache<CalorieEntry[]>(cacheKey, DAILY_ENTRIES_MAX_AGE_MS)
      : null;

  return useQuery<CalorieEntry[]>({
    queryKey: ['entries', userId, entryDate],
    // CHANGED: make queryFn async and write to persistent cache on success
    queryFn: async () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const data = await getEntriesForDate(userId, entryDate);

      if (cacheKey !== null) {
        setPersistentCache(cacheKey, data);
      }

      return data;
    },
    enabled: !!userId && !!entryDate,
    staleTime: 3 * 60 * 1000, // 3 minutes (per engineering guidelines)
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    // UPDATED: use previousData, then in-memory cache, then persistent snapshot
    placeholderData: (previousData) => {
      // 1) If we have previous data from the same query within this runtime, use it
      if (previousData !== undefined) {
        return previousData;
      }

      // 2) Otherwise, check React Query's in-memory cache
      const cachedData = queryClient.getQueryData<CalorieEntry[]>([
        'entries',
        userId,
        entryDate,
      ]);
      if (cachedData !== undefined) {
        return cachedData;
      }

      // 3) Finally, fall back to persistent snapshot (survives full reloads)
      return snapshot ?? undefined;
    },
  });
}

function entriesCacheKey(userId: string | undefined, date: string) {
  if (!userId) return null;
  return `dailyEntries:${userId}:${date}`; // e.g. dailyEntries:abc123:2025-12-09
}