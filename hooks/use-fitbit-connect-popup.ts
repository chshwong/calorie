import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getFitbitConnectionPublic, startFitbitOAuth } from '@/lib/services/fitbit/fitbitConnection';
import { openFitbitConnectPopup } from '@/lib/services/fitbit/openFitbitConnectPopup';

export type FitbitConnectPopupErrorCode =
  | 'popup_blocked'
  | 'timeout'
  | 'closed'
  | 'unsupported'
  | 'connect_failed';

function functionsOriginFromSupabaseUrl(supabaseUrl: string): string {
  const url = new URL(supabaseUrl);
  const host = url.hostname; // e.g. <ref>.supabase.co
  const ref = host.split('.')[0];
  if (!ref) {
    throw new Error('FITBIT_FUNCTIONS_ORIGIN_INVALID');
  }
  return `https://${ref}.functions.supabase.co`;
}

export function useFitbitConnectPopup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  return useMutation({
    mutationFn: async (): Promise<{ ok: true } | { ok: false; errorCode: FitbitConnectPopupErrorCode; message?: string | null }> => {
      if (typeof window === 'undefined') {
        return { ok: false, errorCode: 'unsupported', message: 'Fitbit connect is only supported on web.' };
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        return { ok: false, errorCode: 'connect_failed', message: 'Supabase URL not configured.' };
      }

      const { authorizeUrl } = await startFitbitOAuth();
      const functionsOrigin = functionsOriginFromSupabaseUrl(supabaseUrl);

      const result = await openFitbitConnectPopup(authorizeUrl, {
        functionsOrigin,
        pollConnected: async () => {
          if (!userId) return false;
          const row = await getFitbitConnectionPublic(userId);
          return row?.status === 'active';
        },
      });

      if (result.ok) return { ok: true };
      return { ok: false, errorCode: (result.errorCode as any) ?? 'connect_failed', message: result.message };
    },
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: ['fitbitConnectionPublic', userId] });
    },
  });
}

