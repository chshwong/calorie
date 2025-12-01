/**
 * Hook for managing med preferences (section order, hide empty sections)
 * 
 * Uses React Query to fetch and update med_prefs from user profile
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getUserProfile, updateUserProfile } from '@/lib/services/profile';

export type MedPreferences = {
  primarySection?: 'med' | 'supp';
  hideMedWhenEmpty?: boolean;
  hideSuppWhenEmpty?: boolean;
  collapsedMedSection?: boolean;
  collapsedSuppSection?: boolean;
};

const DEFAULT_PREFS: MedPreferences = {
  primarySection: 'med',
  hideMedWhenEmpty: false,
  hideSuppWhenEmpty: false,
  collapsedMedSection: false, // Default to expanded
  collapsedSuppSection: false, // Default to expanded
};

/**
 * Get med preferences from user profile
 */
export function useMedPreferences() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<MedPreferences>({
    queryKey: ['medPreferences', userId],
    queryFn: async () => {
      if (!userId) {
        return DEFAULT_PREFS;
      }
      const profile = await getUserProfile(userId);
      const prefs = profile?.med_prefs || {};
      return {
        ...DEFAULT_PREFS,
        ...prefs,
      };
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to update med preferences
 */
export function useUpdateMedPreferences() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (updates: Partial<MedPreferences>) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      // Get current profile
      const profile = await getUserProfile(userId);
      const currentPrefs = profile?.med_prefs || {};
      
      // Merge updates
      const newPrefs = {
        ...DEFAULT_PREFS,
        ...currentPrefs,
        ...updates,
      };
      
      // Update profile
      await updateUserProfile(userId, { med_prefs: newPrefs });
      return newPrefs;
    },
    onSuccess: () => {
      // Invalidate preferences query
      queryClient.invalidateQueries({ queryKey: ['medPreferences', userId] });
      // Also invalidate profile query
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
    },
  });
}



