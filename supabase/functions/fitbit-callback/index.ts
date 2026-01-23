import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  exchangeCodeForTokens,
  htmlResponse,
  nowIso,
  requireEnv,
  supabaseAdminClient,
} from '../_shared/fitbit.ts'

function callbackHtml(params: { ok: boolean; errorCode?: string; message?: string }) {
  const appOrigin = requireEnv('APP_ORIGIN').trim()
  const payload = JSON.stringify({
    type: 'fitbit_oauth_result',
    provider: 'fitbit',
    ok: params.ok,
    errorCode: params.errorCode ?? null,
    message: params.message ?? null,
    connectedAt: params.ok ? nowIso() : null,
  })

  const safeMessage = params.ok
    ? 'Fitbit connected. You can close this window.'
    : 'Fitbit connection failed. You can close this window and try again.'

  return `<!doctype html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 16px;">
    <p>${safeMessage}</p>
    <script>
      (function () {
        try {
          if (window.opener && typeof window.opener.postMessage === 'function') {
            window.opener.postMessage(${payload}, ${JSON.stringify(appOrigin)});
          }
        } catch (e) {}
        try { window.close(); } catch (e) {}
        try { setTimeout(function () { window.close(); }, 80); } catch (e) {}
      })();
    </script>
  </body>
</html>`
}

serve(async (req) => {
  // Fitbit redirects to this endpoint (GET). No CORS needed.
  if (req.method !== 'GET') {
    return htmlResponse(callbackHtml({ ok: false, errorCode: 'METHOD_NOT_ALLOWED' }), { status: 405 })
  }

  try {
    const url = new URL(req.url)
    const error = url.searchParams.get('error')
    const errorDesc = url.searchParams.get('error_description') ?? url.searchParams.get('errorDescription')
    if (error) {
      return htmlResponse(callbackHtml({ ok: false, errorCode: error, message: errorDesc ?? undefined }), { status: 200 })
    }

    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) {
      return htmlResponse(callbackHtml({ ok: false, errorCode: 'MISSING_CODE_OR_STATE' }), { status: 200 })
    }

    const admin = supabaseAdminClient()
    const { data: sessionRow, error: sessionError } = await admin
      .from('fitbit_oauth_sessions')
      .select('state,user_id,code_verifier,expires_at')
      .eq('state', state)
      .maybeSingle()

    if (sessionError || !sessionRow) {
      return htmlResponse(callbackHtml({ ok: false, errorCode: 'INVALID_STATE' }), { status: 200 })
    }

    const expiresAt = new Date((sessionRow as any).expires_at)
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
      // Clean up expired session best-effort
      await admin.from('fitbit_oauth_sessions').delete().eq('state', state)
      return htmlResponse(callbackHtml({ ok: false, errorCode: 'STATE_EXPIRED' }), { status: 200 })
    }

    const userId = (sessionRow as any).user_id as string
    const codeVerifier = (sessionRow as any).code_verifier as string

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

    return htmlResponse(callbackHtml({ ok: true }), { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('fitbit-callback error:', msg)
    return htmlResponse(callbackHtml({ ok: false, errorCode: 'CALLBACK_FAILED', message: msg }), { status: 200 })
  }
})

