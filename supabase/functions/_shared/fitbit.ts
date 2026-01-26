import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-fitbit-sync-secret',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
}

export function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  })
}

export function htmlResponse(html: string, init?: ResponseInit) {
  // Build headers object, ensuring Content-Type is always set correctly
  const headersObj: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
  }
  
  // Copy existing headers if provided (Content-Type above ensures it won't be overridden)
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        if (key.toLowerCase() !== 'content-type') {
          headersObj[key] = value
        }
      })
    } else if (Array.isArray(init.headers)) {
      for (const [key, value] of init.headers) {
        if (key.toLowerCase() !== 'content-type') {
          headersObj[key] = value
        }
      }
    } else {
      for (const [key, value] of Object.entries(init.headers)) {
        if (key.toLowerCase() !== 'content-type') {
          headersObj[key] = String(value)
        }
      }
    }
  }
  
  return new Response(html, {
    status: init?.status ?? 200,
    statusText: init?.statusText,
    headers: headersObj,
  })
}

export function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export function supabaseAdminClient() {
  const supabaseUrl = requireEnv('SUPABASE_URL')
  const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })
}

export function supabaseUserClient(authHeader: string) {
  const supabaseUrl = requireEnv('SUPABASE_URL')
  const anonKey = requireEnv('SUPABASE_ANON_KEY')
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })
}

export async function requireUserIdFromAuthHeader(authHeader: string | null): Promise<string> {
  if (!authHeader) throw new Error('No authorization header')
  const userClient = supabaseUserClient(authHeader)
  const { data, error } = await userClient.auth.getUser()
  if (error || !data?.user?.id) throw new Error('User not authenticated')
  return data.user.id
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  const b64 = btoa(binary)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function randomBase64Url(bytesLen = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(bytesLen))
  return base64UrlEncode(bytes)
}

export async function sha256Base64Url(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return base64UrlEncode(new Uint8Array(digest))
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  // Returns YYYY-MM-DD in the provided IANA timezone.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = fmt.formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  if (!y || !m || !d) {
    // Fallback to UTC ISO date
    return date.toISOString().slice(0, 10)
  }
  return `${y}-${m}-${d}`
}

export async function getUserTimeZoneOrUtc(params: { admin: any; userId: string }): Promise<string> {
  const { admin, userId } = params
  try {
    const { data, error } = await admin
      .from('profiles')
      .select('timezone')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) return 'UTC'
    const tz = (data as any)?.timezone
    return typeof tz === 'string' && tz.trim() ? tz.trim() : 'UTC'
  } catch {
    return 'UTC'
  }
}

export type FitbitTokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
  scope?: string
  user_id: string
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`
}

async function postToken(params: { body: URLSearchParams }): Promise<FitbitTokenResponse> {
  const clientId = requireEnv('FITBIT_CLIENT_ID')
  const clientSecret = requireEnv('FITBIT_CLIENT_SECRET')
  const res = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.body.toString(),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok) {
    const desc = typeof json?.errors?.[0]?.message === 'string' ? json.errors[0].message : res.statusText
    throw new Error(`FITBIT_TOKEN_EXCHANGE_FAILED:${res.status}:${desc}`)
  }

  if (!json || typeof json.access_token !== 'string' || typeof json.refresh_token !== 'string') {
    throw new Error('FITBIT_TOKEN_RESPONSE_INVALID')
  }

  return json as FitbitTokenResponse
}

export async function exchangeCodeForTokens(params: { code: string; codeVerifier: string }): Promise<FitbitTokenResponse> {
  const redirectUri = requireEnv('FITBIT_REDIRECT_URI')
  const body = new URLSearchParams()
  body.set('grant_type', 'authorization_code')
  body.set('code', params.code)
  body.set('redirect_uri', redirectUri)
  body.set('code_verifier', params.codeVerifier)
  return await postToken({ body })
}

export async function refreshTokens(params: { refreshToken: string }): Promise<FitbitTokenResponse> {
  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', params.refreshToken)
  return await postToken({ body })
}

export type FitbitDailyActivityResponse = {
  summary?: {
    activityCalories?: unknown
    caloriesOut?: unknown
    caloriesBMR?: unknown
    [k: string]: unknown
  }
  [k: string]: unknown
}

export function extractActivityCaloriesOrThrow(data: FitbitDailyActivityResponse): number {
  // We explicitly define raw_burn as *activity* burn, since the app model is:
  //   final_tdee = bmr + final_burn
  // Therefore we do NOT use caloriesOut (total) and we do NOT guess by subtracting caloriesBMR in Phase 1.
  const summary = data?.summary
  const v = summary?.activityCalories
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    throw new Error('FITBIT_PAYLOAD_MISSING_ACTIVITY_CALORIES')
  }
  return v
}

export async function fetchFitbitDailyActivity(params: { accessToken: string; dateKey: string }) {
  const url = `https://api.fitbit.com/1/user/-/activities/date/${encodeURIComponent(params.dateKey)}.json`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  })
  const json = (await res.json().catch(() => ({}))) as FitbitDailyActivityResponse
  return { res, json }
}

