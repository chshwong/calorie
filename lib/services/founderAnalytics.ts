import { supabase } from '@/lib/supabase';

export type FounderNewUsersSummary = {
  new_today: number;
  new_7d: number;
  new_30d: number;
};

export type FounderDailyGrowthRow = {
  day: string;
  new_users: number;
  deleted_users: number;
  cumulative_users: number;
};

export type FounderCurrentUsage = {
  db_bytes: number;
  storage_bytes: number;
};

export type FounderSettingsRow = {
  id: number;
  slack_webhook_url: string | null;
  digest_email: string | null;
  digest_time_local: string;
  last_digest_sent_for_day: string | null;
  slack_new_user_alerts_enabled: boolean;
  slack_error_alerts_enabled: boolean;
  error_spike_threshold_per_hour: number;
  slack_last_success_at: string | null;
  slack_last_transport_error_at: string | null;
  slack_last_spike_alert_at: string | null;
};

type PlatformLimitRow = {
  platform: 'supabase' | 'vercel';
  limits: Record<string, number>;
  updated_at: string;
};

export type FounderErrorsSummary = {
  errors_1h: number;
  errors_24h: number;
  top_types_24h: { type: string; count: number }[];
};

export type FounderRecentError = {
  created_at: string;
  error_type: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
  user_id: string | null;
};

export type FounderGrowthMomentum = {
  new_7d: number;
  new_prev_7d: number;
  pct_change_7d: number | null;
};

export type FounderSystemHealth = {
  last_digest_sent_for_day: string | null;
  slack_last_success_at: string | null;
  slack_last_transport_error_at: string | null;
  slack_last_spike_alert_at: string | null;
  errors_1h: number;
  db_bytes: number;
  storage_bytes: number;
  latest_event_time: string | null;
};

export async function isFounder(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_founder');
  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[founderAnalytics:isFounder] RPC error:', error);
    }
    return false;
  }
  return data === true;
}

export async function fetchFounderNewUsersSummary(): Promise<FounderNewUsersSummary | null> {
  const { data, error } = await supabase.rpc('rpc_founder_new_users_summary');
  if (error) {
    console.error('[founderAnalytics:summary] RPC error:', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    new_today: Number(row.new_today ?? 0),
    new_7d: Number(row.new_7d ?? 0),
    new_30d: Number(row.new_30d ?? 0),
  };
}

export async function fetchFounderDailyGrowth(daysBack = 60): Promise<FounderDailyGrowthRow[]> {
  const boundedDaysBack = Math.max(1, Math.min(daysBack, 365));
  const { data, error } = await supabase.rpc('rpc_founder_daily_growth', {
    days_back: boundedDaysBack,
  });
  if (error) {
    console.error('[founderAnalytics:growth] RPC error:', error);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    day: String(row.day),
    new_users: Number(row.new_users ?? 0),
    deleted_users: Number(row.deleted_users ?? 0),
    cumulative_users: Number(row.cumulative_users ?? 0),
  }));
}

export async function fetchFounderCurrentUsage(): Promise<FounderCurrentUsage | null> {
  const { data, error } = await supabase.rpc('rpc_founder_current_usage');
  if (error) {
    console.error('[founderAnalytics:usage] RPC error:', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    db_bytes: Number(row.db_bytes ?? 0),
    storage_bytes: Number(row.storage_bytes ?? 0),
  };
}

export async function fetchFounderSettings(): Promise<FounderSettingsRow | null> {
  const { data, error } = await supabase
    .from('founder_settings')
    .select(
      `id,
       slack_webhook_url,
       digest_email,
       digest_time_local,
       last_digest_sent_for_day,
       slack_new_user_alerts_enabled,
       slack_error_alerts_enabled,
       error_spike_threshold_per_hour,
       slack_last_success_at,
       slack_last_transport_error_at,
       slack_last_spike_alert_at`
    )
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.error('[founderAnalytics:settings] Select error:', error);
    return null;
  }
  if (!data) return null;
  return {
    id: Number(data.id),
    slack_webhook_url: data.slack_webhook_url,
    digest_email: data.digest_email,
    digest_time_local: data.digest_time_local ?? '07:00',
    last_digest_sent_for_day: data.last_digest_sent_for_day,
    slack_new_user_alerts_enabled: data.slack_new_user_alerts_enabled === true,
    slack_error_alerts_enabled: data.slack_error_alerts_enabled !== false,
    error_spike_threshold_per_hour: Number(data.error_spike_threshold_per_hour ?? 10),
    slack_last_success_at: data.slack_last_success_at ?? null,
    slack_last_transport_error_at: data.slack_last_transport_error_at ?? null,
    slack_last_spike_alert_at: data.slack_last_spike_alert_at ?? null,
  };
}

