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
    supabaseAdminClient,
} from '../_shared/fitbit.ts'

const REFRESH_SAFETY_MS = 5 * 60 * 1000
const MINUTES_PER_DAY = 24 * 60

function minutesSinceLocalMidnightInTimeZone(date: Date, timeZone: string): number {
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

async function setPublicStatus(params: {
  admin: any
  userId: string
  patch: Record<string, unknown>
}) {
  const { admin, userId, patch } = params
  await admin.from('fitbit_connections_public').update(patch).eq('user_id', userId)
}

async function syncOneUser(params: { admin: any; userId: string; fitbitUserId: string }) {
  const { admin, userId } = params

  // Gate: Calories sync is enabled unless explicitly set to false.
  const { data: prefRow, error: prefErr } = await admin
    .from('profiles')
    .select('sync_activity_burn')
    .eq('user_id', userId)
    .maybeSingle()
  if (prefErr) throw new Error(`PROFILE_PREF_SELECT_FAILED:${prefErr.message}`)
  const syncOn = (prefRow as any)?.sync_activity_burn !== false
  if (!syncOn) {
    console.log(
      JSON.stringify({
        event: 'fitbit_burn_total_sync_cron',
        user_id: userId,
        wrote_count: 0,
        skipped_missing_row_count: 0,
        toggle_off: true,
      }),
    )
    return { ok: true as const }
  }

  const { data: tokenRow } = await admin
    .from('fitbit_connections_tokens')
    .select('access_token,refresh_token,expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!tokenRow) {
    await setPublicStatus({
      admin,
      userId,
      patch: {
        status: 'error',
        last_error_code: 'MISSING_TOKENS',
        last_error_message: 'Reconnect Fitbit',
        last_error_at: nowIso(),
      },
    })
    return { ok: false as const, code: 'MISSING_TOKENS' }
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
  const todayKey = dateKeyInTimeZone(new Date(), tz)
  const dateKeys: string[] = []
  for (let i = 0; i < 7; i++) dateKeys.push(addDaysToDateKey(todayKey, -i))

  // Skip users who have no daily_sum_burned rows in the last 7 days.
  // This job must not create rows; only update existing rows.
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

  const skippedMissingRowCount = dateKeys.length - byDate.size

  if (byDate.size === 0) {
    console.log(
      JSON.stringify({
        event: 'fitbit_burn_total_sync_cron',
        user_id: userId,
        wrote_count: 0,
        skipped_missing_row_count: skippedMissingRowCount,
        toggle_off: false,
      }),
    )
    return { ok: true as const }
  }

  const rawLastSyncedAt = nowIso()
  let wroteCount = 0

  for (const dateKey of dateKeys) {
    const burnedRow = byDate.get(dateKey) ?? null
    if (!burnedRow) continue

    const { res, json } = await fetchFitbitDailyActivity({ accessToken, dateKey })

    if (res.status === 401) {
      // Token is invalid/revoked. Force re-connect by removing stored tokens.
      await admin.from('fitbit_connections_tokens').delete().eq('user_id', userId)
      await setPublicStatus({
        admin,
        userId,
        patch: {
          status: 'error',
          last_error_code: 'UNAUTHORIZED',
          last_error_message: 'Reconnect Fitbit',
          last_error_at: nowIso(),
        },
      })
      return { ok: false as const, code: 'UNAUTHORIZED' }
    }

    if (!res.ok) {
      await setPublicStatus({
        admin,
        userId,
        patch: {
          status: 'error',
          last_error_code: `FITBIT_HTTP_${res.status}`,
          last_error_message: 'Fitbit sync failed',
          last_error_at: nowIso(),
        },
      })
      return { ok: false as const, code: `FITBIT_HTTP_${res.status}` }
    }

    let caloriesOut: number
    try {
      caloriesOut = extractCaloriesOutOrThrow(json)
    } catch {
      await setPublicStatus({
        admin,
        userId,
        patch: {
          status: 'error',
          last_error_code: 'MISSING_TOTAL_CALORIES',
          last_error_message: 'Fitbit payload missing caloriesOut',
          last_error_at: nowIso(),
        },
      })
      return { ok: false as const, code: 'MISSING_TOTAL_CALORIES' }
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

    const { data: updated, error: updErr } = await admin
      .from('daily_sum_burned')
      .update({
        bmr_cal: bmr,
        active_cal: finalActive,
        tdee_cal: finalTdee,

        raw_tdee: caloriesOut,
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
      await setPublicStatus({
        admin,
        userId,
        patch: {
          status: 'error',
          last_error_code: 'DAILY_SUM_BURNED_UPDATE_FAILED',
          last_error_message: updErr.message,
          last_error_at: nowIso(),
        },
      })
      return { ok: false as const, code: 'DAILY_SUM_BURNED_UPDATE_FAILED' }
    }

    if (!updated) {
      // Row disappeared; treat as skip.
      continue
    }
    wroteCount += 1
  }

  // Only mark successful sync when we actually updated at least one date.
  if (wroteCount > 0) {
    await setPublicStatus({
      admin,
      userId,
      patch: {
        status: 'active',
        last_sync_at: rawLastSyncedAt,
        last_error_code: null,
        last_error_message: null,
        last_error_at: null,
      },
    })
  }

  console.log(
    JSON.stringify({
      event: 'fitbit_burn_total_sync_cron',
      user_id: userId,
      wrote_count: wroteCount,
      skipped_missing_row_count: skippedMissingRowCount,
      toggle_off: false,
    }),
  )

  return { ok: true as const }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 })
  }

  try {
    const secret = req.headers.get('x-fitbit-sync-secret') ?? req.headers.get('X-Fitbit-Sync-Secret')
    const expected = Deno.env.get('FITBIT_SYNC_SECRET')
    if (!expected || secret !== expected) {
      return jsonResponse({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const admin = supabaseAdminClient()
    const { data: rows, error } = await admin
      .from('fitbit_connections_public')
      .select('user_id,fitbit_user_id,status')
      .eq('status', 'active')

    if (error) throw new Error(`PUBLIC_SELECT_FAILED:${error.message}`)

    const list = Array.isArray(rows) ? rows : []
    let okCount = 0
    let errorCount = 0

    for (const r of list) {
      const userId = (r as any).user_id as string
      const fitbitUserId = (r as any).fitbit_user_id as string
      try {
        const res = await syncOneUser({ admin, userId, fitbitUserId })
        if (res.ok) okCount += 1
        else errorCount += 1
      } catch (e) {
        errorCount += 1
        const msg = e instanceof Error ? e.message : String(e)
        console.error('fitbit-sync user error:', userId, msg)
        await setPublicStatus({
          admin,
          userId,
          patch: {
            status: 'error',
            last_error_code: 'SYNC_EXCEPTION',
            last_error_message: 'Fitbit sync failed',
            last_error_at: nowIso(),
          },
        })
      }
    }

    return jsonResponse({ ok: true, users_total: list.length, users_ok: okCount, users_error: errorCount }, { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('fitbit-sync error:', msg)
    return jsonResponse({ error: 'FITBIT_SYNC_FAILED', detail: msg }, { status: 400 })
  }
})

