import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { FitbitConnectionPublic } from '@/utils/types';
import { disconnectFitbit, getFitbitConnectionPublic, startFitbitOAuth, syncFitbitNow } from '@/lib/services/fitbit/fitbitConnection';
import { dailySumBurnedQueryKey } from '@/hooks/use-daily-sum-burned';
import { useApplyRawToFinals } from '@/hooks/use-burned-mutations';

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

export function useFitbitConnectionQuery(opts?: { enabled?: boolean }) {
  const query = useFitbitConnectionPublic(opts);
  return {
    ...query,
    isConnected: !!query.data,
    lastSyncAt: query.data?.last_sync_at ?? null,
  };
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

type FitbitSyncNowInput = {
  dateKey: string;
};

export function useFitbitSyncNowMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (_vars: FitbitSyncNowInput) => syncFitbitNow(),
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['fitbitConnectionPublic', userId] });
    },
  });
}

export function useFitbitSyncAndApplyMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const applyRawMutation = useApplyRawToFinals();

  return useMutation({
    mutationFn: async (vars: FitbitSyncNowInput) => {
      if (!userId) throw new Error('User not authenticated');
      if (!vars?.dateKey) throw new Error('Missing dateKey');
      await syncFitbitNow();
      return applyRawMutation.mutateAsync({ entryDate: vars.dateKey });
    },
    onSuccess: (_row, vars) => {
      if (!userId || !vars?.dateKey) return;
      const key = dailySumBurnedQueryKey(userId, vars.dateKey);
      queryClient.invalidateQueries({ queryKey: ['fitbitConnectionPublic', userId] });
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.refetchQueries({ queryKey: key, type: 'active' });
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

