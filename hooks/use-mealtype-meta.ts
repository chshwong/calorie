/**
 * React Query hook for fetching mealtype meta
 * 
 * Query key: ['mealtypeMeta', userId, entryDate]
 * staleTime: 3min, gcTime: 24h, refetchOnWindowFocus: false (per guidelines)
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getMealtypeMetaByDate, type MealtypeMeta } from '@/lib/services/calories-entries-mealtype-meta';
import { getPersistentCache, setPersistentCache, DEFAULT_CACHE_MAX_AGE_MS } from '@/lib/persistentCache';

export interface MealtypeMetaByMealType {
  [mealType: string]: MealtypeMeta | null;
}

export function useMealtypeMeta(entryDate: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  const cacheKey = userId ? `mealtypeMeta:${userId}:${entryDate}` : null;
  const cacheStart = performance.now();
  const snapshot =
    cacheKey !== null
      ? getPersistentCache<MealtypeMeta[]>(cacheKey, DEFAULT_CACHE_MAX_AGE_MS)
      : null;
  if (snapshot) {
    console.log(
      `[useMealtypeMeta] persistent cache hit for ${cacheKey} in ${Math.round(
        performance.now() - cacheStart
      )}ms (count=${snapshot.length})`
    );
  } else if (cacheKey) {
    console.log(
      `[useMealtypeMeta] persistent cache miss for ${cacheKey} (took ${Math.round(
        performance.now() - cacheStart
      )}ms)`
    );
  }

  const { data: metaArray = [], isLoading, isFetching, refetch } = useQuery<MealtypeMeta[]>({
    queryKey: ['mealtypeMeta', userId, entryDate],
    queryFn: () => {
      const networkStart = performance.now();
      if (!userId || !entryDate) {
        return [];
      }
      return getMealtypeMetaByDate(userId, entryDate).then((result) => {
        if (cacheKey) {
          setPersistentCache(cacheKey, result);
        }
        console.log(
          `[useMealtypeMeta] network fetch for ${cacheKey} returned ${result.length} rows in ${Math.round(
            performance.now() - networkStart
          )}ms`
        );
        return result;
      });
    },
    enabled: !!userId && !!entryDate,
    staleTime: 10 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previous) => {
      if (previous !== undefined) return previous;
      const cached = queryClient.getQueryData<MealtypeMeta[]>(['mealtypeMeta', userId, entryDate]);
      if (cached) return cached;
      return snapshot ?? undefined;
    },
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
