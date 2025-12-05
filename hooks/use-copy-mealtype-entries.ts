/**
 * React Query mutation hook for copying mealtype entries
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { cloneCaloriesEntriesForMealtype } from '@/lib/services/clone-mealtype-entries';

export interface CopyMealtypeEntriesParams {
  sourceDate: string;
  sourceMealType: string;
  targetDate: string;
  targetMealType: string;
  includeQuickLog?: boolean;
}

export function useCopyMealtypeEntries() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CopyMealtypeEntriesParams) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return cloneCaloriesEntriesForMealtype(
        userId,
        params.sourceDate,
        params.sourceMealType,
        params.targetDate,
        params.targetMealType,
        params.includeQuickLog ?? false
      );
    },
    onSuccess: (_, variables) => {
      // Invalidate queries for target date
      if (userId) {
        // Invalidate entries for target date
        queryClient.invalidateQueries({
          queryKey: ['entries', userId, variables.targetDate],
        });
        // Invalidate mealtype meta for target date
        queryClient.invalidateQueries({
          queryKey: ['mealtypeMeta', userId, variables.targetDate],
        });
        // Also invalidate source date entries (in case user wants to see updated counts)
        queryClient.invalidateQueries({
          queryKey: ['entries', userId, variables.sourceDate],
        });
      }
    },
  });
}
