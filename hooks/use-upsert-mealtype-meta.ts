/**
 * React Query mutation hook for upserting mealtype meta
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { upsertMealtypeMeta, type UpsertMealtypeMetaParams } from '@/lib/services/calories-entries-mealtype-meta';

export function useUpsertMealtypeMeta() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: Omit<UpsertMealtypeMetaParams, 'userId'>) => {
      if (!userId) {
        throw new Error('User not authenticated');
      }
      return upsertMealtypeMeta({
        ...params,
        userId,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate the mealtype meta query for the date
      if (userId && variables.entryDate) {
        queryClient.invalidateQueries({
          queryKey: ['mealtypeMeta', userId, variables.entryDate],
        });
      }
    },
  });
}
