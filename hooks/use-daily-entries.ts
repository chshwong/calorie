/**
 * React Query hook for fetching daily calorie entries
 * 
 * Query key: ['entries', userId, entryDate]
 * staleTime: 3min, gcTime: 24h, refetchOnWindowFocus: true
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getEntriesForDate } from '@/lib/services/calorieEntries';
import type { CalorieEntry } from '@/utils/types';

export function useDailyEntries(entryDate: string) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<CalorieEntry[]>({
    queryKey: ['entries', userId, entryDate],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return getEntriesForDate(userId, entryDate);
    },
    enabled: !!userId && !!entryDate,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: true,
  });
}

