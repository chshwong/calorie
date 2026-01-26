import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  exchangeCodeForTokens,
  nowIso,
  requireEnv,
  supabaseAdminClient,
} from '../_shared/fitbit.ts'

function appOrigin(): string {
  return requireEnv('APP_ORIGIN').trim().replace(/\/+$/g, '')
}

function allowedAppOrigins(): Set<string> {
  const set = new Set<string>()
  set.add(appOrigin())

  const extra = Deno.env.get('APP_ORIGINS') ?? ''
  for (const part of extra.split(',')) {
    const v = part.trim().replace(/\/+$/g, '')
    if (v) set.add(v)
  }

  return set
}

function redirectToApp(params: { ok: boolean; errorCode?: string; message?: string; redirectOrigin?: string | null }) {
  const payload = {
    type: 'fitbit_oauth_result',
    provider: 'fitbit',
    ok: params.ok,
    errorCode: params.errorCode ?? null,
    message: params.message ?? null,
    connectedAt: params.ok ? nowIso() : null,
  }

  const allow = allowedAppOrigins()
  const requested = (params.redirectOrigin ?? '').trim().replace(/\/+$/g, '')
  const destOrigin = requested && allow.has(requested) ? requested : appOrigin()

  // Redirect the popup back to the app origin so scripts can run reliably there.
  // Some browsers treat the functions origin response as sandboxed, blocking inline scripts.
  const dest = `${destOrigin}/fitbit-oauth-complete.html#fitbit_oauth_result=${encodeURIComponent(
    JSON.stringify(payload),
  )}`

  return new Response('Redirecting…', {
    status: 302,
    headers: {
      Location: dest,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

serve(async (req: Request) => {
  // Fitbit redirects to this endpoint (GET). No CORS needed.
  if (req.method !== 'GET') {
    return redirectToApp({ ok: false, errorCode: 'METHOD_NOT_ALLOWED' })
  }

  try {
    const url = new URL(req.url)
    const error = url.searchParams.get('error')
    const errorDesc = url.searchParams.get('error_description') ?? url.searchParams.get('errorDescription')
    if (error) {
      return redirectToApp({ ok: false, errorCode: error, message: errorDesc ?? undefined })
    }

    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) {
      return redirectToApp({ ok: false, errorCode: 'MISSING_CODE_OR_STATE' })
    }

    const admin = supabaseAdminClient()
    const { data: sessionRow, error: sessionError } = await admin
      .from('fitbit_oauth_sessions')
      .select('state,user_id,code_verifier,expires_at,app_origin')
      .eq('state', state)
      .maybeSingle()

    if (sessionError || !sessionRow) {
      return redirectToApp({ ok: false, errorCode: 'INVALID_STATE' })
    }

    const expiresAt = new Date((sessionRow as any).expires_at)
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      // Clean up expired session best-effort
      await admin.from('fitbit_oauth_sessions').delete().eq('state', state)
      return redirectToApp({ ok: false, errorCode: 'STATE_EXPIRED' })
    }

    const userId = (sessionRow as any).user_id as string
    const codeVerifier = (sessionRow as any).code_verifier as string
    const sessionOrigin = (sessionRow as any).app_origin as string | null | undefined

    const tokenRes = await exchangeCodeForTokens({ code, codeVerifier })
    const scopes = (tokenRes.scope ?? '').trim().split(/\s+/).filter(Boolean)

    const expiresAtIso = new Date(Date.now() + Math.max(1, tokenRes.expires_in) * 1000).toISOString()

    // Upsert public status (NO tokens here)
    {
      const { error: upsertPublicError } = await admin.from('fitbit_connections_public').upsert(
        {
          user_id: userId,
          fitbit_user_id: tokenRes.user_id,
          scopes,
          status: 'active',
          last_error_code: null,
          last_error_message: null,
          last_error_at: null,
        },
        { onConflict: 'user_id' },
      )
      if (upsertPublicError) {
        throw new Error(`UPSERT_PUBLIC_FAILED:${upsertPublicError.message}`)
      }
    }

    // Upsert tokens (service role only)
    {
      const { error: upsertTokensError } = await admin.from('fitbit_connections_tokens').upsert(
        {
          user_id: userId,
          access_token: tokenRes.access_token,
          refresh_token: tokenRes.refresh_token,
          expires_at: expiresAtIso,
        },
        { onConflict: 'user_id' },
      )
      if (upsertTokensError) {
        throw new Error(`UPSERT_TOKENS_FAILED:${upsertTokensError.message}`)
      }
    }

    // Consume the one-time session
    await admin.from('fitbit_oauth_sessions').delete().eq('state', state)

    return redirectToApp({ ok: true, redirectOrigin: sessionOrigin ?? null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('fitbit-callback error:', msg)
    return redirectToApp({ ok: false, errorCode: 'CALLBACK_FAILED', message: msg })
  }
})

