/**
 * React Query mutation hook for transferring (copying or moving) mealtype entries
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { transferMealtypeEntries, type TransferMode, type NotesMode } from '@/lib/services/clone-mealtype-entries';

export interface TransferMealtypeEntriesParams {
  sourceDate: string;
  sourceMealType: string;
  targetDate: string;
  targetMealType: string;
  mode: TransferMode;
  notesMode: NotesMode;
}

export function useTransferMealtypeEntries() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: TransferMealtypeEntriesParams) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return transferMealtypeEntries({
        userId,
        ...params,
      });
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
        // Invalidate source mealtype meta (especially important for move mode)
        queryClient.invalidateQueries({
          queryKey: ['mealtypeMeta', userId, variables.sourceDate],
        });
      }
    },
  });
}

