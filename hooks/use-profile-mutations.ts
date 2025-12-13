/**
 * React Query mutations for user profile updates
 * 
 * These mutations update the cache on success to avoid refetching
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/lib/services/profile';
import { syncTodayWaterGoalWithProfile } from '@/lib/services/waterLogs';
import { setPersistentCache } from '@/lib/persistentCache';

/**
 * Hook for updating user profile
 * Updates the cache on success
 * If water_goal_ml is updated, syncs today's water_daily.goal_ml
 */
export function useUpdateProfile() {
  const { user, updateProfileState, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (updates: Partial<any>) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return updateUserProfile(userId, updates);
    },
    onSuccess: async (updatedProfile, variables) => {
      // Update the cache with the new profile data
      if (userId) {
        queryClient.setQueryData(['userProfile', userId], updatedProfile);
        queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
        updateProfileState(updatedProfile);
        setPersistentCache('profile', updatedProfile);
      }

      // If water_goal_ml was updated, sync today's water_daily.goal_ml
      if (variables.water_goal_ml !== undefined) {
        try {
          const syncedWater = await syncTodayWaterGoalWithProfile(userId);
          if (syncedWater) {
            // Invalidate water queries to refresh UI
            queryClient.invalidateQueries({ queryKey: ['waterDaily', userId] });
          }
        } catch (error) {
          // Log error but don't fail the profile update
          console.error('Error syncing today water goal with profile:', error);
        }
      }

      // Ensure auth context is fresh (fallback)
      if (userId) {
        refreshProfile?.();
      }
    },
  });
}

