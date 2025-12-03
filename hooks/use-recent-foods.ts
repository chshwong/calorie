/**
 * React Query hook for fetching recent foods
 * 
 * Query key: ['recentFoods', userId, mealType]
 * Heavily cached: staleTime: Infinity, gcTime: 7 days
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchRecentFoods, RecentFood } from '@/lib/services/recentFoods';

export function useRecentFoods(mealType?: string) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<RecentFood[]>({
    queryKey: ['recentFoods', userId, mealType],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return fetchRecentFoods(userId, mealType);
    },
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

