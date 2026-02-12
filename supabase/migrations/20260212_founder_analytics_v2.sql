-- Founder Analytics v2 (Group B, additive only)
-- - Adds app_errors monitor table + RLS tuned for useful production logging
-- - Adds app_events notification bookkeeping for joiner Slack batching
-- - Adds founder settings toggles/thresholds/Slack status markers
-- - Adds founder-guarded RPCs for errors summary/recent, momentum, system health

create extension if not exists pgcrypto;

-- ============================================================================
-- app_errors
-- ============================================================================

create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  error_type text not null,
  severity text not null default 'error' check (severity in ('info', 'warn', 'error')),
  user_id uuid null,
  message text not null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_app_errors_created_at_desc
  on public.app_errors (created_at desc);
create index if not exists idx_app_errors_type_created_at_desc
  on public.app_errors (error_type, created_at desc);

alter table public.app_errors enable row level security;

drop policy if exists app_errors_insert_authenticated on public.app_errors;
create policy app_errors_insert_authenticated
on public.app_errors
for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists app_errors_founder_select on public.app_errors;
create policy app_errors_founder_select
on public.app_errors
for select
to authenticated
using (public.is_founder(auth.uid()));

drop policy if exists app_errors_founder_update on public.app_errors;
create policy app_errors_founder_update
on public.app_errors
for update
to authenticated
using (public.is_founder(auth.uid()))
with check (public.is_founder(auth.uid()));

drop policy if exists app_errors_founder_delete on public.app_errors;
create policy app_errors_founder_delete
on public.app_errors
for delete
to authenticated
using (public.is_founder(auth.uid()));

-- ============================================================================
-- app_events notification bookkeeping
-- ============================================================================

alter table public.app_events
  add column if not exists notified_at timestamptz null;

create index if not exists idx_app_events_type_notified_created_desc
  on public.app_events (event_type, notified_at, created_at desc);

-- ============================================================================
-- founder_settings extensions
-- ============================================================================

alter table public.founder_settings
  add column if not exists slack_new_user_alerts_enabled boolean not null default false,
  add column if not exists slack_error_alerts_enabled boolean not null default true,
  add column if not exists error_spike_threshold_per_hour int not null default 10,
  add column if not exists slack_last_success_at timestamptz null,
  add column if not exists slack_last_transport_error_at timestamptz null,
  add column if not exists slack_last_spike_alert_at timestamptz null;

-- ============================================================================
-- Founder RPCs (explicit auth guard as first executable line)
-- ============================================================================

create or replace function public.rpc_founder_errors_summary()
returns table (
  errors_1h int,
  errors_24h int,
  top_types_24h jsonb
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not public.is_founder(auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
  with t as (
    select
      count(*) filter (where e.created_at >= now() - interval '1 hour')::int as errors_1h,
      count(*) filter (where e.created_at >= now() - interval '24 hour')::int as errors_24h
    from public.app_errors e
  ),
  top_types as (
    select
      e.error_type,
      count(*)::int as cnt
    from public.app_errors e
    where e.created_at >= now() - interval '24 hour'
    group by e.error_type
    order by cnt desc, e.error_type asc
    limit 5
  )
  select
    t.errors_1h,
    t.errors_24h,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('type', tt.error_type, 'count', tt.cnt)
          order by tt.cnt desc, tt.error_type asc
        )
        from top_types tt
      ),
      '[]'::jsonb
    ) as top_types_24h
  from t;
end;
$$;

create or replace function public.rpc_founder_errors_recent(limit_rows int default 20)
returns table (
  created_at timestamptz,
  error_type text,
  severity text,
  message text,
  user_id uuid
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_limit int;
begin
  if not public.is_founder(auth.uid()) then
    raise exception 'not authorized';
  end if;

  v_limit := greatest(1, least(coalesce(limit_rows, 20), 100));

  return query
  select
    e.created_at,
    e.error_type,
    e.severity,
    e.message,
    e.user_id
  from public.app_errors e
  order by e.created_at desc
  limit v_limit;
end;
$$;

create or replace function public.rpc_founder_growth_momentum()
returns table (
  new_7d int,
  new_prev_7d int,
  pct_change_7d numeric
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if not public.is_founder(auth.uid()) then
    raise exception 'not authorized';
  end if;

  return query
  with c as (
    select
      count(*) filter (
        where e.event_type = 'user_created'
          and e.created_at::date between current_date - interval '6 day' and current_date
      )::int as cur_7d,
      count(*) filter (
        where e.event_type = 'user_created'
          and e.created_at::date between current_date - interval '13 day' and current_date - interval '7 day'
      )::int as prev_7d
    from public.app_events e
  )
  select
    c.cur_7d as new_7d,
    c.prev_7d as new_prev_7d,
    case
      when c.prev_7d <= 0 then null
      else round(((c.cur_7d - c.prev_7d)::numeric / c.prev_7d::numeric) * 100, 2)
    end as pct_change_7d
  from c;
end;
$$;

create or replace function public.rpc_founder_system_health()
returns table (
  last_digest_sent_for_day date,
  slack_last_success_at timestamptz,
  slack_last_transport_error_at timestamptz,
  slack_last_spike_alert_at timestamptz,
  errors_1h int,
  db_bytes bigint,
  storage_bytes bigint,
  latest_event_time timestamptz
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_last_digest date;
  v_last_success timestamptz;
  v_last_transport_error timestamptz;
  v_last_spike_alert timestamptz;
  v_errors_1h int;
  v_db_bytes bigint;
  v_storage_bytes bigint;
  v_latest_event_time timestamptz;
begin
  if not public.is_founder(auth.uid()) then
    raise exception 'not authorized';
  end if;

  select
    fs.last_digest_sent_for_day,
    fs.slack_last_success_at,
    fs.slack_last_transport_error_at,
    fs.slack_last_spike_alert_at
  into
    v_last_digest,
    v_last_success,
    v_last_transport_error,
    v_last_spike_alert
  from public.founder_settings fs
  where fs.id = 1;

  select
    count(*)::int
  into v_errors_1h
  from public.app_errors e
  where e.created_at >= now() - interval '1 hour';

  select
    pg_database_size(current_database())::bigint,
    coalesce(
      sum(
        case
          when (o.metadata ->> 'size') ~ '^[0-9]+$'
            then (o.metadata ->> 'size')::bigint
          else 0::bigint
        end
      ),
      0::bigint
    )::bigint
  into v_db_bytes, v_storage_bytes
  from storage.objects o;

  select max(e.created_at)
  into v_latest_event_time
  from public.app_events e;

  return query
  select
    v_last_digest,
    v_last_success,
    v_last_transport_error,
    v_last_spike_alert,
    coalesce(v_errors_1h, 0),
    coalesce(v_db_bytes, 0),
    coalesce(v_storage_bytes, 0),
    v_latest_event_time;
end;
$$;

revoke all on function public.rpc_founder_errors_summary() from public;
revoke all on function public.rpc_founder_errors_recent(int) from public;
revoke all on function public.rpc_founder_growth_momentum() from public;
revoke all on function public.rpc_founder_system_health() from public;

grant execute on function public.rpc_founder_errors_summary() to authenticated, service_role;
grant execute on function public.rpc_founder_errors_recent(int) to authenticated, service_role;
grant execute on function public.rpc_founder_growth_momentum() to authenticated, service_role;
grant execute on function public.rpc_founder_system_health() to authenticated, service_role;
