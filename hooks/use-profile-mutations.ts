/**
 * React Query mutations for user profile updates
 * 
 * These mutations update the cache on success to avoid refetching
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/lib/services/profile';
import { syncTodayWaterGoalWithProfile } from '@/lib/services/waterLogs';
import { refreshBurnedTodayFromProfileChange } from '@/lib/services/burned/refreshDailySumBurned';
import { setPersistentCache } from '@/lib/persistentCache';
import { userConfigQueryKey } from '@/hooks/use-user-config';
import type { UserConfig } from '@/lib/services/userConfig';

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
        // Update userConfig cache (preserve email from existing cache)
        const existingUserConfig = queryClient.getQueryData<UserConfig | null>(userConfigQueryKey(userId));
        const updatedUserConfig: UserConfig = {
          ...updatedProfile,
          email: existingUserConfig?.email ?? null, // Preserve email from auth
        };
        queryClient.setQueryData(userConfigQueryKey(userId), updatedUserConfig);
        queryClient.invalidateQueries({ queryKey: userConfigQueryKey(userId) });
        
        // Also update old userProfile key for backward compatibility (can remove later)
        queryClient.setQueryData(['userProfile', userId], updatedProfile);
        queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
        
        updateProfileState(updatedProfile);
        setPersistentCache('profile', updatedProfile);
      }

      // If TDEE inputs changed, refresh today's burned row (existing row only; best-effort).
      // Height/activity/gender/dob are not backdated, so today-only is sufficient.
      if (
        userId &&
        (variables.activity_level !== undefined ||
          variables.height_cm !== undefined ||
          variables.gender !== undefined ||
          variables.date_of_birth !== undefined)
      ) {
        try {
          await refreshBurnedTodayFromProfileChange(userId);
          queryClient.invalidateQueries({ queryKey: ['dailySumBurned', userId] });
          queryClient.invalidateQueries({ queryKey: ['dailySumBurnedRange', userId] });
        } catch (e) {
          if (process.env.NODE_ENV !== 'production') {
            console.error('Error refreshing daily_sum_burned after profile change', e);
          }
        }
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
          if (process.env.NODE_ENV !== 'production') {
            console.error('Error syncing today water goal with profile:', error);
          }
        }
      }

      // Ensure auth context is fresh (fallback)
      if (userId) {
        refreshProfile?.();
      }
    },
  });
}

