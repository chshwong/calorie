/**
 * React Query hooks for fetching water logs
 * 
 * Query keys:
 * - ['waterDaily', userId, startDate, endDate]
 * - ['waterDaily', userId, date]
 * 
 * staleTime: 60s, gcTime: 5min
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  getWaterDailyForDate,
  getWaterDailyForDateRange,
  getOrCreateWaterDailyForDate,
  addWater,
  setWaterGoal,
  updateWaterTotal,
  updateWaterUnitAndGoal,
  syncTodayWaterWithProfile,
  type WaterDaily,
} from '@/lib/services/waterLogs';
import { WaterUnit, toMl, fromMl } from '@/utils/waterUnits';
import { getPersistentCache, setPersistentCache, DEFAULT_CACHE_MAX_AGE_MS } from '@/lib/persistentCache';
import { toDateKey, addDays } from '@/utils/dateKey';
import { compareDateKeys, getMinAllowedDateKeyFromSignupAt } from '@/lib/date-guard';



/**
 * Hook to fetch water daily log for a specific date
 */
export function useWaterDailyForDate(dateString: string | Date) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  // Normalize to canonical date key
  const dateKey = toDateKey(dateString);

  const cacheKey = waterDailyCacheKey(userId, dateKey);

  // Persistent snapshot (survives full reloads)
  const snapshot =
    cacheKey !== null
      ? getPersistentCache<WaterDaily | null>(cacheKey, DEFAULT_CACHE_MAX_AGE_MS)
      : null;

  return useQuery<WaterDaily | null>({
    queryKey: ['waterDaily', userId, dateKey],
    // DB call + write-through to persistent cache
    queryFn: async () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const data = await getWaterDailyForDate(userId, dateKey);

      if (cacheKey !== null) {
        setPersistentCache(cacheKey, data);
      }

      return data;
    },
    enabled: !!userId && !!dateKey,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes

    // Priority: previousData → in-memory cache → persistent snapshot
    placeholderData: (previousData) => {
      if (previousData !== undefined) {
        return previousData;
      }

      const cachedData = queryClient.getQueryData<WaterDaily | null>([
        'waterDaily',
        userId,
        dateKey,
      ]);
      if (cachedData !== undefined) {
        return cachedData;
      }

      return snapshot ?? undefined;
    },
  });
}


/**
 * Hook to fetch water daily logs for a date range
 */
/**
 * Hook to fetch water daily logs for a date range
 */
export function useWaterDailyForDateRange(
  startDate: string | Date,
  endDate: string | Date
) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  // Normalize to canonical date keys
  const startDateKey = toDateKey(startDate);
  const endDateKey = toDateKey(endDate);

  const cacheKey = waterDailyRangeCacheKey(userId, startDateKey, endDateKey);

  const snapshot =
    cacheKey !== null
      ? getPersistentCache<WaterDaily[]>(cacheKey, DEFAULT_CACHE_MAX_AGE_MS)
      : null;

  return useQuery<WaterDaily[]>({
    queryKey: ['waterDaily', userId, startDateKey, endDateKey],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const data = await getWaterDailyForDateRange(userId, startDateKey, endDateKey);

      if (cacheKey !== null) {
        setPersistentCache(cacheKey, data);
      }

      return data;
    },
    enabled: !!userId && !!startDateKey && !!endDateKey,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes,

    // Priority: previousData → in-memory cache → persistent snapshot
    placeholderData: (previousData) => {
      if (previousData !== undefined) {
        return previousData;
      }

      const cachedData = queryClient.getQueryData<WaterDaily[]>([
        'waterDaily',
        userId,
        startDateKey,
        endDateKey,
      ]);
      if (cachedData !== undefined) {
        return cachedData;
      }

      return snapshot ?? undefined;
    },
  });
}


/**
 * Hook to fetch water data for a range (default: last 7 days to target date)
 * Returns target date's water and history
 */
