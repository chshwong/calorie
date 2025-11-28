/**
 * React Query hook for fetching frequent foods
 * 
 * Query key: ['frequentFoods', userId, mealType]
 * staleTime: 60s, gcTime: 5min
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
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

