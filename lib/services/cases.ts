/**
 * DATA ACCESS SERVICE - Support Cases
 *
 * Per engineering-guidelines.md:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';
import type { SupportCase, SupportCaseCategory, SupportCaseStatus } from '@/utils/types';
import {
  mapCreateCaseRpcErrorToKind,
  type SupportSubmitError,
  type SupportSubmitErrorKind,
} from '@/lib/services/supportSubmitErrors';

const CASE_COLUMNS = `
  id,
  created_at,
  updated_at,
  created_by,
  category,
  subject,
  message,
  status,
  resolved_at,
  page_path,
  user_agent,
  app_version,
  fingerprint
`;

export type CaseCursor = {
  createdAt: string;
  id: string;
};

export async function createCase(params: {
  category: SupportCaseCategory;
  subject?: string | null;
  message: string;
  pagePath?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
}): Promise<string> {
  const { category, subject, message, pagePath, userAgent, appVersion } = params;

  const { data, error } = await supabase.rpc('create_case', {
    p_category: category,
    p_subject: subject ?? null,
    p_message: message,
    p_page_path: pagePath ?? null,
    p_user_agent: userAgent ?? null,
    p_app_version: appVersion ?? null,
  });

  if (error) {
    const kind: SupportSubmitErrorKind = mapCreateCaseRpcErrorToKind(error);
    if (process.env.NODE_ENV !== 'production') {
      // Dev-only: log raw error for debugging (never show this to users)
      // eslint-disable-next-line no-console
      console.warn('[createCase] create_case RPC failed:', error);
    }
    const out: SupportSubmitError = { kind, raw: error };
    throw out;
  }

  if (!data) {
    const out: SupportSubmitError = { kind: 'unknown', raw: { message: 'No case ID returned' } };
    throw out;
  }

  return String(data);
}

export async function fetchMyCases(params: {
  userId: string;
  pageSize: number;
  cursor?: CaseCursor | null;
}): Promise<SupportCase[]> {
  const { userId, pageSize, cursor } = params;
  if (!userId || pageSize <= 0) return [];

  let query = supabase
    .from('cases')
    .select(CASE_COLUMNS)
    .eq('created_by', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize);

  if (cursor) {
    query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching my cases:', error);
    return [];
  }

  return (data ?? []) as SupportCase[];
}

export async function fetchAdminCases(params: {
  pageSize: number;
  cursor?: CaseCursor | null;
  status?: SupportCaseStatus | 'all';
  category?: SupportCaseCategory | 'all';
}): Promise<SupportCase[]> {
  const { pageSize, cursor, status, category } = params;
  if (pageSize <= 0) return [];

  let query = supabase
    .from('cases')
    .select(CASE_COLUMNS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(pageSize);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  if (cursor) {
    query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching admin cases:', error);
    return [];
  }

  return (data ?? []) as SupportCase[];
}

export async function fetchCaseById(params: { id: string }): Promise<SupportCase | null> {
  const { id } = params;
  if (!id) return null;

  const { data, error } = await supabase.from('cases').select(CASE_COLUMNS).eq('id', id).single<SupportCase>();

  if (error) {
    console.error('Error fetching case by id:', error);
    return null;
  }

  return data ?? null;
}

export async function adminUpdateCaseStatus(params: { caseId: string; status: SupportCaseStatus }): Promise<void> {
  const { caseId, status } = params;
  if (!caseId) throw new Error('Case ID is required');

  const resolved_at = status === 'resolved' ? new Date().toISOString() : null;

  const { error } = await supabase
    .from('cases')
    .update({
      status,
      resolved_at,
    })
    .eq('id', caseId);

  if (error) {
    throw new Error(error.message || 'Failed to update case status');
  }
}

