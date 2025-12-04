/**
 * React Query hook for cloning food entries from the previous day for a specific meal type
 * 
 * Similar to useCloneFromPreviousDay but specifically for food entries with meal type filtering.
 * 
 * Per engineering guidelines:
 * - Data access in services layer (cloneDayEntries)
 * - UI logic in hooks layer (this file)
 * - Error handling centralized
 * - Query invalidation handled automatically
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { cloneDayEntries } from '@/lib/services/cloneDayEntries';

export interface CloneMealTypeFromPreviousDayOptions {
  /**
   * Current date (target date for cloning)
   */
  currentDate: Date;
  
  /**
   * Meal type to clone (e.g., 'breakfast', 'lunch', 'dinner', etc.)
   */
  mealType: string;
  
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
 * Hook to clone food entries from the previous day to the current date for a specific meal type
 * 
 * @param options - Configuration options
 * @returns Mutation object with execute function, isLoading, error, etc.
 */
export function useCloneMealTypeFromPreviousDay(options: CloneMealTypeFromPreviousDayOptions) {
  const { currentDate, mealType, onSuccess, onError } = options;
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
      const sourceQueryKey = ['entries', userId, sourceDate];
      const cachedData = queryClient.getQueryData<any[]>(sourceQueryKey);
      
      // If cache exists, check if there are entries for this meal type
      if (cachedData !== undefined) {
        if (cachedData === null || cachedData.length === 0) {
          throw new Error('NOTHING_TO_COPY');
        }
        
        // Check if there are entries for this specific meal type
        const mealTypeEntries = cachedData.filter(entry => 
          entry.meal_type?.toLowerCase() === mealType.toLowerCase()
        );
        
        if (mealTypeEntries.length === 0) {
          throw new Error('NOTHING_TO_COPY');
        }
      }

      // Use the shared cloneDayEntries service with meal type filter
      return cloneDayEntries('food_log', userId, sourceDate, targetDate, undefined, mealType);
    },
    onSuccess: (clonedCount) => {
      // Invalidate food log queries (matches useDailyEntries query key pattern)
      queryClient.invalidateQueries({ queryKey: ['entries', userId] });

      // Call user-provided success callback
      onSuccess?.(clonedCount);
    },
    onError: (error: Error) => {
      // Call user-provided error callback
      onError?.(error);
    },
  });

  return {
    cloneMealTypeFromPreviousDay: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error,
    isError: mutation.isError,
  };
}

