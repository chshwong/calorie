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

type FitbitWeightLogRow = {
  bmi?: unknown
  date?: unknown
  fat?: unknown
  logId?: unknown
  source?: unknown
  time?: unknown
  weight?: unknown
}

function parseDateKeyToUtcDate(dateKey: string): Date {
  // Interpret dateKey as a pure date; use UTC midnight for stable arithmetic.
  return new Date(`${dateKey}T00:00:00.000Z`)
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = parseDateKeyToUtcDate(dateKey)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function clampDateKey(a: string, b: string): string {
  return a <= b ? a : b
}

function roundTo3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function kgToLb(kg: number): number {
  return kg * 2.2046226218
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  // Returns the offset (ms) between UTC and the provided timeZone at the given instant.
  // Positive if timeZone is ahead of UTC.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)?.value
  const y = get('year')
  const m = get('month')
  const d = get('day')
  const hh = get('hour')
  const mm = get('minute')
  const ss = get('second')
  if (!y || !m || !d || !hh || !mm || !ss) return 0
  const asUTC = Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss))
  return asUTC - date.getTime()
}

function zonedLocalDateTimeToUtcIso(params: { dateKey: string; time: string; timeZone: string }): string {
  // Convert a local dateKey + time in a specific IANA timezone into a UTC ISO string.
  // Uses a small fixed-point iteration to handle DST transitions.
  const [yS, mS, dS] = params.dateKey.split('-')
  const [hhS, mmS, ssS = '00'] = params.time.split(':')
  const y = Number(yS)
  const m = Number(mS)
  const d = Number(dS)
  const hh = Number(hhS)
  const mm = Number(mmS)
  const ss = Number(ssS)

  // Start with a UTC guess using the same components.
  let utcMs = Date.UTC(y, m - 1, d, hh, mm, ss)

  for (let i = 0; i < 3; i++) {
    const off = getTimeZoneOffsetMs(new Date(utcMs), params.timeZone)
    const next = Date.UTC(y, m - 1, d, hh, mm, ss) - off
    if (Math.abs(next - utcMs) < 1) {
      utcMs = next
      break
    }
    utcMs = next
  }

  return new Date(utcMs).toISOString()
}

function isInsufficientScope(params: { status: number; json: any }): boolean {
  const status = params.status
  const json = params.json
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

async function fetchFitbitWeightLogs(params: { accessToken: string; startDateKey: string; endDateKey: string }) {
  const url = `https://api.fitbit.com/1/user/-/body/log/weight/date/${encodeURIComponent(
    params.startDateKey,
  )}/${encodeURIComponent(params.endDateKey)}.json`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      Accept: 'application/json',
      // Intentionally omit Accept-Language so the API returns metric by default (documented).
    },
  })
  const json = await res.json().catch(() => ({}))
  return { res, json }
}

