import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
    corsHeaders,
    dateKeyInTimeZone,
    extractCaloriesOutOrThrow,
    fetchFitbitDailyActivity,
    getUserTimeZoneOrUtc,
    jsonResponse,
    nowIso,
    refreshTokens,
    requireUserIdFromAuthHeader,
    supabaseAdminClient,
} from '../_shared/fitbit.ts'

const MIN_INTERVAL_MS = 15 * 60 * 1000
const REFRESH_SAFETY_MS = 5 * 60 * 1000
const MINUTES_PER_DAY = 24 * 60

function minutesSinceLocalMidnightInTimeZone(date: Date, timeZone: string): number {
  // Use Intl parts to compute local clock time in the provided IANA timezone.
  // This avoids doing timezone math manually.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = fmt.formatToParts(date)
  const hh = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10)
  const mm = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10)
  const minutes = hh * 60 + mm
  if (!Number.isFinite(minutes)) return 0
  return Math.max(0, Math.min(MINUTES_PER_DAY, minutes))
}

function parseDateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`)
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = parseDateKeyToUtcDate(dateKey)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

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

    const tz = await getUserTimeZoneOrUtc({ admin, userId })
    const todayKey = dateKeyInTimeZone(new Date(), tz)
    const dateKeys: string[] = []
    for (let i = 0; i < 7; i++) dateKeys.push(addDaysToDateKey(todayKey, -i))

    // Gate: Calories sync is enabled unless explicitly set to false.
    const { data: prefRow, error: prefErr } = await admin
      .from('profiles')
      .select('sync_activity_burn')
      .eq('user_id', userId)
      .maybeSingle()
    if (prefErr) throw new Error(`PROFILE_PREF_SELECT_FAILED:${prefErr.message}`)
    const syncOn = (prefRow as any)?.sync_activity_burn !== false
    if (!syncOn) {
      console.log(JSON.stringify({ event: 'fitbit_burn_total_sync_skipped', user_id: userId, reason: 'toggle_off' }))
      return jsonResponse({ ok: true, synced_dates: [], skipped_missing_row: [] }, { status: 200 })
    }

    // If there are no burned rows for the last 7 days, skip without rate limiting or Fitbit calls.
    const { data: burnedRows, error: burnedErr } = await admin
      .from('daily_sum_burned')
      .select('id,entry_date,system_bmr_cal,burn_reduction_pct_int')
      .eq('user_id', userId)
      .in('entry_date', dateKeys)
    if (burnedErr) throw new Error(`DAILY_SUM_BURNED_SELECT_FAILED:${burnedErr.message}`)

    const byDate = new Map<string, any>()
    for (const r of Array.isArray(burnedRows) ? burnedRows : []) {
      const k = typeof (r as any)?.entry_date === 'string' ? (r as any).entry_date : null
      if (!k) continue
      byDate.set(k, r)
    }

    if (byDate.size === 0) {
      return jsonResponse(
        {
          ok: true,
          synced_dates: [],
          skipped_missing_row: dateKeys,
        },
        { status: 200 },
      )
    }

    // Throttle only when there is at least one row that could be updated.
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

    // Optional: log response shape for a test user (sanitized; never log tokens)
    const debugUserId = Deno.env.get('FITBIT_DEBUG_USER_ID')
    const shouldDebug = Boolean(debugUserId && debugUserId === userId)

    const rawLastSyncedAt = nowIso()
    const syncedDates: string[] = []
    const skippedMissingRow: string[] = []
    let todayCaloriesOut: number | null = null

    for (const dateKey of dateKeys) {
      const burnedRow = byDate.get(dateKey) ?? null
      if (!burnedRow) {
        skippedMissingRow.push(dateKey)
        console.log(
          JSON.stringify({
            event: 'fitbit_burn_total_sync',
            user_id: userId,
            dateKey,
            caloriesOut: null,
            wrote_row: false,
            reason: 'missing_daily_sum_burned',
          }),
        )
        continue
      }

      const { res, json } = await fetchFitbitDailyActivity({ accessToken, dateKey })

      if (shouldDebug && dateKey === todayKey) {
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

      let caloriesOut: number
      try {
        caloriesOut = extractCaloriesOutOrThrow(json)
      } catch {
        await admin.from('fitbit_connections_public').update({
          status: 'error',
          last_error_code: 'MISSING_TOTAL_CALORIES',
          last_error_message: 'Fitbit payload missing caloriesOut',
          last_error_at: nowIso(),
        }).eq('user_id', userId)
        return jsonResponse({ error: 'MISSING_TOTAL_CALORIES' }, { status: 502 })
      }

      const systemBmrFullDay = typeof (burnedRow as any)?.system_bmr_cal === 'number' ? (burnedRow as any).system_bmr_cal : 0
      const pct = typeof (burnedRow as any)?.burn_reduction_pct_int === 'number' ? Math.trunc((burnedRow as any).burn_reduction_pct_int) : 0
      const clampedPct = Math.max(0, Math.min(50, pct))
      const factor = 1 - clampedPct / 100
      const progress = dateKey === todayKey ? minutesSinceLocalMidnightInTimeZone(new Date(), tz) / MINUTES_PER_DAY : 1
      const bmrSoFar = Math.round(systemBmrFullDay * Math.max(0, Math.min(1, progress)))
      const bmr = Math.min(bmrSoFar, caloriesOut)
      const rawBurnBaseline = Math.max(0, caloriesOut - bmr)
      const finalActive = Math.round(rawBurnBaseline * factor)
      const finalTdee = Math.round(bmr + finalActive)

      // Write authoritative finals + raw provenance (existing rows only).
      const { data: updated, error: updErr } = await admin
        .from('daily_sum_burned')
        .update({
          bmr_cal: bmr,
          active_cal: finalActive,
          tdee_cal: finalTdee,

          // raw_tdee stores Fitbit TOTAL calories burned (caloriesOut).
          raw_tdee: caloriesOut,
          // raw_burn stores activity remainder baseline (raw_tdee - derived_bmr) BEFORE correction %.
          raw_burn: rawBurnBaseline,
          raw_burn_source: 'fitbit',
          raw_last_synced_at: rawLastSyncedAt,

          bmr_overridden: true,
          active_overridden: true,
          tdee_overridden: true,
          is_overridden: true,

          source: 'fitbit',
        })
        .eq('user_id', userId)
        .eq('entry_date', dateKey)
        .select('id')
        .maybeSingle()

      if (updErr) {
        await admin.from('fitbit_connections_public').update({
          status: 'error',
          last_error_code: 'DAILY_SUM_BURNED_UPDATE_FAILED',
          last_error_message: updErr.message,
          last_error_at: nowIso(),
        }).eq('user_id', userId)
        return jsonResponse({ error: 'DAILY_SUM_BURNED_UPDATE_FAILED' }, { status: 500 })
      }

      if (!updated) {
        skippedMissingRow.push(dateKey)
        console.log(
          JSON.stringify({
            event: 'fitbit_burn_total_sync',
            user_id: userId,
            dateKey,
            caloriesOut,
            wrote_row: false,
            reason: 'missing_daily_sum_burned',
          }),
        )
        continue
      }

      if (dateKey === todayKey) {
        todayCaloriesOut = caloriesOut
      }
      syncedDates.push(dateKey)
      console.log(JSON.stringify({ event: 'fitbit_burn_total_sync', user_id: userId, dateKey, caloriesOut, wrote_row: true }))
    }

    // Only mark successful sync when we actually updated at least one date.
    if (syncedDates.length > 0) {
      await admin.from('fitbit_connections_public').update({
        status: 'active',
        last_sync_at: rawLastSyncedAt,
        last_error_code: null,
        last_error_message: null,
        last_error_at: null,
      }).eq('user_id', userId)
    }

    return jsonResponse(
      {
        ok: true,
        // Backward-compatible fields (best-effort; may be missing if today's row doesn't exist).
        entry_date: todayCaloriesOut !== null ? todayKey : undefined,
        raw_tdee: todayCaloriesOut !== null ? todayCaloriesOut : undefined,
        raw_last_synced_at: rawLastSyncedAt,
        synced_dates: syncedDates,
        skipped_missing_row: skippedMissingRow,
      },
      { status: 200 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('fitbit-sync-now error:', msg)
    return jsonResponse({ error: 'FITBIT_SYNC_NOW_FAILED', detail: msg }, { status: 400 })
  }
})

