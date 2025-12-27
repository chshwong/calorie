/**
 * Prefetch user config utility
 * 
 * Separated from use-user-config to avoid circular dependency with AuthContext
 */

import { QueryClient } from '@tanstack/react-query';
import { getUserConfig } from '@/lib/services/userConfig';

/**
 * Prefetch user config (call this when auth is ready)
 */
export function prefetchUserConfig(
  queryClient: QueryClient,
  userId: string
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: ['userConfig', userId],
    queryFn: () => getUserConfig(userId),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 180 * 24 * 60 * 60 * 1000, // 180 days
  });
}

