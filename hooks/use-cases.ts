import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { SupportCase, SupportCaseCategory, SupportCaseStatus } from '@/utils/types';
import {
  adminUpdateCaseStatus,
  createCase,
  fetchAdminCases,
  fetchCaseById,
  fetchMyCases,
  type CaseCursor,
} from '@/lib/services/cases';

export type CasePage = {
  items: SupportCase[];
  nextCursor: CaseCursor | null;
};

export const myCasesQueryKeyBase = (userId: string | undefined) => ['myCases', userId];
export const myCasesQueryKey = (userId: string | undefined, pageSize: number, cursor?: CaseCursor | null) => [
  'myCases',
  userId,
  pageSize,
  cursor?.createdAt ?? null,
  cursor?.id ?? null,
];

export const adminCasesQueryKeyBase = (userId: string | undefined) => ['adminCases', userId];
export const adminCasesQueryKey = (params: {
  userId: string | undefined;
  pageSize: number;
  cursor?: CaseCursor | null;
  status?: SupportCaseStatus | 'all';
  category?: SupportCaseCategory | 'all';
}) => [
  'adminCases',
  params.userId,
  params.pageSize,
  params.status ?? 'all',
  params.category ?? 'all',
  params.cursor?.createdAt ?? null,
  params.cursor?.id ?? null,
];

export const caseDetailQueryKey = (userId: string | undefined, caseId: string | undefined) => ['caseDetail', userId, caseId];

export function useMyCases(params: { pageSize: number; cursor?: CaseCursor | null }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { pageSize, cursor } = params;

  return useQuery<CasePage>({
    queryKey: myCasesQueryKey(userId, pageSize, cursor),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      const items = await fetchMyCases({ userId, pageSize, cursor });
      const last = items[items.length - 1];
      return {
        items,
        nextCursor: last ? { createdAt: last.created_at, id: last.id } : null,
      };
    },
    staleTime: 60 * 1000,
  });
}

export function useAdminCases(params: {
  pageSize: number;
  cursor?: CaseCursor | null;
  status?: SupportCaseStatus | 'all';
  category?: SupportCaseCategory | 'all';
}) {
  const { user } = useAuth();
  const userId = user?.id;
  const { pageSize, cursor, status, category } = params;

  return useQuery<CasePage>({
    queryKey: adminCasesQueryKey({ userId, pageSize, cursor, status, category }),
    enabled: !!userId,
    queryFn: async () => {
      const items = await fetchAdminCases({ pageSize, cursor, status, category });
      const last = items[items.length - 1];
      return {
        items,
        nextCursor: last ? { createdAt: last.created_at, id: last.id } : null,
      };
    },
    staleTime: 60 * 1000,
  });
}

export function useCaseDetail(caseId?: string) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: caseDetailQueryKey(userId, caseId),
    enabled: !!userId && !!caseId,
    queryFn: async () => {
      if (!caseId) throw new Error('Case ID is required');
      return fetchCaseById({ id: caseId });
    },
    staleTime: 60 * 1000,
  });
}

export function useCreateCase() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      category: SupportCaseCategory;
      subject?: string | null;
      message: string;
      pagePath?: string | null;
      userAgent?: string | null;
      appVersion?: string | null;
    }) => {
      return createCase(params);
    },
    onSuccess: async () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: myCasesQueryKeyBase(userId) });
    },
  });
}

export function useAdminUpdateCaseStatus() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { caseId: string; status: SupportCaseStatus }) => {
      return adminUpdateCaseStatus(params);
    },
    onSuccess: async (_data, variables) => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: adminCasesQueryKeyBase(userId) });
      queryClient.invalidateQueries({ queryKey: caseDetailQueryKey(userId, variables.caseId) });
      queryClient.invalidateQueries({ queryKey: myCasesQueryKeyBase(userId) });
    },
  });
}

