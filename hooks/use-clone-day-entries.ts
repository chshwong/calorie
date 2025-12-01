/**
 * React Query hook for cloning day entries
 * 
 * Query keys:
 * - Uses existing query keys for the entity types being cloned
 * 
 * This hook provides a reusable pattern for cloning entries from one date to another.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { cloneDayEntries, type CloneEntityType } from '@/lib/services/cloneDayEntries';

/**
 * Hook to clone entries from one date to another
 * 
 * @param entityType - Type of entity to clone ('pill_intake', 'food_log', 'exercise_log')
 * @returns Mutation object with cloneDayEntries function, isLoading, error, etc.
 */
export function useCloneDayEntriesMutation(entityType: CloneEntityType) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: ({ sourceDate, targetDate }: { sourceDate: string; targetDate: string }) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      // cloneDayEntries throws errors that will be caught by React Query
      return cloneDayEntries(entityType, userId, sourceDate, targetDate);
    },
    onSuccess: (clonedCount, variables) => {
      // Invalidate relevant queries based on entity type
      if (entityType === 'pill_intake') {
        // Invalidate med logs queries for both source and target dates
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
    },
  });
}

