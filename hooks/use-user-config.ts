/**
 * Canonical React Query hook for user configuration
 * 
 * This hook fetches ALL user configuration data needed for:
 * - Identity (name, email)
 * - Preferences (units, language)
 * - Goals/Targets (calories, macros, fiber, sodium, sugar, weight goals)
 * - Activity/TDEE inputs
 * - Focus modules
 * 
 * This is the SINGLE SOURCE OF TRUTH for all profile-derived data.
 * All components should use this hook instead of:
 * - useUserProfile
 * - Direct profile reads from AuthContext
 * - Multiple separate queries for goals/targets
 * 
 * Query key: ['userConfig', userId]
 * staleTime: 24 hours (prevents immediate refetch on every mount)
 * gcTime: 180 days (ensures persistent cache)
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getUserConfig, type UserConfig } from '@/lib/services/userConfig';
import { getPersistentCache, setPersistentCache, DEFAULT_CACHE_MAX_AGE_MS } from '@/lib/persistentCache';

/**
 * Query key factory for userConfig
 */
export function userConfigQueryKey(userId: string | null): readonly ['userConfig', string | null] {
  return ['userConfig', userId] as const;
}

/**
 * @deprecated Use prefetchUserConfig from '@/lib/prefetch-user-config' instead
 * This export is kept for backwards compatibility but will be removed
 */
export function prefetchUserConfig(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string
): Promise<void> {
  // Re-export from the separate module to avoid circular dependency
  const { prefetchUserConfig: prefetch } = require('@/lib/prefetch-user-config');
  return prefetch(queryClient, userId);
}

/**
 * Canonical hook for user configuration
 * 
 * Returns all user config data including:
 * - Identity (name, email, avatar)
 * - Preferences (units, language)
 * - Goals/Targets (calories, macros, fiber, sodium, sugar, weight goals)
 * - Activity/TDEE inputs
 * - Focus modules
 * 
 * @returns Query result with UserConfig data
 */
export function useUserConfig() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const cacheKey = userConfigCacheKey(userId);

  // Persistent snapshot (survives full reloads)
  const snapshot =
    cacheKey !== null
      ? getPersistentCache<UserConfig | null>(cacheKey, DEFAULT_CACHE_MAX_AGE_MS)
      : null;

  return useQuery({
    queryKey: userConfigQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      const data = await getUserConfig(userId);

      // Write to persistent cache on success
      if (cacheKey !== null) {
        setPersistentCache(cacheKey, data);
      }

      return data;
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - prevents immediate refetch on every mount
    gcTime: 180 * 24 * 60 * 60 * 1000, // 180 days - ensures persistent cache
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false, // Don't refetch if cached data exists

    // Priority: previousData → in-memory cache → persistent snapshot
    placeholderData: (previousData) => {
      if (previousData !== undefined) return previousData;

      const cachedData = queryClient.getQueryData<UserConfig | null>(userConfigQueryKey(userId));
      if (cachedData !== undefined) return cachedData;

      return snapshot ?? undefined;
    },
  });
}

function userConfigCacheKey(userId: string | null): string | null {
  if (!userId) return null;
  return `userConfig:${userId}`;
}

