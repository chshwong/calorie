import { supabase } from '@/lib/supabase';

export type LegalDocType = 'terms' | 'privacy' | 'health_disclaimer';

export type LegalDocumentRow = {
  doc_type: LegalDocType;
  version: string;
  title: string;
  content_md: string;
  is_active: boolean;
};

export async function fetchActiveLegalDocuments(): Promise<LegalDocumentRow[]> {
  const { data, error } = await supabase
    .from('legal_documents')
    .select('doc_type, version, title, content_md, is_active')
    .eq('is_active', true);

  if (error) throw error;

  // Stable ordering for UI
  const order: Record<LegalDocType, number> = {
    terms: 1,
    privacy: 2,
    health_disclaimer: 3,
  };

  return (data ?? [])
    .filter((d): d is LegalDocumentRow => Boolean(d?.doc_type))
    .sort((a, b) => (order[a.doc_type] ?? 99) - (order[b.doc_type] ?? 99));
}

export async function acceptActiveLegalDocuments(params: {
    userId: string;
    docs: Array<Pick<LegalDocumentRow, 'doc_type' | 'version'>>;
  }) {
    // Insert one row per doc into user_legal_acceptances
    // Assumes your table has columns: user_id, doc_type, version, accepted_at (accepted_at default now())
    const rows = params.docs.map((d) => ({
      user_id: params.userId,
      doc_type: d.doc_type,
      version: d.version,
    }));
  
    const { error } = await supabase.from('user_legal_acceptances').insert(rows);
    if (error) throw error;
  }
  