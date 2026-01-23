import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  corsHeaders,
  dateKeyInTimeZone,
  extractActivityCaloriesOrThrow,
  fetchFitbitDailyActivity,
  getUserTimeZoneOrUtc,
  jsonResponse,
  nowIso,
  refreshTokens,
  supabaseAdminClient,
} from '../_shared/fitbit.ts'

const REFRESH_SAFETY_MS = 5 * 60 * 1000

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
  const dateKey = dateKeyInTimeZone(new Date(), tz)
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

  let activityCalories: number
  try {
    activityCalories = extractActivityCaloriesOrThrow(json)
  } catch {
    await setPublicStatus({
      admin,
      userId,
      patch: {
        status: 'error',
        last_error_code: 'MISSING_ACTIVITY_CALORIES',
        last_error_message: 'Fitbit payload missing activityCalories',
        last_error_at: nowIso(),
      },
    })
    return { ok: false as const, code: 'MISSING_ACTIVITY_CALORIES' }
  }

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
    await setPublicStatus({
      admin,
      userId,
      patch: {
        status: 'error',
        last_error_code: 'MISSING_DAILY_ROW',
        last_error_message: 'Open the app once to initialize today before syncing',
        last_error_at: nowIso(),
      },
    })
    return { ok: false as const, code: 'MISSING_DAILY_ROW' }
  }

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

