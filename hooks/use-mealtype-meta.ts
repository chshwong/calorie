/**
 * React Query hook for fetching mealtype meta
 * 
 * Query key: ['mealtypeMeta', userId, entryDate]
 * staleTime: 3min, gcTime: 24h, refetchOnWindowFocus: false (per guidelines)
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getMealtypeMetaByDate, type MealtypeMeta } from '@/lib/services/calories-entries-mealtype-meta';

export interface MealtypeMetaByMealType {
  [mealType: string]: MealtypeMeta | null;
}

export function useMealtypeMeta(entryDate: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const { data: metaArray = [], isLoading, isFetching, refetch } = useQuery<MealtypeMeta[]>({
    queryKey: ['mealtypeMeta', userId, entryDate],
    queryFn: () => {
      if (!userId || !entryDate) {
        return [];
      }
      return getMealtypeMetaByDate(userId, entryDate);
    },
    enabled: !!userId && !!entryDate,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnWindowFocus: false,
  });

  // Convert array to lookup map by meal_type
  const dataByMealType: MealtypeMetaByMealType = {};
  if (metaArray) {
    for (const meta of metaArray) {
      dataByMealType[meta.meal_type] = meta;
    }
  }

  return {
    dataByMealType,
    isLoading,
    isFetching,
    refetch,
  };
}
