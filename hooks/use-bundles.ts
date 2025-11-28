/**
 * React Query hook for fetching bundles
 * 
 * Query key: ['bundles', userId]
 * staleTime: 60s, gcTime: 5min
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
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

