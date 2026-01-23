import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { FitbitConnectionPublic } from '@/utils/types';
import { disconnectFitbit, getFitbitConnectionPublic, startFitbitOAuth, syncFitbitNow } from '@/lib/services/fitbit/fitbitConnection';

export function useFitbitConnectionPublic(opts?: { enabled?: boolean }) {
  const { user } = useAuth();
  const userId = user?.id;
  const enabled = (opts?.enabled ?? true) && !!userId;

  return useQuery<FitbitConnectionPublic | null>({
    queryKey: ['fitbitConnectionPublic', userId],
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return getFitbitConnectionPublic(userId);
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useStartFitbitOAuth() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async () => startFitbitOAuth(),
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['fitbitConnectionPublic', userId] });
      }
    },
  });
}

export function useSyncFitbitNow() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async () => syncFitbitNow(),
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['fitbitConnectionPublic', userId] });
      }
    },
  });
}

export function useDisconnectFitbit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async () => disconnectFitbit(),
    onSuccess: () => {
      if (userId) {
        queryClient.setQueryData(['fitbitConnectionPublic', userId], null);
        queryClient.invalidateQueries({ queryKey: ['fitbitConnectionPublic', userId] });
      }
    },
  });
}

