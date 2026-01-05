import { supabase } from '@/lib/supabase';
import {
  getLocalActiveLegalDocuments,
  type LegalDocument,
  type LegalDocType,
} from '@/legal/legal-documents';

export type UserLegalAcceptance = {
  docType: LegalDocType;
  version: string;
  acceptedAt: string;
};

type RemoteLegalDocumentRow = {
  doc_type: string;
  version: string;
  title: string;
  content_md: string;
  is_active?: boolean;
};

function mapRemoteDoc(row: RemoteLegalDocumentRow): LegalDocument | null {
  if (!row?.doc_type || !row?.version || !row?.title || !row?.content_md) {
    return null;
  }

  return {
    docType: row.doc_type as LegalDocType,
    version: row.version,
    title: row.title,
    contentMd: row.content_md,
    isActive: row.is_active ?? true,
  };
}

/**
 * Fetch active legal documents from Supabase.
 * Falls back to local bundled documents if none are active or on error.
 */
export async function getActiveLegalDocuments(): Promise<LegalDocument[]> {
  try {
    const { data, error } = await supabase
      .from('legal_documents')
      .select('doc_type, version, title, content_md, is_active')
      .eq('is_active', true);

    if (error) {
      console.error('[legal] Failed to fetch active legal documents:', error.message || error);
    }

    if (data && data.length > 0) {
      const mapped = data
        .map(mapRemoteDoc)
        .filter((doc): doc is LegalDocument => Boolean(doc && doc.isActive));

      if (mapped.length > 0) {
        return mapped;
      }
    }
  } catch (err) {
    console.error('[legal] Exception while fetching legal documents:', err);
  }

  return getLocalActiveLegalDocuments();
}

/**
 * Fetch user legal acceptances ordered by newest first.
 */
export async function getUserLegalAcceptances(userId: string): Promise<UserLegalAcceptance[]> {
  if (!userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('user_legal_acceptances')
      .select('doc_type, version, accepted_at')
      .eq('user_id', userId)
      .order('accepted_at', { ascending: false });

    if (error) {
      console.error('[legal] Failed to fetch user legal acceptances:', error.message || error);
      return [];
    }

    return (data || []).map((row) => ({
      docType: row.doc_type as LegalDocType,
      version: row.version,
      acceptedAt: row.accepted_at,
    }));
  } catch (err) {
    console.error('[legal] Exception while fetching user legal acceptances:', err);
    return [];
  }
}

/**
 * Reduce acceptances to latest by doc_type.
 */
export function getLatestAcceptancesMap(
  acceptances: UserLegalAcceptance[]
): Record<LegalDocType, UserLegalAcceptance> {
  return acceptances.reduce<Record<LegalDocType, UserLegalAcceptance>>((acc, curr) => {
    if (!curr?.docType) return acc;
    const existing = acc[curr.docType];
    if (!existing) {
      acc[curr.docType] = curr;
    } else if (new Date(curr.acceptedAt).getTime() > new Date(existing.acceptedAt).getTime()) {
      acc[curr.docType] = curr;
    }
    return acc;
  }, {} as Record<LegalDocType, UserLegalAcceptance>);
}

/**
 * Insert acceptance rows for the provided documents.
 */
export async function insertUserLegalAcceptances(
  userId: string,
  documents: LegalDocument[]
): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required to insert legal acceptances');
  }

  if (!documents.length) {
    return;
  }

  const rows = documents.map((doc) => ({
    user_id: userId,
    doc_type: doc.docType,
    version: doc.version,
  }));

  const { error } = await supabase.from('user_legal_acceptances').insert(rows);

  if (error) {
    console.error('[legal] Failed to insert user legal acceptances:', error.message || error);
    throw error;
  }
}