export async function saveFounderSettings(params: {
  slackWebhookUrl?: string | null;
  digestEmail?: string | null;
  digestTimeLocal?: string;
  slackNewUserAlertsEnabled?: boolean;
  slackErrorAlertsEnabled?: boolean;
  errorSpikeThresholdPerHour?: number;
}): Promise<boolean> {
  const payload: Record<string, unknown> = {
    id: 1,
    updated_at: new Date().toISOString(),
  };
  if (params.slackWebhookUrl !== undefined) payload.slack_webhook_url = params.slackWebhookUrl;
  if (params.digestEmail !== undefined) payload.digest_email = params.digestEmail;
  if (params.digestTimeLocal !== undefined) payload.digest_time_local = params.digestTimeLocal;
  if (params.slackNewUserAlertsEnabled !== undefined) {
    payload.slack_new_user_alerts_enabled = params.slackNewUserAlertsEnabled;
  }
  if (params.slackErrorAlertsEnabled !== undefined) {
    payload.slack_error_alerts_enabled = params.slackErrorAlertsEnabled;
  }
  if (params.errorSpikeThresholdPerHour !== undefined) {
    payload.error_spike_threshold_per_hour = Math.max(
      1,
      Math.min(10000, Math.trunc(params.errorSpikeThresholdPerHour))
    );
  }

  const { error } = await supabase.from('founder_settings').upsert(payload, {
    onConflict: 'id',
  });

  if (error) {
    console.error('[founderAnalytics:settings] Upsert error:', error);
    return false;
  }
  return true;
}

export async function fetchPlatformLimits(): Promise<PlatformLimitRow[]> {
  const { data, error } = await supabase
    .from('platform_limits')
    .select('platform, limits, updated_at')
    .in('platform', ['supabase', 'vercel']);
  if (error) {
    console.error('[founderAnalytics:platformLimits] Select error:', error);
    return [];
  }
  return (data ?? []) as PlatformLimitRow[];
}

export async function fetchFounderErrorsSummary(): Promise<FounderErrorsSummary | null> {
  const { data, error } = await supabase.rpc('rpc_founder_errors_summary');
  if (error) {
    console.error('[founderAnalytics:errorsSummary] RPC error:', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  const topTypes = Array.isArray(row.top_types_24h)
    ? row.top_types_24h.map((item: any) => ({
        type: String(item?.type ?? 'unknown'),
        count: Number(item?.count ?? 0),
      }))
    : [];
  return {
    errors_1h: Number(row.errors_1h ?? 0),
    errors_24h: Number(row.errors_24h ?? 0),
    top_types_24h: topTypes,
  };
}

export async function fetchFounderErrorsRecent(limitRows = 20): Promise<FounderRecentError[]> {
  const { data, error } = await supabase.rpc('rpc_founder_errors_recent', {
    limit_rows: Math.max(1, Math.min(limitRows, 100)),
  });
  if (error) {
    console.error('[founderAnalytics:errorsRecent] RPC error:', error);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    created_at: String(row.created_at),
    error_type: String(row.error_type ?? 'unknown'),
    severity: (row.severity ?? 'error') as 'info' | 'warn' | 'error',
    message: String(row.message ?? ''),
    user_id: row.user_id ? String(row.user_id) : null,
  }));
}

