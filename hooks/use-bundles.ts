/**
 * React Query hook for fetching bundles
 * 
 * Query key: ['bundles', userId]
 * Heavily cached: staleTime: Infinity, gcTime: 7 days
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchBundles, Bundle } from '@/lib/services/bundles';

export function useBundles() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<Bundle[]>({
    queryKey: ['bundles', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return fetchBundles(userId);
    },
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

