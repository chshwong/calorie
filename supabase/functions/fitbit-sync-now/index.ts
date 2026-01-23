import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  corsHeaders,
  extractActivityCaloriesOrThrow,
  fetchFitbitDailyActivity,
  getUserTimeZoneOrUtc,
  jsonResponse,
  nowIso,
  refreshTokens,
  requireUserIdFromAuthHeader,
  supabaseAdminClient,
  dateKeyInTimeZone,
} from '../_shared/fitbit.ts'

const MIN_INTERVAL_MS = 15 * 60 * 1000
const REFRESH_SAFETY_MS = 5 * 60 * 1000

async function markPublicError(params: {
  admin: any
  userId: string
  code: string
  message: string
}) {
  const { admin, userId, code, message } = params
  await admin.from('fitbit_connections_public').update({
    status: 'error',
    last_error_code: code,
    last_error_message: message,
    last_error_at: nowIso(),
  }).eq('user_id', userId)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const userId = await requireUserIdFromAuthHeader(authHeader)
    const admin = supabaseAdminClient()

    const { data: pubRow } = await admin
      .from('fitbit_connections_public')
      .select('user_id,fitbit_user_id,status,last_sync_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (!pubRow) {
      return jsonResponse({ error: 'NOT_CONNECTED' }, { status: 404 })
    }

    const lastSyncAt = (pubRow as any)?.last_sync_at ? new Date((pubRow as any).last_sync_at).getTime() : null
    if (typeof lastSyncAt === 'number' && Number.isFinite(lastSyncAt)) {
      const delta = Date.now() - lastSyncAt
      if (delta >= 0 && delta < MIN_INTERVAL_MS) {
        const retryAfterSeconds = Math.ceil((MIN_INTERVAL_MS - delta) / 1000)
        return jsonResponse({ error: 'RATE_LIMIT', retry_after_seconds: retryAfterSeconds }, { status: 429 })
      }
    }

    const { data: tokenRow, error: tokenErr } = await admin
      .from('fitbit_connections_tokens')
      .select('access_token,refresh_token,expires_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (tokenErr || !tokenRow) {
      await markPublicError({
        admin,
        userId,
        code: 'MISSING_TOKENS',
        message: 'Reconnect Fitbit',
      })
      return jsonResponse({ error: 'MISSING_TOKENS' }, { status: 401 })
    }

    let accessToken = (tokenRow as any).access_token as string
    const refreshToken = (tokenRow as any).refresh_token as string
    const expiresAtMs = new Date((tokenRow as any).expires_at).getTime()

    const needsRefresh = !Number.isFinite(expiresAtMs) || expiresAtMs - Date.now() < REFRESH_SAFETY_MS
    if (needsRefresh) {
      const refreshed = await refreshTokens({ refreshToken })
      accessToken = refreshed.access_token
      const newExpiresAtIso = new Date(Date.now() + Math.max(1, refreshed.expires_in) * 1000).toISOString()
      const { error: upsertErr } = await admin.from('fitbit_connections_tokens').upsert(
        {
          user_id: userId,
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token,
          expires_at: newExpiresAtIso,
        },
        { onConflict: 'user_id' },
      )
      if (upsertErr) throw new Error(`TOKENS_REFRESH_UPSERT_FAILED:${upsertErr.message}`)
    }

    const tz = await getUserTimeZoneOrUtc({ admin, userId })
    const dateKey = dateKeyInTimeZone(new Date(), tz)

    const { res, json } = await fetchFitbitDailyActivity({ accessToken, dateKey })

    // Optional: log response shape for a test user (sanitized; never log tokens)
    const debugUserId = Deno.env.get('FITBIT_DEBUG_USER_ID')
    if (debugUserId && debugUserId === userId) {
      const keys = Object.keys((json as any)?.summary ?? {})
      console.log('fitbit daily summary keys:', keys)
    }

    if (res.status === 401) {
      // Token is invalid/revoked. Force re-connect by removing stored tokens.
      await admin.from('fitbit_connections_tokens').delete().eq('user_id', userId)
      await admin.from('fitbit_connections_public').update({
        status: 'error',
        last_error_code: 'UNAUTHORIZED',
        last_error_message: 'Reconnect Fitbit',
        last_error_at: nowIso(),
      }).eq('user_id', userId)
      return jsonResponse({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    if (!res.ok) {
      await admin.from('fitbit_connections_public').update({
        status: 'error',
        last_error_code: `FITBIT_HTTP_${res.status}`,
        last_error_message: 'Fitbit sync failed',
        last_error_at: nowIso(),
      }).eq('user_id', userId)
      return jsonResponse({ error: 'FITBIT_FETCH_FAILED', status: res.status }, { status: 502 })
    }

    let activityCalories: number
    try {
      activityCalories = extractActivityCaloriesOrThrow(json)
    } catch {
      await admin.from('fitbit_connections_public').update({
        status: 'error',
        last_error_code: 'MISSING_ACTIVITY_CALORIES',
        last_error_message: 'Fitbit payload missing activityCalories',
        last_error_at: nowIso(),
      }).eq('user_id', userId)
      return jsonResponse({ error: 'MISSING_ACTIVITY_CALORIES' }, { status: 502 })
    }

    // Write RAW ONLY + provenance. Never touch final fields or reduction pct.
    const rawLastSyncedAt = nowIso()
    const { data: updated, error: updErr } = await admin
      .from('daily_sum_burned')
      .update({
        raw_burn: activityCalories,
        raw_burn_source: 'fitbit',
        raw_last_synced_at: rawLastSyncedAt,
      })
      .eq('user_id', userId)
      .eq('entry_date', dateKey)
      .select('id')
      .maybeSingle()

    if (updErr || !updated) {
      await admin.from('fitbit_connections_public').update({
        status: 'error',
        last_error_code: 'MISSING_DAILY_ROW',
        last_error_message: 'Open the app once to initialize today before syncing',
        last_error_at: nowIso(),
      }).eq('user_id', userId)
      return jsonResponse({ error: 'MISSING_DAILY_ROW' }, { status: 409 })
    }

    await admin.from('fitbit_connections_public').update({
      status: 'active',
      last_sync_at: rawLastSyncedAt,
      last_error_code: null,
      last_error_message: null,
      last_error_at: null,
    }).eq('user_id', userId)

    return jsonResponse(
      {
        ok: true,
        entry_date: dateKey,
        raw_burn: activityCalories,
        raw_last_synced_at: rawLastSyncedAt,
      },
      { status: 200 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('fitbit-sync-now error:', msg)
    return jsonResponse({ error: 'FITBIT_SYNC_NOW_FAILED', detail: msg }, { status: 400 })
  }
})

