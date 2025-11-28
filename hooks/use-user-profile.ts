/**
 * React Query hook for fetching user profile
 * 
 * Query key: ['userProfile', userId]
 * staleTime: 60s, gcTime: 5min
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile } from '@/lib/services/profile';

export function useUserProfile() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return getUserProfile(userId);
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

