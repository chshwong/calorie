/**
 * Prefetch user config utility
 * 
 * Separated from use-user-config to avoid circular dependency with AuthContext
 */

import { QueryClient } from '@tanstack/react-query';
import { getUserConfig } from '@/lib/services/userConfig';
import { setPersistentCache } from '@/lib/persistentCache';

/**
 * Prefetch user config (call this when auth is ready)
 * 
 * IMPORTANT: Writes to persistent cache with key `userConfig:${userId}` 
 * to ensure StartupGate can read it instantly on refresh.
 */
export function prefetchUserConfig(
  queryClient: QueryClient,
  userId: string
): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: ['userConfig', userId],
    queryFn: async () => {
      const data = await getUserConfig(userId);
      
      // Write to persistent cache immediately with exact key StartupGate reads
      // This ensures instant hydration on refresh without network wait
      if (data) {
        setPersistentCache(`userConfig:${userId}`, data);
      }
      
      return data;
    },
    staleTime: 24 * 60 * 60 * 1000, // 24 hours
    gcTime: 180 * 24 * 60 * 60 * 1000, // 180 days
  });
}

