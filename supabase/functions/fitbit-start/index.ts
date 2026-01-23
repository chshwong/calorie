import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  corsHeaders,
  jsonResponse,
  randomBase64Url,
  requireEnv,
  requireUserIdFromAuthHeader,
  sha256Base64Url,
  supabaseAdminClient,
} from '../_shared/fitbit.ts'

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

    const clientId = requireEnv('FITBIT_CLIENT_ID')
    const redirectUri = requireEnv('FITBIT_REDIRECT_URI')
    const scopes = (Deno.env.get('FITBIT_SCOPES') ?? 'activity').trim()

    // PKCE + CSRF state
    const state = randomBase64Url(32)
    const codeVerifier = randomBase64Url(64)
    const codeChallenge = await sha256Base64Url(codeVerifier)

    const admin = supabaseAdminClient()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min

    const { error } = await admin.from('fitbit_oauth_sessions').insert({
      state,
      user_id: userId,
      code_verifier: codeVerifier,
      expires_at: expiresAt,
    })
    if (error) {
      throw new Error(`DB_INSERT_FAILED:${error.message}`)
    }

    const url = new URL('https://www.fitbit.com/oauth2/authorize')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('code_challenge', codeChallenge)
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('scope', scopes)
    url.searchParams.set('state', state)

    return jsonResponse({ authorizeUrl: url.toString() }, { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('fitbit-start error:', msg)
    return jsonResponse({ error: 'FITBIT_START_FAILED', detail: msg }, { status: 400 })
  }
})

