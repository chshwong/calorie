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

import { useAuth } from '@/contexts/AuthContext';
import { getMealtypeMetaByDate, upsertMealtypeMeta } from '@/lib/services/calories-entries-mealtype-meta';
import { cloneDayEntries } from '@/lib/services/cloneDayEntries';
import { invalidateDailySumConsumedRangesForDate } from '@/lib/services/consumed/invalidateDailySumConsumedRanges';
import { getLocalDateKey } from '@/utils/dateTime';
import type { CalorieEntry, DailyEntriesWithStatus } from '@/utils/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface CloneMealTypeFromPreviousDayResult {
  entriesCloned: number;
  quickLogCopied: boolean; // Always false, kept for backward compatibility
  notesCopied: boolean;
  totalCount: number; // entries + notes (1)
}

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
   * @param result - Result with counts of cloned items
   */
  onSuccess?: (result: CloneMealTypeFromPreviousDayResult) => void;
  
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
      const sourceDate = getLocalDateKey(previousDay);
      const targetDate = getLocalDateKey(currentDate);

      // Check cache first - check for entries, quick log, or notes
      // Entries cache can be DailyEntriesWithStatus { entries } or CalorieEntry[] (normalize like index.tsx)
      const sourceQueryKey = ['entries', userId, sourceDate];
      const cachedData = queryClient.getQueryData<DailyEntriesWithStatus | CalorieEntry[]>(sourceQueryKey);
      const cachedEntries = Array.isArray(cachedData)
        ? cachedData
        : cachedData?.entries ?? null;

      // Also check for mealtype meta
      const sourceMetaQueryKey = ['mealtypeMeta', userId, sourceDate];
      const cachedMeta = queryClient.getQueryData<any[]>(sourceMetaQueryKey);
      
      // Check if there's anything to copy: entries or notes
      let hasEntries = false;
      let hasNotes = false;
      
      // Check entries (using normalized array)
      if (cachedEntries !== null && cachedEntries.length > 0) {
        const mealTypeEntries = cachedEntries.filter((entry: CalorieEntry) =>
          entry.meal_type?.toLowerCase() === mealType.toLowerCase()
        );
        hasEntries = mealTypeEntries.length > 0;
      }
      
      // Check notes from meta
      if (cachedMeta !== undefined && cachedMeta !== null) {
        const mealTypeMeta = cachedMeta.find(meta =>
          meta.meal_type?.toLowerCase() === mealType.toLowerCase()
        );
        if (mealTypeMeta) {
          hasNotes = mealTypeMeta.note != null && mealTypeMeta.note.trim().length > 0;
        }
      }
      
      // If cache exists and there's nothing to copy, throw error
      if (cachedData !== undefined && cachedMeta !== undefined) {
        if (!hasEntries && !hasNotes) {
          throw new Error('NOTHING_TO_COPY');
        }
      }

      // Use the shared cloneDayEntries service with meal type filter
      const entriesCloned = await cloneDayEntries('food_log', userId, sourceDate, targetDate, undefined, mealType);

      // After successfully cloning entries, also clone mealtype_meta if it exists
      // Copy notes
      const sourceMetaArray = await getMealtypeMetaByDate(userId, sourceDate);
      const sourceMeta = sourceMetaArray.find(meta => 
        meta.meal_type.toLowerCase() === mealType.toLowerCase()
      );

      let notesCopied = false;

      if (sourceMeta) {
        const hasNoteValue = sourceMeta.note != null && sourceMeta.note.trim().length > 0;
        
        // Only upsert if there's something to copy
        if (hasNoteValue) {
          const upsertParams: any = {
            userId,
            entryDate: targetDate,
            mealType,
            note: sourceMeta.note,
          };
          
          const metaResult = await upsertMealtypeMeta(upsertParams);
          // Only mark as copied if upsert was successful
          if (metaResult) {
            notesCopied = true;
          }
        }
      }

      // Calculate total count
      let totalCount = entriesCloned;
      if (notesCopied) totalCount += 1;

      return {
        entriesCloned,
        quickLogCopied: false,
        notesCopied,
        totalCount,
      };
    },
    onSuccess: (result) => {
      // Invalidate food log queries (matches useDailyEntries query key pattern)
      queryClient.invalidateQueries({ queryKey: ['entries', userId] });
      // Also invalidate mealtype meta queries for both source and target dates
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['mealtypeMeta', userId] });

        // daily_sum_consumed is maintained by DB triggers; invalidate dashboard ranges for the target date.
        const targetDate = getLocalDateKey(currentDate);
        invalidateDailySumConsumedRangesForDate(queryClient, userId, targetDate);
      }

      // Call user-provided success callback
      onSuccess?.(result);
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

