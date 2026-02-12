import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-founder-digest-secret',
};

const TORONTO_TZ = 'America/Toronto';
const WINDOW_START_MINUTE = 7 * 60; // 07:00
const WINDOW_END_MINUTE = 7 * 60 + 10; // 07:10

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const second = Number(get('second'));
  const dateKey = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, hour, minute, second, dateKey };
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function pct(used: number, limit: number): number {
  if (!Number.isFinite(used) || !Number.isFinite(limit) || limit <= 0) return 0;
  return Math.max(0, Math.min(100, (used / limit) * 100));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const secret = Deno.env.get('FOUNDER_DIGEST_SECRET') ?? '';
    const reqSecret = req.headers.get('x-founder-digest-secret') ?? '';
    if (!secret || reqSecret !== secret) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const now = new Date();
    const local = zonedParts(now, TORONTO_TZ);
    const minuteOfDay = local.hour * 60 + local.minute;
    if (minuteOfDay < WINDOW_START_MINUTE || minuteOfDay > WINDOW_END_MINUTE) {
      return new Response(
        JSON.stringify({
          skipped: true,
          reason: 'outside_window',
          local_time: `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const yesterdayKey = addDaysToDateKey(local.dateKey, -1);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase service configuration');
    }
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: settings, error: settingsError } = await admin
      .from('founder_settings')
      .select('id, slack_webhook_url, last_digest_sent_for_day')
      .eq('id', 1)
      .maybeSingle();

    if (settingsError) throw settingsError;
    if (!settings?.slack_webhook_url) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_webhook' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    if (settings.last_digest_sent_for_day === yesterdayKey) {
      return new Response(JSON.stringify({ skipped: true, reason: 'already_sent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const windowStart = addDaysToDateKey(yesterdayKey, -1);
    const windowStartIso = `${windowStart}T00:00:00.000Z`;
    const windowEndIso = `${addDaysToDateKey(yesterdayKey, 1)}T00:00:00.000Z`;

    const { data: events, error: eventsErr } = await admin
      .from('app_events')
      .select('event_type, created_at')
      .in('event_type', ['user_created', 'user_deleted'])
      .gte('created_at', windowStartIso)
      .lt('created_at', windowEndIso);
    if (eventsErr) throw eventsErr;

    let newUsers = 0;
    let deletedUsers = 0;
    for (const row of events ?? []) {
      const eventDate = new Date(row.created_at as string);
      const eventLocalDay = zonedParts(eventDate, TORONTO_TZ).dateKey;
      if (eventLocalDay !== yesterdayKey) continue;
      if (row.event_type === 'user_created') newUsers += 1;
      if (row.event_type === 'user_deleted') deletedUsers += 1;
    }

    const { count: totalCreatedCount, error: totalCreatedErr } = await admin
      .from('app_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'user_created');
    if (totalCreatedErr) throw totalCreatedErr;

    const { count: totalDeletedCount, error: totalDeletedErr } = await admin
      .from('app_events')
      .select('id', { count: 'exact', head: true })
      .eq('event_type', 'user_deleted');
    if (totalDeletedErr) throw totalDeletedErr;

    const { data: usageRows, error: usageErr } = await admin.rpc('rpc_internal_current_usage');
    if (usageErr) throw usageErr;
    const usage = Array.isArray(usageRows) && usageRows[0]
      ? usageRows[0]
      : { db_bytes: 0, storage_bytes: 0 };

    const { data: limitsRows, error: limitsErr } = await admin
      .from('platform_limits')
      .select('platform, limits')
      .eq('platform', 'supabase')
      .maybeSingle();
    if (limitsErr) throw limitsErr;

    const dbLimit = Number(limitsRows?.limits?.database_size_bytes ?? 0);
    const storageLimit = Number(limitsRows?.limits?.storage_size_bytes ?? 0);

    const net = newUsers - deletedUsers;
    const totalUsers = Number(totalCreatedCount ?? 0) - Number(totalDeletedCount ?? 0);
    const dbBytes = Number(usage.db_bytes ?? 0);
    const storageBytes = Number(usage.storage_bytes ?? 0);
    const dbPct = pct(dbBytes, dbLimit);
    const storagePct = pct(storageBytes, storageLimit);

    const slackText =
      `*AvoVibe Founder Digest (${yesterdayKey}, America/Toronto)*\n` +
      `• New users: *${newUsers}*\n` +
      `• Deletes: *${deletedUsers}*\n` +
      `• Net change: *${net}*\n` +
      `• Total users (net): *${totalUsers}*\n` +
      `• DB usage: *${dbPct.toFixed(1)}%* (${dbBytes} / ${dbLimit} bytes)\n` +
      `• Storage usage: *${storagePct.toFixed(1)}%* (${storageBytes} / ${storageLimit} bytes)`;

    const slackResponse = await fetch(settings.slack_webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: slackText }),
    });

    if (!slackResponse.ok) {
      const body = await slackResponse.text();
      throw new Error(`Slack send failed (${slackResponse.status}): ${body}`);
    }

    const { error: updateErr } = await admin
      .from('founder_settings')
      .update({
        last_digest_sent_for_day: yesterdayKey,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({
        success: true,
        yesterday: yesterdayKey,
        new_users: newUsers,
        deleted_users: deletedUsers,
        net_change: net,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
