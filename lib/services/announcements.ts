/**
 * DATA ACCESS SERVICE - Announcements
 *
 * Per engineering-guidelines.md:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';
import type { Announcement } from '@/utils/types';
import { ANNOUNCEMENTS } from '@/constants/constraints';

const ANNOUNCEMENT_COLUMNS = `
  id,
  created_at,
  updated_at,
  created_by,
  published_at,
  is_published,
  title_i18n,
  body_i18n,
  link_path,
  image_paths
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
    image_paths?: unknown;
  };
}): Promise<Announcement> {
  const { id, updates } = params;

  const { data, error } = await supabase
    .from('announcements')
    .update({
      ...updates,
      // Normalize when updating via draft editor path (keeps DB + clients consistent)
      image_paths:
        updates.image_paths !== undefined
          ? normalizeAndValidateImagePaths({ announcementId: id, imagePaths: updates.image_paths })
          : undefined,
    })
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

// ============================================================================
// Announcement images (admin-only writes; public read URLs)
// ============================================================================

const ANNOUNCEMENT_IMAGES_BUCKET = 'announcement-images';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function fileToBytes(file: File): Promise<Uint8Array> {
  const ab = await file.arrayBuffer();
  return new Uint8Array(ab);
}

function normalizeAndValidateImagePaths(params: {
  announcementId: string;
  imagePaths: unknown;
}): string[] | null {
  const { announcementId, imagePaths } = params;

  if (imagePaths == null) return null;
  if (!Array.isArray(imagePaths)) {
    throw new Error('settings.admin.images_invalid_paths');
  }

  const paths = imagePaths as unknown[];
  if (paths.length > ANNOUNCEMENTS.IMAGES.MAX_COUNT) {
    throw new Error('settings.admin.images_too_many');
  }

  const prefix = `announcements/${announcementId}/`;
  const out: string[] = [];
  for (const p of paths) {
    if (typeof p !== 'string') {
      throw new Error('settings.admin.images_invalid_paths');
    }
    if (!p.startsWith(prefix)) {
      throw new Error('settings.admin.images_invalid_paths');
    }
    out.push(p);
  }

  return out;
}

export async function uploadAnnouncementImage(params: {
  announcementId: string;
  file: File;
  contentType: string;
}): Promise<{ storagePath: string }> {
  const { announcementId, file, contentType } = params;
  if (!announcementId) throw new Error('Announcement ID is required');

  const uuid = generateUuid();
  const storagePath = `announcements/${announcementId}/${uuid}.jpg`;
  const bytes = await fileToBytes(file);

  const { error } = await supabase.storage.from(ANNOUNCEMENT_IMAGES_BUCKET).upload(storagePath, bytes, {
    contentType,
    upsert: false,
    cacheControl: '3600',
  });

  if (error) {
    throw new Error(error.message || 'Failed to upload announcement image');
  }

  return { storagePath };
}

export async function deleteAnnouncementImage(params: { storagePath: string }): Promise<void> {
  const { storagePath } = params;
  if (!storagePath) return;

  const { error } = await supabase.storage.from(ANNOUNCEMENT_IMAGES_BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(error.message || 'Failed to delete announcement image');
  }
}

export async function updateAnnouncementImages(params: {
  announcementId: string;
  imagePaths: unknown;
}): Promise<Announcement> {
  const { announcementId, imagePaths } = params;
  if (!announcementId) throw new Error('Announcement ID is required');

  const normalized = normalizeAndValidateImagePaths({ announcementId, imagePaths });

  const { data, error } = await supabase
    .from('announcements')
    .update({ image_paths: normalized && normalized.length > 0 ? normalized : null })
    .eq('id', announcementId)
    .select(ANNOUNCEMENT_COLUMNS)
    .single<Announcement>();

  if (error) {
    throw new Error(error.message || 'Failed to update announcement images');
  }

  if (!data) {
    throw new Error('No announcement returned');
  }

  return data;
}

export function getAnnouncementImagePublicUrl(storagePath: string): string {
  if (!storagePath) return '';
  const { data } = supabase.storage.from(ANNOUNCEMENT_IMAGES_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl ?? '';
}

// ============================================================================
// Announcement delete (admin-only)
// ============================================================================

export type DeleteAnnouncementResult = {
  imageDeleteFailed: boolean;
};

export async function deleteAnnouncement(announcementId: string): Promise<DeleteAnnouncementResult> {
  if (!announcementId) throw new Error('Announcement ID is required');

  // 1) Fetch minimal data needed for storage cleanup
  const { data: row, error: fetchError } = await supabase
    .from('announcements')
    .select('id,is_published,image_paths')
    .eq('id', announcementId)
    .single<Pick<Announcement, 'id' | 'is_published' | 'image_paths'>>();

  if (fetchError) {
    throw new Error(fetchError.message || 'Failed to fetch announcement');
  }

  const paths = Array.isArray(row?.image_paths)
    ? row.image_paths.filter((x): x is string => typeof x === 'string')
    : [];

  // 2) Delete storage objects (best-effort; continue on failure)
  let imageDeleteFailed = false;
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from(ANNOUNCEMENT_IMAGES_BUCKET).remove(paths);
    if (storageError) {
      imageDeleteFailed = true;
      console.warn('[deleteAnnouncement] Failed to delete some announcement images:', storageError);
    }
  }

  // 3) Delete announcement row (notifications cleanup via FK ON DELETE CASCADE)
  const { error: deleteError } = await supabase.from('announcements').delete().eq('id', announcementId);
  if (deleteError) {
    throw new Error(deleteError.message || 'Failed to delete announcement');
  }

  return { imageDeleteFailed };
}
