import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteWeightLogById, recomputeProfileWeightAndBodyFat } from '@/lib/services/weightLogs';

export function useDeleteWeightLog(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      if (!userId) throw new Error('User not authenticated');
      await deleteWeightLogById(id);
      await recomputeProfileWeightAndBodyFat(userId);
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['weightLogs180d', userId] });

      const previous = queryClient.getQueryData<any[]>(['weightLogs180d', userId]);

      queryClient.setQueryData<any[]>(['weightLogs180d', userId], (old) =>
        (old ?? []).filter((row) => row.id !== id)
      );

      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(['weightLogs180d', userId], ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['weightLogs180d', userId] });
      queryClient.invalidateQueries({ queryKey: ['weightLogs'] });
      queryClient.invalidateQueries({ queryKey: ['userConfig', userId] });
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] }); // Backward compatibility
    },
  });
}

