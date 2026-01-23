/**
 * DATA ACCESS SERVICE - Notifications
 *
 * Per engineering-guidelines.md:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';
import type { Notification } from '@/utils/types';

const NOTIFICATION_COLUMNS = `
  id,
  created_at,
  user_id,
  type,
  announcement_id,
  link_path,
  read_at,
  meta
`;

export type NotificationCursor = {
  createdAt: string;
  id: string;
};

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!userId) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);

  if (error) {
    console.error('Error fetching unread notification count:', error);
    return 0;
  }

  return count ?? 0;
}

export async function getInboxNotifications(params: {
  userId: string;
  pageSize: number;
  cursor?: NotificationCursor | null;
}): Promise<Notification[]> {
  const { userId, pageSize, cursor } = params;
  if (!userId || pageSize <= 0) return [];

  let query = supabase
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching inbox notifications:', error);
    return [];
  }

  return (data ?? []) as Notification[];
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!notificationId) {
    throw new Error('Notification ID is required');
  }

  const { error } = await supabase.rpc('mark_notification_read', {
    notification_id: notificationId,
  });

  if (error) {
    throw new Error(error.message || 'Failed to mark notification as read');
  }
}
