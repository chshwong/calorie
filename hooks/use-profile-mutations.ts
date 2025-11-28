/**
 * React Query mutations for user profile updates
 * 
 * These mutations update the cache on success to avoid refetching
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/lib/services/profile';

/**
 * Hook for updating user profile
 * Updates the cache on success
 */
export function useUpdateProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (updates: Partial<any>) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return updateUserProfile(userId, updates);
    },
    onSuccess: (updatedProfile) => {
      // Update the cache with the new profile data
      if (userId) {
        queryClient.setQueryData(['userProfile', userId], updatedProfile);
      }
    },
  });
}

