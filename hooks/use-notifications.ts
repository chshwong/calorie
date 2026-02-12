import { useAuth } from '@/contexts/AuthContext';
import {
    getInboxNotifications,
    getUnreadNotificationCount,
    markAllInboxNotificationsRead,
    markNotificationRead,
    type NotificationCursor,
} from '@/lib/services/notifications';
import type { Notification } from '@/utils/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export type NotificationPage = {
  items: Notification[];
  nextCursor: NotificationCursor | null;
};

export const unreadNotificationCountQueryKey = (userId: string | undefined) => ['unreadNotificationCount', userId];

export const inboxNotificationsQueryKeyBase = (userId: string | undefined) => ['inboxNotifications', userId];

export const inboxNotificationsQueryKey = (
  userId: string | undefined,
  pageSize: number,
  cursor?: NotificationCursor | null
) => ['inboxNotifications', userId, pageSize, cursor?.createdAt ?? null, cursor?.id ?? null];

export function useUnreadNotificationCount() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: unreadNotificationCountQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      return getUnreadNotificationCount(userId);
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useInboxNotifications(params: { pageSize: number; cursor?: NotificationCursor | null }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { pageSize, cursor } = params;

  return useQuery<NotificationPage>({
    queryKey: inboxNotificationsQueryKey(userId, pageSize, cursor),
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      const items = await getInboxNotifications({ userId, pageSize, cursor });
      const lastItem = items[items.length - 1];
      return {
        items,
        nextCursor: lastItem ? { createdAt: lastItem.created_at, id: lastItem.id } : null,
      };
    },
    staleTime: 60 * 1000,
  });
}

export function useMarkNotificationRead() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      return markNotificationRead(notificationId);
    },
    onMutate: async (notificationId) => {
      if (!userId) return undefined;

      const unreadKey = unreadNotificationCountQueryKey(userId);
      const previousUnread = queryClient.getQueryData<number>(unreadKey);

      queryClient.setQueryData<number | undefined>(unreadKey, (current) => {
        if (current === undefined) return current;
        return Math.max(current - 1, 0);
      });

      queryClient.setQueriesData<NotificationPage>(
        { queryKey: inboxNotificationsQueryKeyBase(userId) },
        (current) => {
          if (!current) return current;
          const item = current.items.find((i) => i.id === notificationId);
          const isDeleteOnRead = item?.type === 'friend_request_accepted';
          return {
            ...current,
            items: isDeleteOnRead
              ? current.items.filter((i) => i.id !== notificationId)
              : current.items.map((i) =>
                  i.id === notificationId && !i.read_at
                    ? { ...i, read_at: new Date().toISOString() }
                    : i
                ),
          };
        }
      );

      return { previousUnread };
    },
    onError: (_error, _variables, context) => {
      if (!userId) return;
      const unreadKey = unreadNotificationCountQueryKey(userId);
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(unreadKey, context.previousUnread);
      }
      queryClient.invalidateQueries({ queryKey: inboxNotificationsQueryKeyBase(userId) });
    },
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryKey(userId) });
    },
  });
}

export function useMarkAllInboxNotificationsRead() {
  const { user } = useAuth();
  const userId = user?.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllInboxNotificationsRead,
    onMutate: async () => {
      if (!userId) return undefined;

      const unreadKey = unreadNotificationCountQueryKey(userId);
      const previousUnread = queryClient.getQueryData<number>(unreadKey);

      queryClient.setQueryData<number>(unreadKey, 0);

      queryClient.setQueriesData<NotificationPage>(
        { queryKey: inboxNotificationsQueryKeyBase(userId) },
        (current) => {
          if (!current) return current;
          const now = new Date().toISOString();
          return {
            ...current,
            items: current.items
              .filter((item) => item.type !== 'friend_request_accepted')
              .map((item) => (!item.read_at ? { ...item, read_at: now } : item)),
          };
        }
      );

      return { previousUnread };
    },
    onError: (_error, _variables, context) => {
      if (!userId) return;
      const unreadKey = unreadNotificationCountQueryKey(userId);
      if (context?.previousUnread !== undefined) {
        queryClient.setQueryData(unreadKey, context.previousUnread);
      }
      queryClient.invalidateQueries({ queryKey: inboxNotificationsQueryKeyBase(userId) });
    },
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: unreadNotificationCountQueryKey(userId) });
    },
  });
}