async function countWeightLogsForLocalDay(params: {
  admin: any
  userId: string
  dayStartUtcIso: string
  nextDayStartUtcIso: string
}): Promise<number> {
  const { admin, userId, dayStartUtcIso, nextDayStartUtcIso } = params
  const { count, error } = await admin
    .from('weight_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('weighed_at', dayStartUtcIso)
    .lt('weighed_at', nextDayStartUtcIso)
  if (error) throw new Error(`WEIGHT_LOG_COUNT_FAILED:${error.message}`)
  return typeof count === 'number' ? count : 0
}

async function findMostRecentWeightLogForLocalDay(params: {
  admin: any
  userId: string
  dayStartUtcIso: string
  nextDayStartUtcIso: string
}): Promise<{ id: string } | null> {
  const { admin, userId, dayStartUtcIso, nextDayStartUtcIso } = params
  const { data, error } = await admin
    .from('weight_log')
    .select('id')
    .eq('user_id', userId)
    .gte('weighed_at', dayStartUtcIso)
    .lt('weighed_at', nextDayStartUtcIso)
    .order('weighed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`WEIGHT_LOG_LATEST_FAILED:${error.message}`)
  return data ? ({ id: (data as any).id as string } as any) : null
}

async function upsertFitbitWeightLog(params: {
  admin: any
  userId: string
  timeZone: string
  externalId: string
  weighedAtUtcIso: string
  weightLb: number
  bodyFatPercent: number | null
}) {
  const { admin, userId, timeZone, externalId, weighedAtUtcIso, weightLb, bodyFatPercent } = params

  // Idempotency first: update existing (does not consume a slot).
  {
    const { data, error } = await admin
      .from('weight_log')
      .select('id')
      .eq('user_id', userId)
      .eq('source', 'fitbit')
      .eq('external_id', externalId)
      .maybeSingle()
    if (error) throw new Error(`WEIGHT_LOG_EXISTING_LOOKUP_FAILED:${error.message}`)
    if (data?.id) {
      const { error: updErr } = await admin
        .from('weight_log')
        .update({
          weighed_at: weighedAtUtcIso,
          weight_lb: weightLb,
          body_fat_percent: bodyFatPercent,
          source: 'fitbit',
          external_id: externalId,
        })
        .eq('id', (data as any).id)
      if (updErr) throw new Error(`WEIGHT_LOG_UPDATE_FAILED:${updErr.message}`)
      return { action: 'updated_existing' as const }
    }
  }

  const localDateKey = dateKeyInTimeZone(new Date(weighedAtUtcIso), timeZone)
  const nextLocalDateKey = addDaysToDateKey(localDateKey, 1)
  const dayStartUtcIso = zonedLocalDateTimeToUtcIso({ dateKey: localDateKey, time: '00:00:00', timeZone })
  const nextDayStartUtcIso = zonedLocalDateTimeToUtcIso({ dateKey: nextLocalDateKey, time: '00:00:00', timeZone })

  const count = await countWeightLogsForLocalDay({ admin, userId, dayStartUtcIso, nextDayStartUtcIso })
  if (count < 10) {
    const { error: insErr } = await admin.from('weight_log').insert({
      user_id: userId,
      weighed_at: weighedAtUtcIso,
      weight_lb: weightLb,
      body_fat_percent: bodyFatPercent,
      note: null,
      source: 'fitbit',
      external_id: externalId,
    })
    if (insErr) throw new Error(`WEIGHT_LOG_INSERT_FAILED:${insErr.message}`)
    return { action: 'inserted' as const }
  }

  const mostRecent = await findMostRecentWeightLogForLocalDay({ admin, userId, dayStartUtcIso, nextDayStartUtcIso })
  if (!mostRecent) {
    // Extremely defensive: if count said >= 10 but no row found, fall back to insert.
    const { error: insErr } = await admin.from('weight_log').insert({
      user_id: userId,
      weighed_at: weighedAtUtcIso,
      weight_lb: weightLb,
      body_fat_percent: bodyFatPercent,
      note: null,
      source: 'fitbit',
      external_id: externalId,
    })
    if (insErr) throw new Error(`WEIGHT_LOG_INSERT_FAILED:${insErr.message}`)
    return { action: 'inserted' as const }
  }

  // Cap reached: update most recent row for that day (explicit tie-breakers handled in query).
  const { error: updErr } = await admin
    .from('weight_log')
    .update({
      weighed_at: weighedAtUtcIso,
      weight_lb: weightLb,
      body_fat_percent: bodyFatPercent,
      source: 'fitbit',
      external_id: externalId,
    })
    .eq('id', mostRecent.id)
  if (updErr) throw new Error(`WEIGHT_LOG_UPDATE_FAILED:${updErr.message}`)
  return { action: 'updated_capped' as const }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    const userId = await requireUserIdFromAuthHeader(authHeader)
    const admin = supabaseAdminClient()

    // Connection status + last weight sync timestamp.
    const { data: pubRow, error: pubErr } = await admin
      .from('fitbit_connections_public')
      .select('user_id,fitbit_user_id,status,last_weight_sync_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (pubErr) throw new Error(`PUBLIC_SELECT_FAILED:${pubErr.message}`)
    if (!pubRow) return jsonResponse({ error: 'NOT_CONNECTED' }, { status: 404 })

    const lastWeightSyncAt = (pubRow as any)?.last_weight_sync_at ? new Date((pubRow as any).last_weight_sync_at).getTime() : null
    if (typeof lastWeightSyncAt === 'number' && Number.isFinite(lastWeightSyncAt)) {
      const delta = Date.now() - lastWeightSyncAt
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

    // Determine sync window: last_weight_sync_at-2d (if any) OR today-90d, clamped to signup.
    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const lastMinus2d = typeof lastWeightSyncAt === 'number'
      ? new Date(lastWeightSyncAt - 2 * 24 * 60 * 60 * 1000)
      : null

    let minStart = ninetyDaysAgo
    if (lastMinus2d && lastMinus2d.getTime() < minStart.getTime()) {
      // If last sync is more recent than 90d window, prefer last-2d overlap.
      minStart = lastMinus2d
    }

    // Clamp to profile created_at if available.
    try {
      const { data: p } = await admin.from('profiles').select('created_at').eq('user_id', userId).maybeSingle()
      const createdAtIso = (p as any)?.created_at
      if (typeof createdAtIso === 'string') {
        const createdAt = new Date(createdAtIso)
        if (Number.isFinite(createdAt.getTime()) && createdAt.getTime() > minStart.getTime()) {
          minStart = createdAt
        }
      }
    } catch {
      // ignore
    }

    const startDateKey = dateKeyInTimeZone(minStart, tz)
    const endDateKey = dateKeyInTimeZone(now, tz)

    let inserted = 0
    let updatedExisting = 0
    let updatedCapped = 0
    let processed = 0

    // Window chunking: Fitbit max range is 31 days.
    let cursor = startDateKey
    while (cursor <= endDateKey) {
      const windowEnd = clampDateKey(addDaysToDateKey(cursor, 30), endDateKey)
      const { res, json } = await fetchFitbitWeightLogs({ accessToken, startDateKey: cursor, endDateKey: windowEnd })

      if (isInsufficientScope({ status: res.status, json })) {
        return jsonResponse({ error: 'INSUFFICIENT_SCOPE' }, { status: 403 })
      }

      if (res.status === 401) {
        // Token invalid/revoked. Force re-connect by removing stored tokens.
        await admin.from('fitbit_connections_tokens').delete().eq('user_id', userId)
        return jsonResponse({ error: 'UNAUTHORIZED' }, { status: 401 })
      }

      if (!res.ok) {
        return jsonResponse({ error: 'FITBIT_FETCH_FAILED', status: res.status }, { status: 502 })
      }

      const list = Array.isArray((json as any)?.weight) ? ((json as any).weight as FitbitWeightLogRow[]) : []

      for (const raw of list) {
        const logId = raw?.logId
        const date = raw?.date
        const time = raw?.time
        const weight = raw?.weight
        const fat = raw?.fat

        if (typeof logId !== 'number' && typeof logId !== 'string') continue
        if (typeof date !== 'string') continue
        if (typeof time !== 'string') continue
        if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) continue

        const weighedAtUtcIso = zonedLocalDateTimeToUtcIso({ dateKey: date, time, timeZone: tz })
        const weightLb = roundTo3(kgToLb(weight))
        const bodyFatPercent =
          typeof fat === 'number' && Number.isFinite(fat) && fat >= 0 ? roundTo3(fat) : null

        const r = await upsertFitbitWeightLog({
          admin,
          userId,
          timeZone: tz,
          externalId: String(logId),
          weighedAtUtcIso,
          weightLb,
          bodyFatPercent,
        })

        processed += 1
        if (r.action === 'inserted') inserted += 1
        else if (r.action === 'updated_existing') updatedExisting += 1
        else updatedCapped += 1
      }

      cursor = addDaysToDateKey(windowEnd, 1)
    }

    const lastWeightSyncedAt = nowIso()
    await admin.from('fitbit_connections_public').update({ last_weight_sync_at: lastWeightSyncedAt }).eq('user_id', userId)

    return jsonResponse(
      {
        ok: true,
        processed,
        inserted,
        updated_existing: updatedExisting,
        updated_capped: updatedCapped,
        last_weight_sync_at: lastWeightSyncedAt,
      },
      { status: 200 },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('fitbit-sync-weight error:', msg)
    return jsonResponse({ error: 'FITBIT_SYNC_WEIGHT_FAILED', detail: msg }, { status: 400 })
  }
})

