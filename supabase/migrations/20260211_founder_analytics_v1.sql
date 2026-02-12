-- Founder Analytics v1 (safety-hardened)
-- - Founder-only metrics access (allowlist table + explicit RPC guards)
-- - Best-effort analytics event logging (never block profile lifecycle writes)
-- - Soft-delete event logging via profiles.deleted_at transition
-- - No cron wiring in migration (handled in ops script)

create extension if not exists pgcrypto;

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null,
  event_type text not null check (event_type in ('user_created', 'user_deleted')),
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_app_events_created_at on public.app_events (created_at);
create index if not exists idx_app_events_event_type_created_at on public.app_events (event_type, created_at);
create index if not exists idx_app_events_user_id on public.app_events (user_id);

create table if not exists public.app_daily_metrics (
  day date primary key,
  new_users int not null default 0,
  deleted_users int not null default 0,
  computed_at timestamptz not null default now()
);

create table if not exists public.founder_admins (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.founder_settings (
  id int primary key default 1,
  slack_webhook_url text null,
  digest_email text null,
  digest_time_local text not null default '07:00',
  last_digest_sent_for_day date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint founder_settings_single_row check (id = 1)
);

create table if not exists public.platform_limits (
  platform text primary key check (platform in ('supabase', 'vercel')),
  limits jsonb not null,
  updated_at timestamptz not null default now()
);

-- profile soft-delete support for analytics logging
alter table public.profiles
  add column if not exists deleted_at timestamptz null;

-- ============================================================================
-- Founder access helpers
-- ============================================================================

create or replace function public.is_founder(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.founder_admins fa
    where fa.user_id = p_uid
  );
$$;

create or replace function public.is_founder()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_founder(auth.uid());
$$;

revoke all on function public.is_founder(uuid) from public;
revoke all on function public.is_founder() from public;
grant execute on function public.is_founder(uuid) to authenticated, service_role;
grant execute on function public.is_founder() to authenticated, service_role;

-- ============================================================================
-- Trigger helpers (non-blocking analytics writes)
-- ============================================================================

create or replace function public.trg_log_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.app_events(user_id, event_type, meta)
    values (new.user_id, 'user_created', '{}'::jsonb);
  exception when others then
    -- swallow analytics errors; never block signup/profile creation
    null;
  end;

  return new;
end;
$$;

create or replace function public.trg_log_user_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    begin
      insert into public.app_events(user_id, event_type, meta)
      values (new.user_id, 'user_deleted', '{}'::jsonb);
    exception when others then
      -- swallow analytics errors; never block profile/account updates
      null;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_created on public.profiles;
create trigger trg_profiles_created
after insert on public.profiles
for each row
execute function public.trg_log_user_created();

drop trigger if exists trg_profiles_soft_delete on public.profiles;
create trigger trg_profiles_soft_delete
after update on public.profiles
for each row
when (old.deleted_at is distinct from new.deleted_at)
execute function public.trg_log_user_soft_delete();

-- ============================================================================
-- Founder RPCs (explicit top-of-function auth checks)
-- ============================================================================

create or replace function public.rpc_founder_new_users_summary()
returns table (
  new_today int,
  new_7d int,
  new_30d int
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
  select
    coalesce(count(*) filter (
      where e.event_type = 'user_created'
        and e.created_at::date = current_date
    ), 0)::int as new_today,
    coalesce(count(*) filter (
      where e.event_type = 'user_created'
        and e.created_at::date >= current_date - interval '6 day'
        and e.created_at::date <= current_date
    ), 0)::int as new_7d,
    coalesce(count(*) filter (
      where e.event_type = 'user_created'
        and e.created_at::date >= current_date - interval '29 day'
        and e.created_at::date <= current_date
    ), 0)::int as new_30d
  from public.app_events e;
end;
$$;

create or replace function public.rpc_founder_daily_growth(days_back int default 60)
returns table (
  day date,
  new_users int,
  deleted_users int,
  cumulative_users bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_days int;
begin
  if not public.is_founder(auth.uid()) then
    raise exception 'not authorized';
  end if;

  v_days := greatest(1, least(coalesce(days_back, 60), 365));

  return query
  with day_series as (
    select generate_series(
      current_date - (v_days - 1),
      current_date,
      interval '1 day'
    )::date as day
  ),
  event_daily as (
    select
      e.created_at::date as day,
      count(*) filter (where e.event_type = 'user_created')::int as new_users,
      count(*) filter (where e.event_type = 'user_deleted')::int as deleted_users
    from public.app_events e
    where e.created_at::date between current_date - (v_days - 1) and current_date
    group by e.created_at::date
  )
  select
    ds.day,
    coalesce(ed.new_users, 0)::int as new_users,
    coalesce(ed.deleted_users, 0)::int as deleted_users,
    sum(coalesce(ed.new_users, 0) - coalesce(ed.deleted_users, 0))
      over (order by ds.day rows between unbounded preceding and current row)::bigint as cumulative_users
  from day_series ds
  left join event_daily ed on ed.day = ds.day
  order by ds.day asc;
end;
$$;

create or replace function public.rpc_founder_current_usage()
returns table (
  db_bytes bigint,
  storage_bytes bigint
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
  with storage_sum as (
    select
      coalesce(
        sum(
          case
            when (o.metadata ->> 'size') ~ '^[0-9]+$'
              then (o.metadata ->> 'size')::bigint
            else 0::bigint
          end
        ),
        0::bigint
      ) as total_storage
    from storage.objects o
  )
  select
    pg_database_size(current_database())::bigint as db_bytes,
    storage_sum.total_storage::bigint as storage_bytes
  from storage_sum;
end;
$$;

revoke all on function public.rpc_founder_new_users_summary() from public;
revoke all on function public.rpc_founder_daily_growth(int) from public;
revoke all on function public.rpc_founder_current_usage() from public;
grant execute on function public.rpc_founder_new_users_summary() to authenticated, service_role;
grant execute on function public.rpc_founder_daily_growth(int) to authenticated, service_role;
grant execute on function public.rpc_founder_current_usage() to authenticated, service_role;

-- Internal usage RPC for service-role jobs (digest).
create or replace function public.rpc_internal_current_usage()
returns table (
  db_bytes bigint,
  storage_bytes bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'not authorized';
  end if;

  return query
  with storage_sum as (
    select
      coalesce(
        sum(
          case
            when (o.metadata ->> 'size') ~ '^[0-9]+$'
              then (o.metadata ->> 'size')::bigint
            else 0::bigint
          end
        ),
        0::bigint
      ) as total_storage
    from storage.objects o
  )
  select
    pg_database_size(current_database())::bigint as db_bytes,
    storage_sum.total_storage::bigint as storage_bytes
  from storage_sum;
end;
$$;

revoke all on function public.rpc_internal_current_usage() from public;
grant execute on function public.rpc_internal_current_usage() to service_role;

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.app_events enable row level security;
alter table public.founder_admins enable row level security;
alter table public.founder_settings enable row level security;
alter table public.platform_limits enable row level security;

drop policy if exists app_events_founder_select on public.app_events;
create policy app_events_founder_select
on public.app_events
for select
to authenticated
using (public.is_founder(auth.uid()));

drop policy if exists founder_admins_founder_select on public.founder_admins;
create policy founder_admins_founder_select
on public.founder_admins
for select
to authenticated
using (public.is_founder(auth.uid()));

drop policy if exists founder_admins_founder_write on public.founder_admins;
create policy founder_admins_founder_write
on public.founder_admins
for all
to authenticated
using (public.is_founder(auth.uid()))
with check (public.is_founder(auth.uid()));

drop policy if exists founder_settings_founder_select on public.founder_settings;
create policy founder_settings_founder_select
on public.founder_settings
for select
to authenticated
using (public.is_founder(auth.uid()));

drop policy if exists founder_settings_founder_write on public.founder_settings;
create policy founder_settings_founder_write
on public.founder_settings
for all
to authenticated
using (public.is_founder(auth.uid()))
with check (public.is_founder(auth.uid()));

drop policy if exists platform_limits_founder_select on public.platform_limits;
create policy platform_limits_founder_select
on public.platform_limits
for select
to authenticated
using (public.is_founder(auth.uid()));

drop policy if exists platform_limits_founder_write on public.platform_limits;
create policy platform_limits_founder_write
on public.platform_limits
for all
to authenticated
using (public.is_founder(auth.uid()))
with check (public.is_founder(auth.uid()));

-- ============================================================================
-- Seed constants (upsert-safe)
-- ============================================================================

insert into public.platform_limits (platform, limits, updated_at)
values (
  'supabase',
  jsonb_build_object(
    'database_size_bytes', 524288000,
    'storage_size_bytes', 1073741824,
    'egress_bytes', 5368709120,
    'edge_function_invocations', 500000,
    'realtime_message_count', 2000000,
    'realtime_peak_connections', 200,
    'monthly_active_users', 50000
  ),
  now()
)
on conflict (platform) do update
set limits = excluded.limits,
    updated_at = now();

insert into public.platform_limits (platform, limits, updated_at)
values (
  'vercel',
  jsonb_build_object(
    'fast_data_transfer_bytes', 107374182400,
    'edge_requests_monthly', 1000000,
    'function_invocations', 1000000,
    'function_duration_gb_hours', 100,
    'build_execution_hours', 100
  ),
  now()
)
on conflict (platform) do update
set limits = excluded.limits,
    updated_at = now();

insert into public.founder_settings (id, digest_time_local, updated_at)
values (1, '07:00', now())
on conflict (id) do nothing;
