import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  corsHeaders,
  dateKeyInTimeZone,
  getUserTimeZoneOrUtc,
  jsonResponse,
  nowIso,
  refreshTokens,
  requireUserIdFromAuthHeader,
  supabaseAdminClient,
} from '../_shared/fitbit.ts'

const MIN_INTERVAL_MS = 15 * 60 * 1000
const REFRESH_SAFETY_MS = 5 * 60 * 1000

function parseDateKeyToUtcDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`)
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = parseDateKeyToUtcDate(dateKey)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function isInsufficientScope(params: { status: number; json: any }): boolean {
  const { status, json } = params
  if (status !== 401 && status !== 403) return false
  const errors = Array.isArray(json?.errors) ? json.errors : []
  const hay = [
    json?.errorType,
    json?.message,
    errors?.[0]?.errorType,
    errors?.[0]?.message,
    errors?.[0]?.fieldName,
  ]
    .filter((v) => typeof v === 'string')
    .join(' ')
    .toLowerCase()
  return hay.includes('insufficient') && hay.includes('scope')
}

async function fetchFitbitStepsDateRange(params: {
  accessToken: string
  startDateKey: string
  endDateKey: string
}) {
  const url = `https://api.fitbit.com/1/user/-/activities/steps/date/${encodeURIComponent(
    params.startDateKey,
  )}/${encodeURIComponent(params.endDateKey)}.json`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: 'application/json',
    },
  })
  const json = await res.json().catch(() => ({}))
  return { res, json }
}

type StepsTimeSeriesEntry = { dateTime?: string; value?: string }

serve(async (req) => {
  // CORS preflight: must return 2xx with CORS headers or browser blocks the request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: new Headers(corsHeaders),
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const userId = await requireUserIdFromAuthHeader(authHeader)
    const admin = supabaseAdminClient()

    const { data: pubRow, error: pubErr } = await admin
      .from('fitbit_connections_public')
      .select('user_id,fitbit_user_id,status,last_steps_sync_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (pubErr) throw new Error(`PUBLIC_SELECT_FAILED:${pubErr.message}`)
    if (!pubRow) return jsonResponse({ error: 'NOT_CONNECTED' }, { status: 404 })

    // Same throttle as burn/weight: 15 min cooldown using last_steps_sync_at.
    const lastStepsSyncAt = (pubRow as any)?.last_steps_sync_at
      ? new Date((pubRow as any).last_steps_sync_at).getTime()
      : null
    if (typeof lastStepsSyncAt === 'number' && Number.isFinite(lastStepsSyncAt)) {
      const delta = Date.now() - lastStepsSyncAt
      if (delta >= 0 && delta < MIN_INTERVAL_MS) {
        const retryAfterSeconds = Math.ceil((MIN_INTERVAL_MS - delta) / 1000)
        return jsonResponse(
          { error: 'RATE_LIMIT', retry_after_seconds: retryAfterSeconds },
          { status: 429 },
        )
      }
    }

    const { data: tokenRow, error: tokenErr } = await admin
      .from('fitbit_connections_tokens')
      .select('access_token,refresh_token,expires_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (tokenErr || !tokenRow) {
      return jsonResponse({ error: 'MISSING_TOKENS' }, { status: 401 })
    }

    let accessToken = (tokenRow as any).access_token as string
    const refreshToken = (tokenRow as any).refresh_token as string
    const expiresAtMs = new Date((tokenRow as any).expires_at).getTime()

    const needsRefresh =
      !Number.isFinite(expiresAtMs) || expiresAtMs - Date.now() < REFRESH_SAFETY_MS
    if (needsRefresh) {
      const refreshed = await refreshTokens({ refreshToken })
      accessToken = refreshed.access_token
      const newExpiresAtIso = new Date(
        Date.now() + Math.max(1, refreshed.expires_in) * 1000,
      ).toISOString()
      const { error: upsertErr } = await admin
        .from('fitbit_connections_tokens')
        .upsert(
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
    const now = new Date()
    const todayKey = dateKeyInTimeZone(now, tz)
    const startDateKey = addDaysToDateKey(todayKey, -6)
    const endDateKey = todayKey

    const { res, json } = await fetchFitbitStepsDateRange({
      accessToken,
      startDateKey,
      endDateKey,
    })

    if (isInsufficientScope({ status: res.status, json })) {
      return jsonResponse({ error: 'INSUFFICIENT_SCOPE' }, { status: 403 })
    }

    if (res.status === 401) {
      await admin.from('fitbit_connections_tokens').delete().eq('user_id', userId)
      return jsonResponse({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    if (!res.ok) {
      return jsonResponse(
        { error: 'FITBIT_FETCH_FAILED', status: res.status },
        { status: 502 },
      )
    }

    const stepsList = Array.isArray((json as any)?.['activities-steps'])
      ? ((json as any)['activities-steps'] as StepsTimeSeriesEntry[])
      : []

    const stepsByDate: Record<string, number> = {}
    for (const entry of stepsList) {
      const dateTime = entry?.dateTime
      const value = entry?.value
      if (typeof dateTime !== 'string' || dateTime.length < 10) continue
      const dateKey = dateTime.slice(0, 10)
      const steps =
        typeof value === 'string'
          ? parseInt(value, 10)
          : typeof value === 'number'
            ? Math.floor(value)
            : NaN
      if (!Number.isFinite(steps) || steps < 0) continue
      stepsByDate[dateKey] = steps
    }

    const updatedAt = nowIso()
    const rows: { user_id: string; date: string; steps: number; steps_source: string; steps_updated_at: string }[] = []
    const syncedDates: string[] = []

    for (let i = 0; i < 7; i++) {
      const dateKey = addDaysToDateKey(todayKey, -i)
      syncedDates.push(dateKey)
      rows.push({
        user_id: userId,
        date: dateKey,
        steps: stepsByDate[dateKey] ?? 0,
        steps_source: 'fitbit',
        steps_updated_at: updatedAt,
      })
    }

    const { error: upsertErr } = await admin
      .from('daily_sum_exercises')
      .upsert(rows, { onConflict: 'user_id,date' })

    if (upsertErr) throw new Error(`STEPS_UPSERT_FAILED:${upsertErr.message}`)

    const lastStepsSyncedAt = nowIso()
    await admin
      .from('fitbit_connections_public')
      .update({ last_steps_sync_at: lastStepsSyncedAt })
      .eq('user_id', userId)

    return jsonResponse(
      { ok: true, synced_dates: syncedDates },
      { status: 200 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('fitbit-sync-steps error:', msg)
    return jsonResponse(
      { error: 'FITBIT_SYNC_STEPS_FAILED', detail: msg },
      { status: 400 },
    )
  }
})
