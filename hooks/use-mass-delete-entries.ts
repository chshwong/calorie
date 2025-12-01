/**
 * React Query hook for mass deleting entries
 * 
 * This hook provides a reusable pattern for mass deleting entries by IDs.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { massDeleteEntries, type CloneEntityType } from '@/lib/services/massDeleteEntries';

/**
 * Hook to mass delete entries by IDs
 * 
 * @param entityType - Type of entity to delete ('pill_intake', 'exercise_log')
 * @returns Mutation object with massDeleteEntries function, isLoading, error, etc.
 */
export function useMassDeleteEntriesMutation(entityType: CloneEntityType) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: ({ entryIds }: { entryIds: string[] }) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return massDeleteEntries(entityType, userId, entryIds);
    },
    onSuccess: (deletedCount) => {
      // Invalidate relevant queries based on entity type
      if (entityType === 'pill_intake') {
        queryClient.invalidateQueries({ queryKey: ['medLogs', userId] });
        queryClient.invalidateQueries({ queryKey: ['medSummary', userId] });
        queryClient.invalidateQueries({ queryKey: ['recentAndFrequentMeds', userId] });
      } else if (entityType === 'exercise_log') {
        queryClient.invalidateQueries({ queryKey: ['exerciseLogs', userId] });
        queryClient.invalidateQueries({ queryKey: ['exerciseSummary', userId] });
        queryClient.invalidateQueries({ queryKey: ['recentAndFrequentExercises', userId] });
      }
    },
  });
}

