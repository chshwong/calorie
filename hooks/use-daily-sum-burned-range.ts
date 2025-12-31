import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { DailySumBurned } from '@/utils/types';
import { getDailySumBurnedForRange } from '@/lib/services/burned/dailySumBurned';

export function useDailySumBurnedRange(params: { startDate: string; endDate: string }) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<DailySumBurned[]>({
    queryKey: ['dailySumBurnedRange', userId, params.startDate, params.endDate],
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return getDailySumBurnedForRange(userId, params.startDate, params.endDate);
    },
    enabled: !!userId && !!params.startDate && !!params.endDate,
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}


