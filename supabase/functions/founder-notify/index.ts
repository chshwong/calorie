import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-founder-notify-secret',
};

type FounderSettings = {
  id: number;
  slack_webhook_url: string | null;
  slack_new_user_alerts_enabled: boolean;
  slack_error_alerts_enabled: boolean;
  error_spike_threshold_per_hour: number;
  slack_last_success_at: string | null;
  slack_last_transport_error_at: string | null;
  slack_last_spike_alert_at: string | null;
};

function nowIso(): string {
  return new Date().toISOString();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const summary = {
    joiner_posted: false,
    joiner_count: 0,
    spike_posted: false,
    errors_1h: 0,
  };

  try {
    const secret = Deno.env.get('FOUNDER_NOTIFY_SECRET') ?? '';
    const reqSecret = req.headers.get('x-founder-notify-secret') ?? '';
    if (!secret || reqSecret !== secret) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase service role config');
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: settings, error: settingsError } = await admin
      .from('founder_settings')
      .select(
        `id,
         slack_webhook_url,
         slack_new_user_alerts_enabled,
         slack_error_alerts_enabled,
         error_spike_threshold_per_hour,
         slack_last_success_at,
         slack_last_transport_error_at,
         slack_last_spike_alert_at`
      )
      .eq('id', 1)
      .maybeSingle<FounderSettings>();

    if (settingsError) throw settingsError;
    if (!settings?.slack_webhook_url) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_webhook' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // 1) New user batch alerts
    if (settings.slack_new_user_alerts_enabled) {
      try {
        const { data: newEvents, error: eventsError } = await admin
          .from('app_events')
          .select('id, user_id, created_at')
          .eq('event_type', 'user_created')
          .is('notified_at', null)
          .order('created_at', { ascending: true })
          .limit(20);
        if (eventsError) throw eventsError;

        const rows = newEvents ?? [];
        if (rows.length > 0) {
          const lines = rows.map((event) => {
            const ts = new Date(event.created_at).toISOString().replace('T', ' ').slice(0, 19);
            return `- ${ts} UTC: ${event.user_id ?? 'unknown-user'}`;
          });
          const text = `:tada: New users: ${rows.length}\n${lines.join('\n')}`;
          const slackResp = await fetch(settings.slack_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });

          if (!slackResp.ok) {
            await admin
              .from('founder_settings')
              .update({
                slack_last_transport_error_at: nowIso(),
                updated_at: nowIso(),
              })
              .eq('id', 1);
          } else {
            const ids = rows.map((r) => r.id);
            await admin
              .from('app_events')
              .update({ notified_at: nowIso() })
              .in('id', ids);
            await admin
              .from('founder_settings')
              .update({
                slack_last_success_at: nowIso(),
                updated_at: nowIso(),
              })
              .eq('id', 1);
            summary.joiner_posted = true;
            summary.joiner_count = rows.length;
          }
        }
      } catch {
        await admin
          .from('founder_settings')
          .update({
            slack_last_transport_error_at: nowIso(),
            updated_at: nowIso(),
          })
          .eq('id', 1);
      }
    }

    // 2) Error spike alerts
    if (settings.slack_error_alerts_enabled) {
      try {
        const threshold = Math.max(1, Number(settings.error_spike_threshold_per_hour ?? 10));
        const { count, error: countError } = await admin
          .from('app_errors')
          .select('id', { head: true, count: 'exact' })
          .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
        if (countError) throw countError;

        const errors1h = Number(count ?? 0);
        summary.errors_1h = errors1h;
        const spikeGate = settings.slack_last_spike_alert_at
          ? new Date(settings.slack_last_spike_alert_at).getTime()
          : 0;
        const gateOpen = !spikeGate || spikeGate < Date.now() - 60 * 60 * 1000;

        if (errors1h >= threshold && gateOpen) {
          const text = `:rotating_light: Error spike: ${errors1h} errors in last hour (threshold ${threshold})`;
          const slackResp = await fetch(settings.slack_webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });

          if (!slackResp.ok) {
            await admin
              .from('founder_settings')
              .update({
                slack_last_transport_error_at: nowIso(),
                updated_at: nowIso(),
              })
              .eq('id', 1);
          } else {
            await admin
              .from('founder_settings')
              .update({
                slack_last_success_at: nowIso(),
                slack_last_spike_alert_at: nowIso(),
                updated_at: nowIso(),
              })
              .eq('id', 1);
            summary.spike_posted = true;
          }
        }
      } catch {
        await admin
          .from('founder_settings')
          .update({
            slack_last_transport_error_at: nowIso(),
            updated_at: nowIso(),
          })
          .eq('id', 1);
      }
    }

    return new Response(JSON.stringify({ success: true, ...summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'unknown error',
        ...summary,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
