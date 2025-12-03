/**
 * React Query hook for fetching custom foods
 * 
 * Query key: ['customFoods', userId]
 * Heavily cached: staleTime: Infinity, gcTime: 7 days
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
    staleTime: Infinity,
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

