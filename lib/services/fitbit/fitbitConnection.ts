import { supabase } from '@/lib/supabase';
import type { FitbitConnectionPublic } from '@/utils/types';

export const FITBIT_CONNECTION_PUBLIC_COLUMNS = `
  user_id,
  fitbit_user_id,
  scopes,
  status,
  last_sync_at,
  last_weight_sync_at,
  last_steps_sync_at,
  last_error_code,
  last_error_message,
  last_error_at,
  created_at,
  updated_at
`;

/** Columns without last_steps_sync_at (DB not yet migrated). */
export const FITBIT_CONNECTION_PUBLIC_COLUMNS_NO_STEPS = `
  user_id,
  fitbit_user_id,
  scopes,
  status,
  last_sync_at,
  last_weight_sync_at,
  last_error_code,
  last_error_message,
  last_error_at,
  created_at,
  updated_at
`;

export const FITBIT_CONNECTION_PUBLIC_COLUMNS_LEGACY = `
  user_id,
  fitbit_user_id,
  scopes,
  status,
  last_sync_at,
  last_error_code,
  last_error_message,
  last_error_at,
  created_at,
  updated_at
`;

export async function getFitbitConnectionPublic(userId: string): Promise<FitbitConnectionPublic | null> {
  if (!userId) return null;
  // Backward compatible: if the DB hasn't been migrated yet (missing last_weight_sync_at),
  // retry with the legacy select list instead of treating it as "not connected".
  const trySelect = async (columns: string) => {
    return await supabase.from('fitbit_connections_public').select(columns).eq('user_id', userId).maybeSingle();
  };
  let { data, error } = await trySelect(FITBIT_CONNECTION_PUBLIC_COLUMNS);
  if (error && typeof (error as any)?.message === 'string' && (error as any).message.toLowerCase().includes('last_weight_sync_at')) {
    ({ data, error } = await trySelect(FITBIT_CONNECTION_PUBLIC_COLUMNS_LEGACY));
  }
  if (error && typeof (error as any)?.message === 'string' && (error as any).message.toLowerCase().includes('last_steps_sync_at')) {
    ({ data, error } = await trySelect(FITBIT_CONNECTION_PUBLIC_COLUMNS_NO_STEPS));
  }

  if (error) {
    // Do not throw; callers treat null as "not connected" or "unavailable".
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching fitbit connection public:', error);
    }
    return null;
  }

  return (data as FitbitConnectionPublic) ?? null;
}

async function requireSessionAccessToken(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('No session token available');
  return token;
}

function requireSupabaseUrl(): string {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Supabase URL not configured');
  return supabaseUrl;
}

export async function startFitbitOAuth(): Promise<{ authorizeUrl: string }> {
  const supabaseUrl = requireSupabaseUrl();
  const token = await requireSessionAccessToken();

  const res = await fetch(`${supabaseUrl}/functions/v1/fitbit-start`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || typeof json?.authorizeUrl !== 'string') {
    throw new Error(json?.error || 'FITBIT_START_FAILED');
  }

  return { authorizeUrl: json.authorizeUrl as string };
}

export type SyncFitbitNowResult = {
  ok?: true;
  raw_last_synced_at?: string;
  /** Best-effort for today's sync only (wearable total calories burned). */
  raw_tdee?: number;
  /** Legacy: best-effort for today's sync only (deprecated). */
  raw_burn?: number;
  /** Best-effort for today's sync only. */
  entry_date?: string;
  /** Burned sync can return multiple dates (today..today-6). */
  synced_dates?: string[];
  /** Dates skipped because daily_sum_burned row didn't exist (canonical). */
  skipped_missing_row?: string[];
  /** Legacy field name (server may still return this). */
  skipped_missing_daily_row_dates?: string[];
};

export async function syncFitbitNow(): Promise<SyncFitbitNowResult> {
  const supabaseUrl = requireSupabaseUrl();
  const token = await requireSessionAccessToken();

  const res = await fetch(`${supabaseUrl}/functions/v1/fitbit-sync-now`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = typeof json?.error === 'string' ? json.error : 'FITBIT_SYNC_FAILED';
    throw new Error(code);
  }

  return json as SyncFitbitNowResult;
}

export async function syncFitbitWeightNow(): Promise<{ ok: true; processed?: number; inserted?: number; updated_existing?: number; updated_capped?: number }> {
  const supabaseUrl = requireSupabaseUrl();
  const token = await requireSessionAccessToken();

  const res = await fetch(`${supabaseUrl}/functions/v1/fitbit-sync-weight`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = typeof json?.error === 'string' ? json.error : 'FITBIT_WEIGHT_SYNC_FAILED';
    throw new Error(code);
  }

  return json as any;
}

export type SyncFitbitStepsResult = { ok: true; synced_dates?: string[] };

export async function syncFitbitStepsNow(): Promise<SyncFitbitStepsResult> {
  const supabaseUrl = requireSupabaseUrl();
  const token = await requireSessionAccessToken();

  const res = await fetch(`${supabaseUrl}/functions/v1/fitbit-sync-steps`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = typeof json?.error === 'string' ? json.error : 'FITBIT_STEPS_SYNC_FAILED';
    throw new Error(code);
  }

  return json as SyncFitbitStepsResult;
}

export async function disconnectFitbit(): Promise<void> {
  const supabaseUrl = requireSupabaseUrl();
  const token = await requireSessionAccessToken();

  const res = await fetch(`${supabaseUrl}/functions/v1/fitbit-disconnect`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok !== true) {
    throw new Error(json?.error || 'FITBIT_DISCONNECT_FAILED');
  }
}

