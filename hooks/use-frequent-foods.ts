/**
 * React Query hook for fetching frequent foods
 * 
 * Query key: ['frequentFoods', userId, mealType]
 * Heavily cached: staleTime: Infinity, gcTime: 7 days
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchFrequentFoods, FrequentFood } from '@/lib/services/frequentFoods';

export function useFrequentFoods(mealType?: string) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<FrequentFood[]>({
    queryKey: ['frequentFoods', userId, mealType],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return fetchFrequentFoods(userId, mealType);
    },
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

