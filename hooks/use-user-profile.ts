import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile } from '@/lib/services/profile';

/**
 * React Query hook for fetching user profile
 * Uses placeholderData so cached data appears instantly on refresh.
 */
export function useUserProfile() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['userProfile', userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return getUserProfile(userId);
    },
    staleTime: 30 * 60 * 1000, // 30 min
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,

    // Show cached profile instantly
    placeholderData: (previousData) => {
      if (previousData !== undefined) return previousData;
      return queryClient.getQueryData(['userProfile', userId]);
    },
  });
}

