/**
 * React Query hook for fetching active legal documents
 * 
 * Query key: ['legal-documents', 'active']
 * staleTime: 60s, gcTime: 5min (per guidelines section 4.1)
 * 
 * Legal documents change infrequently, so we use a longer staleTime.
 * Documents are public (no user_id needed) and should be cached across sessions.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchActiveLegalDocuments, type LegalDocumentRow } from '@/lib/legal/legal-db';

export function useLegalDocuments() {
  return useQuery<LegalDocumentRow[]>({
    queryKey: ['legal-documents', 'active'],
    queryFn: async () => {
      return await fetchActiveLegalDocuments();
    },
    staleTime: 60 * 1000, // 60 seconds (per guidelines 4.1 minimum)
    gcTime: 5 * 60 * 1000, // 5 minutes (per guidelines 4.1 minimum)
    refetchOnWindowFocus: false,
  });
}

