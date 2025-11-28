/**
 * React Query hook for fetching custom foods
 * 
 * Query key: ['customFoods', userId]
 * staleTime: 60s, gcTime: 5min
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCustomFoods, CustomFood } from '@/lib/services/customFoods';

export function useCustomFoods() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<CustomFood[]>({
    queryKey: ['customFoods', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return fetchCustomFoods(userId);
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

