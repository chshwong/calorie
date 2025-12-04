/**
 * React Query hook for fetching food master metadata by IDs
 * 
 * Query key: ['foodMaster', ...sortedFoodIds]
 * staleTime: Infinity, gcTime: 24h, refetchOnWindowFocus: false
 * 
 * Uses placeholderData to show cached data immediately when the same IDs were already fetched.
 * This prevents loading states when the same food IDs are requested again.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getFoodMasterByIds, type FoodMasterMetadata } from '@/lib/services/foodMaster';

export function useFoodMasterByIds(foodIds: string[]) {
  const queryClient = useQueryClient();
  
  // Sort and deduplicate IDs to create stable query key
  const sortedIds = [...new Set(foodIds)].sort();
  const queryKey = ['foodMaster', ...sortedIds];

  return useQuery<FoodMasterMetadata[]>({
    queryKey,
    queryFn: () => {
      if (sortedIds.length === 0) {
        return [];
      }
      return getFoodMasterByIds(sortedIds);
    },
    enabled: sortedIds.length > 0,
    staleTime: Infinity, // Food master data rarely changes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
    // Use placeholderData to show cached data immediately
    placeholderData: (previousData) => {
      // If we have previous data from the same query, use it
      if (previousData !== undefined) {
        return previousData;
      }
      // Otherwise, check if we have cached data for this exact queryKey
      const cachedData = queryClient.getQueryData<FoodMasterMetadata[]>(queryKey);
      return cachedData;
    },
  });
}

