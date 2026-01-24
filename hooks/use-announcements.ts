import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { Announcement } from '@/utils/types';
import {
  createAnnouncementDraft,
  deleteAnnouncement,
  getAdminAnnouncements,
  getAnnouncementById,
  getAnnouncementNotificationStats,
  getAnnouncementsByIds,
  publishAnnouncement,
  updateAnnouncementDraft,
  type AnnouncementCursor,
  type AnnouncementNotificationStats,
} from '@/lib/services/announcements';
import { inboxNotificationsQueryKeyBase, unreadNotificationCountQueryKey } from '@/hooks/use-notifications';

export type AnnouncementPage = {
  items: Announcement[];
  nextCursor: AnnouncementCursor | null;
};

export const announcementQueryKey = (userId: string | undefined, id: string | undefined) => [
  'announcement',
  userId,
  id,
];

export const adminAnnouncementsQueryKeyBase = (userId: string | undefined) => ['adminAnnouncements', userId];

export const adminAnnouncementsQueryKey = (
  userId: string | undefined,
  pageSize: number,
  cursor?: AnnouncementCursor | null
) => ['adminAnnouncements', userId, pageSize, cursor?.updatedAt ?? null, cursor?.id ?? null];

export const announcementNotificationStatsQueryKey = (userId: string | undefined, ids: string[]) => [
  'announcementNotificationStats',
  userId,
  ...ids,
];

export function useAnnouncementById(id?: string) {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: announcementQueryKey(userId, id),
    enabled: !!userId && !!id,
    queryFn: async () => {
      if (!id) throw new Error('Announcement ID is required');
      return getAnnouncementById(id);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAnnouncementsByIds(ids: string[]) {
  const { user } = useAuth();
  const userId = user?.id;
  const sortedIds = [...ids].sort();

  return useQuery({
    queryKey: ['announcementsByIds', userId, ...sortedIds],
    enabled: !!userId && sortedIds.length > 0,
    queryFn: async () => {
      return getAnnouncementsByIds(sortedIds);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminAnnouncementsList(params: { pageSize: number; cursor?: AnnouncementCursor | null }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { pageSize, cursor } = params;

  return useQuery<AnnouncementPage>({
    queryKey: adminAnnouncementsQueryKey(userId, pageSize, cursor),
    enabled: !!userId,
    queryFn: async () => {
      const items = await getAdminAnnouncements({ pageSize, cursor });
      const lastItem = items[items.length - 1];
      return {
        items,
        nextCursor: lastItem ? { updatedAt: lastItem.updated_at, id: lastItem.id } : null,
      };
    },
    staleTime: 60 * 1000,
  });
}

export function useAnnouncementNotificationStats(ids: string[]) {
  const { user } = useAuth();
  const userId = user?.id;
  const sortedIds = [...ids].sort();

  return useQuery<AnnouncementNotificationStats[]>({
    queryKey: announcementNotificationStatsQueryKey(userId, sortedIds),
    enabled: !!userId && sortedIds.length > 0,
    queryFn: async () => {
      return getAnnouncementNotificationStats(sortedIds);
    },
    staleTime: 60 * 1000,
  });
}

export function useCreateAnnouncementDraft() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAnnouncementDraft,
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: adminAnnouncementsQueryKeyBase(userId) });
    },
  });
}

export function useUpdateAnnouncementDraft() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAnnouncementDraft,
    onSuccess: (updated) => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: adminAnnouncementsQueryKeyBase(userId) });
      queryClient.invalidateQueries({ queryKey: announcementQueryKey(userId, updated.id) });
    },
  });
}

export function usePublishAnnouncement() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: publishAnnouncement,
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: adminAnnouncementsQueryKeyBase(userId) });
      queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryKey(userId) });
    },
  });
}

export function useDeleteAnnouncement() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcementId: string) => {
      return deleteAnnouncement(announcementId);
    },
    onSuccess: async (_result, announcementId) => {
      if (!userId) return;
      // Update caches immediately (do not rely on remounts)
      queryClient.setQueriesData<AnnouncementPage>(
        { queryKey: adminAnnouncementsQueryKeyBase(userId) },
        (current) => {
          if (!current) return current;
          return {
            ...current,
            items: current.items.filter((a) => a.id !== announcementId),
          };
        }
      );

      queryClient.setQueryData(announcementQueryKey(userId, announcementId), null);
      queryClient.setQueriesData<Announcement[]>(
        { queryKey: ['announcementsByIds', userId] },
        (current) => {
          if (!current) return current;
          return current.filter((a) => a.id !== announcementId);
        }
      );

      queryClient.invalidateQueries({ queryKey: adminAnnouncementsQueryKeyBase(userId) });
      queryClient.invalidateQueries({ queryKey: announcementQueryKey(userId, announcementId) });
      queryClient.invalidateQueries({ queryKey: ['announcementsByIds', userId] });
      queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryKey(userId) });
      queryClient.invalidateQueries({ queryKey: inboxNotificationsQueryKeyBase(userId) });
    },
  });
}
