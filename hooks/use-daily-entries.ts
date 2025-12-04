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

export function useDailyEntries(entryDate: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useQuery<CalorieEntry[]>({
    queryKey: ['entries', userId, entryDate],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return getEntriesForDate(userId, entryDate);
    },
    enabled: !!userId && !!entryDate,
    staleTime: 3 * 60 * 1000, // 3 minutes (per engineering guidelines: at least 60 seconds)
    gcTime: 24 * 60 * 60 * 1000, // 24 hours (per engineering guidelines: at least 5 minutes)
    refetchOnWindowFocus: false, // Per engineering guidelines 4.1: stale-while-revalidate behavior
    // Use placeholderData to show cached data immediately - check cache for same queryKey
    placeholderData: (previousData) => {
      // If we have previous data from the same query, use it
      if (previousData !== undefined) {
        return previousData;
      }
      // Otherwise, check if we have cached data for this exact queryKey
      const cachedData = queryClient.getQueryData<CalorieEntry[]>(['entries', userId, entryDate]);
      return cachedData;
    },
  });
}

