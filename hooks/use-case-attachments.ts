import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { SupportCaseAttachment } from '@/utils/types';
import { fetchCaseAttachments, getSignedAttachmentUrl } from '@/lib/services/caseAttachments';

export const caseAttachmentsQueryKey = (userId: string | undefined, caseId: string | undefined) => [
  'caseAttachments',
  userId,
  caseId,
];

export const signedAttachmentUrlQueryKey = (userId: string | undefined, storagePath: string | undefined) => [
  'caseAttachmentSignedUrl',
  userId,
  storagePath,
];

export function useCaseAttachments(caseId?: string) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<SupportCaseAttachment[]>({
    queryKey: caseAttachmentsQueryKey(userId, caseId),
    enabled: !!userId && !!caseId,
    queryFn: async () => {
      if (!caseId) throw new Error('Case ID is required');
      return fetchCaseAttachments({ caseId });
    },
    staleTime: 60 * 1000,
  });
}

export function useSignedCaseAttachmentUrl(storagePath?: string) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery<string | null>({
    queryKey: signedAttachmentUrlQueryKey(userId, storagePath),
    enabled: !!userId && !!storagePath,
    queryFn: async () => {
      if (!storagePath) return null;
      return getSignedAttachmentUrl({ storagePath });
    },
    staleTime: 5 * 60 * 1000,
  });
}

