/**
 * DATA ACCESS SERVICE - Announcements
 *
 * Per engineering-guidelines.md:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';
import type { Announcement } from '@/utils/types';

const ANNOUNCEMENT_COLUMNS = `
  id,
  created_at,
  updated_at,
  created_by,
  published_at,
  is_published,
  title_i18n,
  body_i18n,
  link_path
`;

export type AnnouncementCursor = {
  updatedAt: string;
  id: string;
};

export type AnnouncementNotificationStats = {
  announcement_id: string;
  total: number;
  read: number;
};

export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  if (!id) return null;

  const { data, error } = await supabase
    .from('announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .eq('id', id)
    .single<Announcement>();

  if (error) {
    console.error('Error fetching announcement:', error);
    return null;
  }

  return data ?? null;
}

export async function getAnnouncementsByIds(ids: string[]): Promise<Announcement[]> {
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .in('id', ids);

  if (error) {
    console.error('Error fetching announcements by IDs:', error);
    return [];
  }

  return (data ?? []) as Announcement[];
}

export async function getAdminAnnouncements(params: {
  pageSize: number;
  cursor?: AnnouncementCursor | null;
}): Promise<Announcement[]> {
  const { pageSize, cursor } = params;
  if (pageSize <= 0) return [];

  let query = supabase
    .from('announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize);

  if (cursor) {
    query = query.or(
      `updated_at.lt.${cursor.updatedAt},and(updated_at.eq.${cursor.updatedAt},id.lt.${cursor.id})`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching admin announcements:', error);
    return [];
  }

  return (data ?? []) as Announcement[];
}

export async function getAnnouncementNotificationStats(ids: string[]): Promise<AnnouncementNotificationStats[]> {
  if (!ids.length) return [];

  const { data, error } = await supabase.rpc('get_announcement_notification_stats', {
    p_announcement_ids: ids,
  });

  if (error) {
    console.error('Error fetching announcement notification stats:', error);
    return [];
  }

  return (data ?? []) as AnnouncementNotificationStats[];
}

export async function createAnnouncementDraft(params: {
  title_i18n: Record<string, string>;
  body_i18n: Record<string, string>;
  link_path?: string | null;
}): Promise<Announcement> {
  const { title_i18n, body_i18n, link_path } = params;

  const { data, error } = await supabase
    .from('announcements')
    .insert({
      title_i18n,
      body_i18n,
      link_path: link_path ?? null,
      is_published: false,
      published_at: null,
    })
    .select(ANNOUNCEMENT_COLUMNS)
    .single<Announcement>();

  if (error) {
    throw new Error(error.message || 'Failed to create announcement draft');
  }

  if (!data) {
    throw new Error('No announcement returned');
  }

  return data;
}

export async function updateAnnouncementDraft(params: {
  id: string;
  updates: {
    title_i18n?: Record<string, string>;
    body_i18n?: Record<string, string>;
    link_path?: string | null;
  };
}): Promise<Announcement> {
  const { id, updates } = params;

  const { data, error } = await supabase
    .from('announcements')
    .update(updates)
    .eq('id', id)
    .select(ANNOUNCEMENT_COLUMNS)
    .single<Announcement>();

  if (error) {
    throw new Error(error.message || 'Failed to update announcement draft');
  }

  if (!data) {
    throw new Error('No announcement returned');
  }

  return data;
}

export async function publishAnnouncement(id: string): Promise<void> {
  if (!id) {
    throw new Error('Announcement ID is required');
  }

  const { error } = await supabase.rpc('publish_announcement', {
    p_announcement_id: id,
  });

  if (error) {
    throw new Error(error.message || 'Failed to publish announcement');
  }
}
