/**
 * DATA ACCESS SERVICE - Support Case Messages
 *
 * Per engineering-guidelines.md:
 * - Components must NOT call Supabase directly
 * - All direct Supabase calls live in this data access layer
 */

import { supabase } from '@/lib/supabase';
import type { SupportCaseMessage, SupportCaseStatus } from '@/utils/types';

const CASE_MESSAGE_COLUMNS = `
  id,
  case_id,
  created_at,
  created_by,
  message,
  is_internal
`;

export async function fetchCaseMessages(params: { caseId: string }): Promise<SupportCaseMessage[]> {
  const { caseId } = params;
  if (!caseId) return [];

  const { data, error } = await supabase
    .from('case_messages')
    .select(CASE_MESSAGE_COLUMNS)
    .eq('case_id', caseId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (error) {
    console.error('Error fetching case messages:', error);
    return [];
  }

  return (data ?? []) as SupportCaseMessage[];
}

export async function adminAddCaseMessage(params: {
  caseId: string;
  message: string;
  isInternal: boolean;
  newStatus?: SupportCaseStatus | null;
}): Promise<void> {
  const { caseId, message, isInternal, newStatus } = params;
  if (!caseId) throw new Error('Case ID is required');
  if (!message?.trim()) throw new Error('Message is required');

  const { error } = await supabase.rpc('admin_add_case_message', {
    p_case_id: caseId,
    p_message: message,
    p_is_internal: isInternal,
    p_new_status: newStatus ?? null,
  });

  if (error) {
    throw new Error(error.message || 'Failed to add case message');
  }
}

