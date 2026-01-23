import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import type { Notification } from '@/utils/types';
import {
  getInboxNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  type NotificationCursor,
} from '@/lib/services/notifications';

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
          return {
            ...current,
            items: current.items.map((item) =>
              item.id === notificationId && !item.read_at
                ? { ...item, read_at: new Date().toISOString() }
                : item
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
