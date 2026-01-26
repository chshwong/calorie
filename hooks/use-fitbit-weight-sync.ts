import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { syncFitbitWeightNow } from '@/lib/services/fitbit/fitbitConnection';

export function useSyncFitbitWeightNow() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useMutation({
    mutationFn: async () => syncFitbitWeightNow(),
    retry: false,
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['weightLogs366d', userId] });
      queryClient.invalidateQueries({ queryKey: ['weightLogs', userId] });
      queryClient.invalidateQueries({ queryKey: ['weightLogs', userId, 'earliest'] });
    },
  });
}

