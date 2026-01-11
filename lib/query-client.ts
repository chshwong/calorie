/**
 * QueryClient singleton
 * 
 * Separated from app/_layout to avoid circular dependencies with AuthContext
 */

import { QueryClient } from '@tanstack/react-query';

// Create QueryClient with sensible defaults
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 180 * 24 * 60 * 60 * 1000, // 180 days
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true, // Enable refetch on reconnect for automatic recovery
      refetchOnMount: false,
    },
    mutations: {
      // Removed console logs - no mutation logging in production or development
    },
  },
});

