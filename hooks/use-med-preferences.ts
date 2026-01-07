/**
 * Hook for managing med preferences (section order, hide empty sections, collapsed state)
 * 
 * Uses local persistent cache only (not stored in database)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getPersistentCache, setPersistentCache, DEFAULT_CACHE_MAX_AGE_MS } from '@/lib/persistentCache';

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
 * Get cache key for med preferences
 */
function medPreferencesCacheKey(userId: string | undefined): string | null {
  if (!userId) return null;
  return `medPreferences:${userId}`;
}

/**
 * Get med preferences from local persistent cache
 */
export function useMedPreferences() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const cacheKey = medPreferencesCacheKey(userId);

  // Persistent snapshot (survives full reloads)
  const snapshot =
    cacheKey !== null
      ? getPersistentCache<MedPreferences>(cacheKey, DEFAULT_CACHE_MAX_AGE_MS)
      : null;

  return useQuery<MedPreferences>({
    queryKey: ['medPreferences', userId],
    queryFn: async () => {
      if (!userId) {
        return DEFAULT_PREFS;
      }

      // Read from persistent cache
      const cachedPrefs = cacheKey !== null
        ? getPersistentCache<MedPreferences>(cacheKey, DEFAULT_CACHE_MAX_AGE_MS)
        : null;

      const prefs = cachedPrefs || {};
      const mergedPrefs = {
        ...DEFAULT_PREFS,
        ...prefs,
      };

      // Write back to cache to ensure it's saved
      if (cacheKey !== null) {
        setPersistentCache(cacheKey, mergedPrefs);
      }

      return mergedPrefs;
    },
    enabled: !!userId,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours

    // Priority: previousData → in-memory cache → persistent snapshot
    placeholderData: (previousData) => {
      if (previousData !== undefined) {
        return previousData;
      }

      const cachedData = queryClient.getQueryData<MedPreferences>([
        'medPreferences',
        userId,
      ]);
      if (cachedData !== undefined) {
        return cachedData;
      }

      return snapshot ?? DEFAULT_PREFS;
    },
  });
}

/**
 * Hook to update med preferences (local cache only)
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

      const cacheKey = medPreferencesCacheKey(userId);
      if (!cacheKey) {
        throw new Error('Invalid cache key');
      }

      // Get current preferences from cache
      const currentPrefs = getPersistentCache<MedPreferences>(
        cacheKey,
        DEFAULT_CACHE_MAX_AGE_MS
      ) || {};

      // Merge updates
      const newPrefs = {
        ...DEFAULT_PREFS,
        ...currentPrefs,
        ...updates,
      };

      // Save to persistent cache
      setPersistentCache(cacheKey, newPrefs);

      return newPrefs;
    },
    onSuccess: () => {
      // Invalidate preferences query to trigger re-fetch
      queryClient.invalidateQueries({ queryKey: ['medPreferences', userId] });
    },
  });
}



