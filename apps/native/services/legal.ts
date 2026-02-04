import { supabase } from "@/lib/supabaseClient";
import {
  getLocalActiveLegalDocuments,
  type LegalDocument,
  type LegalDocType,
} from "../../../legal/legal-documents";

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

export async function getActiveLegalDocuments(): Promise<LegalDocument[]> {
  try {
    const { data, error } = await supabase
      .from("legal_documents")
      .select("doc_type, version, title, content_md, is_active")
      .eq("is_active", true);

    if (error) {
      console.error("[legal] Failed to fetch active legal documents:", error.message || error);
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
    console.error("[legal] Exception while fetching legal documents:", err);
  }

  return getLocalActiveLegalDocuments();
}
