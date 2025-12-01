/**
 * React Query hook for cloning entries from the previous day
 * 
 * Reusable pattern for "clone from previous day" functionality.
 * Works with any entity type (pill_intake, food_log, exercise_log).
 * 
 * Per engineering guidelines:
 * - Data access in services layer (cloneDayEntries)
 * - UI logic in hooks layer (this file)
 * - Error handling centralized
 * - Query invalidation handled automatically
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { cloneDayEntries, type CloneEntityType } from '@/lib/services/cloneDayEntries';

/**
 * Helper to get query key for entity type
 */
function getQueryKeyForEntityType(entityType: CloneEntityType, userId: string | undefined, dateString: string): any[] {
  if (!userId) return [];
  
  switch (entityType) {
    case 'pill_intake':
      return ['medLogs', userId, dateString];
    case 'exercise_log':
      return ['exerciseLogs', userId, dateString];
    case 'food_log':
      return ['dailyEntries', userId, dateString];
    default:
      return [];
  }
}

export interface CloneFromPreviousDayOptions {
  /**
   * Type of entity to clone ('pill_intake', 'food_log', 'exercise_log')
   */
  entityType: CloneEntityType;
  
  /**
   * Current date (target date for cloning)
   */
  currentDate: Date;
  
  /**
   * Callback when cloning succeeds
   * @param clonedCount - Number of items cloned
   */
  onSuccess?: (clonedCount: number) => void;
  
  /**
   * Callback when cloning fails
   * @param error - Error that occurred
   */
  onError?: (error: Error) => void;
}

/**
 * Hook to clone entries from the previous day to the current date
 * 
 * @param options - Configuration options
 * @returns Mutation object with execute function, isLoading, error, etc.
 */
export function useCloneFromPreviousDay(options: CloneFromPreviousDayOptions) {
  const { entityType, currentDate, onSuccess, onError } = options;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Calculate previous day
      const previousDay = new Date(currentDate);
      previousDay.setDate(previousDay.getDate() - 1);
      
      // Format dates as YYYY-MM-DD
      const sourceDate = previousDay.toISOString().split('T')[0];
      const targetDate = currentDate.toISOString().split('T')[0];

      // Check cache first - if no entries exist, throw special error
      const sourceQueryKey = getQueryKeyForEntityType(entityType, userId, sourceDate);
      const cachedData = queryClient.getQueryData<any[]>(sourceQueryKey);
      
      // If cache exists and is empty, don't call DB
      if (cachedData !== undefined && (cachedData === null || cachedData.length === 0)) {
        throw new Error('NOTHING_TO_COPY');
      }

      // Use the shared cloneDayEntries service
      return cloneDayEntries(entityType, userId, sourceDate, targetDate);
    },
    onSuccess: (clonedCount) => {
      // Invalidate relevant queries based on entity type
      if (entityType === 'pill_intake') {
        queryClient.invalidateQueries({ queryKey: ['medLogs', userId] });
        queryClient.invalidateQueries({ queryKey: ['medSummary', userId] });
        queryClient.invalidateQueries({ queryKey: ['recentAndFrequentMeds', userId] });
      } else if (entityType === 'food_log') {
        // TODO: Invalidate food log queries when food_log cloning is implemented
        queryClient.invalidateQueries({ queryKey: ['dailyEntries', userId] });
      } else if (entityType === 'exercise_log') {
        queryClient.invalidateQueries({ queryKey: ['exerciseLogs', userId] });
        queryClient.invalidateQueries({ queryKey: ['exerciseSummary', userId] });
        queryClient.invalidateQueries({ queryKey: ['recentAndFrequentExercises', userId] });
      }

      // Call user-provided success callback
      onSuccess?.(clonedCount);
    },
    onError: (error: Error) => {
      // Call user-provided error callback
      onError?.(error);
    },
  });

  return {
    cloneFromPreviousDay: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error,
    isError: mutation.isError,
  };
}