export function useWaterDaily(options?: { 
  daysBack?: number; 
  daysForward?: number;
  targetDateString?: string; // Date to get water for (defaults to today)
}) {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  // Calculate target date (default to today)
  const targetDateKey = options?.targetDateString 
    ? toDateKey(options.targetDateString)
    : toDateKey(new Date());
  
  const daysBack = options?.daysBack ?? 7;
  const daysForward = options?.daysForward ?? 0;
  
  // Calculate start and end date keys
  const minDateKey = user?.created_at ? getMinAllowedDateKeyFromSignupAt(user.created_at) : targetDateKey;
  const startDateKeyUnclamped = addDays(targetDateKey, -daysBack);
  const startDateKey =
    compareDateKeys(startDateKeyUnclamped, minDateKey) < 0 ? minDateKey : startDateKeyUnclamped;
  const endDateKey = addDays(targetDateKey, daysForward);

  // Fetch range data
  const rangeQuery = useWaterDailyForDateRange(startDateKey, endDateKey);
  
  // Get or create target date's water (ensures it exists with profile goal)
  const targetCacheKey = waterDailyCacheKey(userId, targetDateKey);
  const targetSnapshot =
    targetCacheKey !== null
      ? getPersistentCache<WaterDaily | null>(targetCacheKey, DEFAULT_CACHE_MAX_AGE_MS)
      : null;

  const targetWaterQuery = useQuery<WaterDaily | null>({
    queryKey: ['waterDaily', userId, targetDateKey],
    queryFn: async () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      const data = await getOrCreateWaterDailyForDate(userId, targetDateKey);

      // Write to persistent cache on success
      if (targetCacheKey !== null) {
        setPersistentCache(targetCacheKey, data);
      }

      return data;
    },
    enabled: !!userId && !!targetDateKey,
    staleTime: 60 * 1000, // 60 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes

    // Priority: previousData → in-memory cache → persistent snapshot
    placeholderData: (previousData) => {
      if (previousData !== undefined) {
        return previousData;
      }

      const cachedData = queryClient.getQueryData<WaterDaily | null>([
        'waterDaily',
        userId,
        targetDateKey,
      ]);
      if (cachedData !== undefined) {
        return cachedData;
      }

      return targetSnapshot ?? undefined;
    },
  });
  
  // Extract target date's water (prefer from range if available, otherwise from query)
  const targetWaterFromRange = rangeQuery.data?.find(w => w.date === targetDateKey);
  const targetWater = targetWaterFromRange || targetWaterQuery.data || null;
  const history = rangeQuery.data?.filter(w => w.date !== targetDateKey) || [];

  
  /**
   * Add water (optimistic update)
   */
  const addWaterMutation = useMutation({
    mutationFn: async ({ deltaMl, goalMl, dateString }: { deltaMl: number; goalMl?: number | null; dateString: string }) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return addWater(userId, dateString, deltaMl, goalMl ?? null);
    },
    onMutate: async ({ deltaMl, dateString }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['waterDaily', userId] });

      // Snapshot previous value
      const previousRange = queryClient.getQueryData<WaterDaily[]>([
        'waterDaily',
        userId,
        startDateKey,
        endDateKey,
      ]);
      const previousTarget = queryClient.getQueryData<WaterDaily | null>([
        'waterDaily',
        userId,
        dateString,
      ]);

      // Optimistically update (support negative deltas, floor at 0)
      if (previousTarget) {
        // Convert current total from row's unit to ml, add delta, convert back
        const currentTotalMl = toMl(previousTarget.total, previousTarget.water_unit);
        const newTotalMl = Math.max(0, currentTotalMl + deltaMl);
        const newTotal = fromMl(newTotalMl, previousTarget.water_unit);
        
        const updatedTarget: WaterDaily = {
          ...previousTarget,
          total: newTotal,
        };
        queryClient.setQueryData(['waterDaily', userId, dateString], updatedTarget);
        
        // Update range cache
        if (previousRange) {
          const updatedRange = previousRange.map(w =>
            w.date === dateString ? updatedTarget : w
          );
          queryClient.setQueryData(
            ['waterDaily', userId, startDateKey, endDateKey],
            updatedRange
          );
        }
      } else {
        // Create new entry optimistically (only if deltaMl is positive)
        const initialMl = Math.max(0, deltaMl);
        const defaultUnit: WaterUnit = 'ml';
        const newTotal = fromMl(initialMl, defaultUnit);
        const newTarget: WaterDaily = {
          id: 'temp',
          user_id: userId!,
          date: dateString,
          total: newTotal,
          water_unit: defaultUnit,
          goal_ml: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        queryClient.setQueryData(['waterDaily', userId, dateString], newTarget);
        
        if (previousRange) {
          queryClient.setQueryData(
            ['waterDaily', userId, startDateKey, endDateKey],
            [newTarget, ...previousRange]
          );
        }
      }

      return { previousRange, previousTarget };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousRange) {
        queryClient.setQueryData(
          ['waterDaily', userId, startDateKey, endDateKey],
          context.previousRange
        );
      }
      if (context?.previousTarget !== undefined) {
        queryClient.setQueryData(
          ['waterDaily', userId, variables.dateString],
          context.previousTarget
        );
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['waterDaily', userId] });
    },
  });



  /**
   * Set water goal (with validation and optimistic update)
   */
  const setGoalMutation = useMutation({
    mutationFn: async ({ goalMl, dateString }: { goalMl: number; dateString: string }) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      // Validate goal limits (480-5000ml)
      if (goalMl < 480 || goalMl > 5000) {
        throw new Error('Goal must be between 480ml and 5000ml');
      }
      return setWaterGoal(userId, dateString, goalMl);
    },
    onMutate: async ({ goalMl, dateString }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['waterDaily', userId] });

      // Snapshot previous value
      const previousRange = queryClient.getQueryData<WaterDaily[]>([
        'waterDaily',
        userId,
        startDateKey,
        endDateKey,
      ]);
      const previousTarget = queryClient.getQueryData<WaterDaily | null>([
        'waterDaily',
        userId,
        dateString,
      ]);

      // Optimistically update
      if (previousTarget) {
        // Convert goal to row's water_unit
        const goalInUnit = fromMl(goalMl, previousTarget.water_unit);
        
        const updatedTarget: WaterDaily = {
          ...previousTarget,
          goal_ml: goalMl,
        };
        queryClient.setQueryData(['waterDaily', userId, dateString], updatedTarget);
        
        if (previousRange) {
          const updatedRange = previousRange.map(w =>
            w.date === dateString ? updatedTarget : w
          );
          queryClient.setQueryData(
            ['waterDaily', userId, startDateKey, endDateKey],
            updatedRange
          );
        }
      } else {
        // Create new entry optimistically if it doesn't exist
        const existing = previousRange?.find(w => w.date === dateString);
        const currentTotal = existing?.total || 0;
        const waterUnit = existing?.water_unit || 'ml';
        const goalInUnit = fromMl(goalMl, waterUnit);
        
        const newTarget: WaterDaily = {
          id: 'temp',
          user_id: userId!,
          date: dateString,
          total: currentTotal,
          water_unit: waterUnit,
          goal_ml: goalMl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        queryClient.setQueryData(['waterDaily', userId, dateString], newTarget);
        
        if (previousRange) {
          const existingIndex = previousRange.findIndex(w => w.date === dateString);
          if (existingIndex !== -1) {
            const updatedRange = previousRange.map((w, idx) =>
              idx === existingIndex ? newTarget : w
            );
            queryClient.setQueryData(
              ['waterDaily', userId, startDateKey, endDateKey],
              updatedRange
            );
          } else {
            queryClient.setQueryData(
              ['waterDaily', userId, startDateKey, endDateKey],
              [newTarget, ...previousRange]
            );
          }
        }
      }

      return { previousRange, previousTarget };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousRange) {
        queryClient.setQueryData(
          ['waterDaily', userId, startDateKey, endDateKey],
          context.previousRange
        );
      }
      if (context?.previousTarget !== undefined) {
        queryClient.setQueryData(
          ['waterDaily', userId, variables.dateString],
          context.previousTarget
        );
      }
    },
    onSuccess: (data, variables) => {
      // Check if this was today's goal update
      const today = new Date();
      today.setHours(0, 0, 0, 0);
    const todayString = getLocalDateKey(today);
      const isToday = variables.dateString === todayString;

      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['waterDaily', userId] });
      // Also explicitly refetch the range query to ensure UI updates
      queryClient.refetchQueries({ 
        queryKey: ['waterDaily', userId, startDateKey, endDateKey] 
      });

      // If today's goal was updated, also invalidate profile to refresh profile.water_goal_ml
      if (isToday) {
        queryClient.invalidateQueries({ queryKey: ['userConfig', userId] });
        queryClient.invalidateQueries({ queryKey: ['userProfile', userId] }); // Backward compatibility
      }
    },
    onSettled: () => {
      // Ensure all queries are invalidated
      queryClient.invalidateQueries({ queryKey: ['waterDaily', userId] });
    },
  });

  /**
   * Set water total (absolute value in the row's water_unit)
   */
  const setTotalMutation = useMutation({
    mutationFn: async ({ totalInUnit, dateString }: { totalInUnit: number; dateString: string }) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return updateWaterTotal(userId, dateString, totalInUnit);
    },
    onMutate: async ({ totalInUnit, dateString }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['waterDaily', userId] });

      // Snapshot previous value
      const previousRange = queryClient.getQueryData<WaterDaily[]>([
        'waterDaily',
        userId,
        startDateKey,
        endDateKey,
      ]);
      const previousTarget = queryClient.getQueryData<WaterDaily | null>([
        'waterDaily',
        userId,
        dateString,
      ]);

      // Optimistically update
      if (previousTarget) {
        const updatedTarget: WaterDaily = {
          ...previousTarget,
          total: totalInUnit,
        };
        queryClient.setQueryData(['waterDaily', userId, dateString], updatedTarget);
        
        if (previousRange) {
          const updatedRange = previousRange.map(w =>
            w.date === dateString ? updatedTarget : w
          );
          queryClient.setQueryData(
            ['waterDaily', userId, startDateKey, endDateKey],
            updatedRange
          );
        }
      } else {
        const newTarget: WaterDaily = {
          id: 'temp',
          user_id: userId!,
          date: dateString,
          total: totalInUnit,
          water_unit: 'ml',
          goal_ml: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        queryClient.setQueryData(['waterDaily', userId, dateString], newTarget);
        
        if (previousRange) {
          queryClient.setQueryData(
            ['waterDaily', userId, startDateKey, endDateKey],
            [newTarget, ...previousRange]
          );
        }
      }

      return { previousRange, previousTarget };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousRange) {
        queryClient.setQueryData(
          ['waterDaily', userId, startDateKey, endDateKey],
          context.previousRange
        );
      }
      if (context?.previousTarget !== undefined) {
        queryClient.setQueryData(
          ['waterDaily', userId, variables.dateString],
          context.previousTarget
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['waterDaily', userId] });
    },
  });

  /**
   * Update water unit and goal (for settings panel)
   */
  const updateUnitAndGoalMutation = useMutation({
    mutationFn: async ({ waterUnit, goalInUnit }: { waterUnit: WaterUnit; goalInUnit: number }) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return updateWaterUnitAndGoal(userId, waterUnit, goalInUnit);
    },
    onSuccess: () => {
      // Invalidate all water and profile queries
      queryClient.invalidateQueries({ queryKey: ['waterDaily', userId] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] }); // Backward compatibility
      queryClient.invalidateQueries({ queryKey: ['userConfig', userId] }); // Required for useUserConfig hook
    },
  });

  return {
    targetWater: targetWater,
    todayWater: targetWater, // Keep for backwards compatibility
    history,
    isLoading: rangeQuery.isLoading || targetWaterQuery.isLoading,
    error: rangeQuery.error || targetWaterQuery.error,
    addWater: (deltaMl: number, goalMl?: number | null) =>
      addWaterMutation.mutate({ deltaMl, goalMl, dateString: targetDateKey }),
    setGoal: (goalMl: number) => setGoalMutation.mutate({ goalMl, dateString: targetDateKey }),
    setTotal: (totalInUnit: number) => setTotalMutation.mutate({ totalInUnit, dateString: targetDateKey }),
    setTotalForDate: (totalInUnit: number, dateString: string) =>
      setTotalMutation.mutate({ totalInUnit, dateString }),
    updateUnitAndGoal: (waterUnit: WaterUnit, goalInUnit: number) =>
      updateUnitAndGoalMutation.mutate({ waterUnit, goalInUnit }),
    isAddingWater: addWaterMutation.isPending,
    isSettingGoal: setGoalMutation.isPending,
    isSettingTotal: setTotalMutation.isPending,
    isUpdatingUnitAndGoal: updateUnitAndGoalMutation.isPending,
    addWaterError: addWaterMutation.error,
  };
}
function waterDailyCacheKey(userId: string | undefined, date: string) {
  if (!userId) return null;
  return `waterDaily:${userId}:${date}`;
}

function waterDailyRangeCacheKey(
  userId: string | undefined,
  startDate: string,
  endDate: string
) {
  if (!userId) return null;
  return `waterDailyRange:${userId}:${startDate}:${endDate}`;
}
