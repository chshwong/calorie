import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteWeightLogById, recomputeProfileWeightAndBodyFat } from '@/lib/services/weightLogs';
import { refreshBurnedFromWeightChange } from '@/lib/services/burned/refreshDailySumBurned';

export function useDeleteWeightLog(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; weighedAtISO?: string | null }) => {
      if (!userId) throw new Error('User not authenticated');
      await deleteWeightLogById(input.id);
      await recomputeProfileWeightAndBodyFat(userId);
      return input;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['weightLogs180d', userId] });

      const previous = queryClient.getQueryData<any[]>(['weightLogs180d', userId]);

      queryClient.setQueryData<any[]>(['weightLogs180d', userId], (old) =>
        (old ?? []).filter((row) => row.id !== input.id)
      );

      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['weightLogs180d', userId], ctx.previous);
      }
    },
    onSettled: async (result) => {
      // Best-effort refresh of burned system_* values after deletion.
      try {
        await refreshBurnedFromWeightChange({ userId, changedAtISO: result?.weighedAtISO ?? null });
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error refreshing daily_sum_burned after weight delete', e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['weightLogs180d', userId] });
      queryClient.invalidateQueries({ queryKey: ['weightLogs'] });
      queryClient.invalidateQueries({ queryKey: ['userConfig', userId] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] }); // Backward compatibility
      queryClient.invalidateQueries({ queryKey: ['dailySumBurned', userId] });
      queryClient.invalidateQueries({ queryKey: ['dailySumBurnedRange', userId] });
    },
  });
}

