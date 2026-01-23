import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import {
  corsHeaders,
  jsonResponse,
  requireUserIdFromAuthHeader,
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
    const admin = supabaseAdminClient()

    // Delete tokens first (service-role only table)
    await admin.from('fitbit_connections_tokens').delete().eq('user_id', userId)
    await admin.from('fitbit_connections_public').delete().eq('user_id', userId)

    return jsonResponse({ ok: true }, { status: 200 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('fitbit-disconnect error:', msg)
    return jsonResponse({ error: 'FITBIT_DISCONNECT_FAILED', detail: msg }, { status: 400 })
  }
})

