import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { unreadNotificationCountQueryKey, inboxNotificationsQueryKeyBase } from '@/hooks/use-notifications';
import { caseDetailQueryKey, myCasesQueryKeyBase, adminCasesQueryKeyBase } from '@/hooks/use-cases';
import type { SupportCaseMessage, SupportCaseStatus } from '@/utils/types';
import { adminAddCaseMessage, fetchCaseMessages } from '@/lib/services/caseMessages';

export const caseMessagesQueryKey = (userId: string | undefined, caseId: string | undefined) => ['caseMessages', userId, caseId];

export function useCaseMessages(caseId?: string) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<SupportCaseMessage[]>({
    queryKey: caseMessagesQueryKey(userId, caseId),
    enabled: !!userId && !!caseId,
    queryFn: async () => {
      if (!caseId) throw new Error('Case ID is required');
      return fetchCaseMessages({ caseId });
    },
    staleTime: 60 * 1000,
  });
}

export function useAdminAddCaseMessage() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      caseId: string;
      message: string;
      isInternal: boolean;
      newStatus?: SupportCaseStatus | null;
    }) => {
      return adminAddCaseMessage(params);
    },
    onSuccess: async (_data, variables) => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: caseMessagesQueryKey(userId, variables.caseId) });
      queryClient.invalidateQueries({ queryKey: caseDetailQueryKey(userId, variables.caseId) });
      queryClient.invalidateQueries({ queryKey: myCasesQueryKeyBase(userId) });
      queryClient.invalidateQueries({ queryKey: adminCasesQueryKeyBase(userId) });
      queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryKey(userId) });
      queryClient.invalidateQueries({ queryKey: inboxNotificationsQueryKeyBase(userId) });
    },
  });
}

