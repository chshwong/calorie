/**
 * React Query hook for fetching recent foods
 * 
 * Query key: ['recentFoods', userId, mealType]
 * staleTime: 60s, gcTime: 5min
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
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

