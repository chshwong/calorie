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

/**
 * Query key factory for userConfig
 */
export function userConfigQueryKey(userId: string | null): readonly ['userConfig', string | null] {
  return ['userConfig', userId] as const;
}

/**
 * Prefetch user config (call this when auth is ready)
 */
export function prefetchUserConfig(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: userConfigQueryKey(userId),
    queryFn: () => getUserConfig(userId),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 180 * 24 * 60 * 60 * 1000, // 180 days
  });
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

  return useQuery({
    queryKey: userConfigQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return getUserConfig(userId);
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - prevents immediate refetch on every mount
    gcTime: 180 * 24 * 60 * 60 * 1000, // 180 days - ensures persistent cache
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false, // Don't refetch if cached data exists

    // Show cached data instantly
    placeholderData: (previousData) => {
      if (previousData !== undefined) return previousData;
      return queryClient.getQueryData<UserConfig | null>(userConfigQueryKey(userId));
    },
  });
}

