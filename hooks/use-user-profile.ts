/**
 * React Query hook for fetching user profile
 * 
 * Query key: ['userProfile', userId]
 * staleTime: 30min, gcTime: 24h
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
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

