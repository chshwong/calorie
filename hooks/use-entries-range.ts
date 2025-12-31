import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getEntriesForDateRange } from '@/lib/services/calorieEntries';
import type { CalorieEntry } from '@/utils/types';

export function useEntriesRange(params: { startDate: string; endDate: string }) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<CalorieEntry[]>({
    queryKey: ['entriesRange', userId, params.startDate, params.endDate],
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return getEntriesForDateRange(userId, params.startDate, params.endDate);
    },
    enabled: !!userId && !!params.startDate && !!params.endDate,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}