export async function fetchFounderGrowthMomentum(): Promise<FounderGrowthMomentum | null> {
  const { data, error } = await supabase.rpc('rpc_founder_growth_momentum');
  if (error) {
    console.error('[founderAnalytics:growthMomentum] RPC error:', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    new_7d: Number(row.new_7d ?? 0),
    new_prev_7d: Number(row.new_prev_7d ?? 0),
    pct_change_7d: row.pct_change_7d == null ? null : Number(row.pct_change_7d),
  };
}

export async function fetchFounderSystemHealth(): Promise<FounderSystemHealth | null> {
  const { data, error } = await supabase.rpc('rpc_founder_system_health');
  if (error) {
    console.error('[founderAnalytics:systemHealth] RPC error:', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    last_digest_sent_for_day: row.last_digest_sent_for_day ?? null,
    slack_last_success_at: row.slack_last_success_at ?? null,
    slack_last_transport_error_at: row.slack_last_transport_error_at ?? null,
    slack_last_spike_alert_at: row.slack_last_spike_alert_at ?? null,
    errors_1h: Number(row.errors_1h ?? 0),
    db_bytes: Number(row.db_bytes ?? 0),
    storage_bytes: Number(row.storage_bytes ?? 0),
    latest_event_time: row.latest_event_time ?? null,
  };
}

type LogAppErrorInput = {
  error_type: string;
  severity?: 'info' | 'warn' | 'error';
  message: string;
  meta?: unknown;
  user_id?: string | null;
};

const MAX_ERROR_MESSAGE = 500;
const MAX_META_TEXT = 2000;

function redactSecrets(input: string): string {
  return input
    .replace(/https:\/\/hooks\.slack\.com\/services\/\S+/gi, '[redacted_webhook]')
    .replace(/bearer\s+[a-z0-9._-]+/gi, 'bearer [redacted]')
    .replace(/(token|secret|password|authorization)=([^&\s]+)/gi, '$1=[redacted]');
}

function truncate(input: string, maxLen: number): string {
  if (input.length <= maxLen) return input;
  return `${input.slice(0, maxLen)}...`;
}

function sanitizeMeta(value: unknown): unknown {
  if (value == null) return {};
  try {
    const seen = new WeakSet<object>();
    const walk = (v: any, depth = 0): any => {
      if (depth > 4) return '[truncated_depth]';
      if (v == null) return v;
      if (typeof v === 'string') return truncate(redactSecrets(v), 300);
      if (typeof v === 'number' || typeof v === 'boolean') return v;
      if (Array.isArray(v)) return v.slice(0, 20).map((item) => walk(item, depth + 1));
      if (typeof v === 'object') {
        if (seen.has(v)) return '[circular]';
        seen.add(v);
        const out: Record<string, unknown> = {};
        for (const [rawKey, rawVal] of Object.entries(v)) {
          const key = String(rawKey).toLowerCase();
          if (
            key.includes('token') ||
            key.includes('secret') ||
            key.includes('password') ||
            key.includes('authorization') ||
            key.includes('webhook')
          ) {
            out[rawKey] = '[redacted]';
          } else {
            out[rawKey] = walk(rawVal, depth + 1);
          }
        }
        return out;
      }
      return String(v);
    };
    return walk(value);
  } catch {
    const text = truncate(redactSecrets(String(value)), MAX_META_TEXT);
    return { fallback_meta: text };
  }
}

export async function logAppError(input: LogAppErrorInput): Promise<void> {
  try {
    const message = truncate(redactSecrets(String(input.message ?? 'unknown error')), MAX_ERROR_MESSAGE);
    const payload = {
      error_type: truncate(String(input.error_type || 'unknown'), 64),
      severity: input.severity ?? 'error',
      message,
      meta: sanitizeMeta(input.meta),
      user_id: input.user_id ?? null,
    };
    await supabase.from('app_errors').insert(payload);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[logAppError] failed to record app error', error);
    }
  }
}
