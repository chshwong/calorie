/**
 * DATA ACCESS SERVICE - Support Case Attachments
 *
 * Per engineering-guidelines.md:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import type { SupportCaseAttachment } from '@/utils/types';

const CASE_ATTACHMENT_COLUMNS = `
  id,
  case_id,
  created_at,
  created_by,
  storage_path,
  bytes,
  content_type,
  width,
  height
`;

function generateId(): string {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function getFileBytesFromWebFile(file: File): Promise<Uint8Array> {
  const ab = await file.arrayBuffer();
  return new Uint8Array(ab);
}

function base64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getFileBytesFromUri(uri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToUint8Array(base64);
}

export async function uploadCaseAttachment(params: {
  userId: string;
  caseId: string;
  file: File;
  contentType: string;
}): Promise<{ storagePath: string }> {
  const { userId, caseId, file, contentType } = params;
  if (!userId) throw new Error('User ID is required');
  if (!caseId) throw new Error('Case ID is required');

  const ext = 'jpg';
  const storagePath = `${userId}/${caseId}/${generateId()}.${ext}`;

  const bytes =
    Platform.OS === 'web' ? await getFileBytesFromWebFile(file) : await getFileBytesFromUri((file as any).uri ?? '');

  const { error } = await supabase.storage.from('case-attachments').upload(storagePath, bytes, {
    contentType,
    upsert: false,
    cacheControl: '3600',
  });

  if (error) {
    throw new Error(error.message || 'Failed to upload attachment');
  }

  return { storagePath };
}

export async function insertCaseAttachmentRow(params: {
  caseId: string;
  createdBy: string;
  storagePath: string;
  bytes?: number | null;
  contentType?: string | null;
  width?: number | null;
  height?: number | null;
}): Promise<SupportCaseAttachment> {
  const { caseId, createdBy, storagePath, bytes, contentType, width, height } = params;

  const { data, error } = await supabase
    .from('case_attachments')
    .insert({
      case_id: caseId,
      created_by: createdBy,
      storage_path: storagePath,
      bytes: bytes ?? null,
      content_type: contentType ?? null,
      width: width ?? null,
      height: height ?? null,
    })
    .select(CASE_ATTACHMENT_COLUMNS)
    .single<SupportCaseAttachment>();

  if (error) {
    throw new Error(error.message || 'Failed to create attachment row');
  }

  if (!data) {
    throw new Error('No attachment row returned');
  }

  return data;
}

export async function fetchCaseAttachments(params: { caseId: string }): Promise<SupportCaseAttachment[]> {
  const { caseId } = params;
  if (!caseId) return [];

  const { data, error } = await supabase
    .from('case_attachments')
    .select(CASE_ATTACHMENT_COLUMNS)
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching case attachments:', error);
    return [];
  }

  return (data ?? []) as SupportCaseAttachment[];
}

export async function getSignedAttachmentUrl(params: { storagePath: string; expiresInSeconds?: number }): Promise<string | null> {
  const { storagePath, expiresInSeconds } = params;
  if (!storagePath) return null;

  const { data, error } = await supabase.storage
    .from('case-attachments')
    .createSignedUrl(storagePath, expiresInSeconds ?? 60 * 60);

  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }

  return data?.signedUrl ?? null;
}

