-- Founder digest cron wiring (ops script)
-- Keep this OUT of migrations to avoid deploy failures on missing extensions/config.
--
-- Preconditions:
-- 1) founder-digest and founder-notify edge functions are deployed
-- 2) FOUNDER_DIGEST_SECRET and FOUNDER_NOTIFY_SECRET are configured for edge functions
-- 3) You know your project ref: https://<project-ref>.supabase.co

-- Enable required extensions (if not already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Optional: remove existing schedule with same name
select cron.unschedule(jobid)
from cron.job
where jobname = 'founder_digest_hourly';

select cron.unschedule(jobid)
from cron.job
where jobname = 'founder_notify_hourly';

-- Schedule hourly at minute 5 UTC.
-- The edge function enforces Toronto local time window and dedupe guard.
select cron.schedule(
  'founder_digest_hourly',
  '5 * * * *',
  $$
  select
    net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/founder-digest',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-founder-digest-secret', '<FOUNDER_DIGEST_SECRET>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- founder-notify: hourly, additive to digest.
select cron.schedule(
  'founder_notify_hourly',
  '15 * * * *',
  $$
  select
    net.http_post(
      url := 'https://<project-ref>.supabase.co/functions/v1/founder-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-founder-notify-secret', '<FOUNDER_NOTIFY_SECRET>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Verify jobs
select jobid, jobname, schedule, command
from cron.job
where jobname in ('founder_digest_hourly', 'founder_notify_hourly');
