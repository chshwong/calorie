-- 1) Table
create table if not exists public.daily_sum_meds (
  user_id uuid not null,
  date date not null,

  med_count int not null default 0,
  supp_count int not null default 0,

  updated_at timestamptz not null default now(),

  primary key (user_id, date)
);

-- 2) Indexes (critical)
-- Primary key already gives (user_id, date) access; add a DESC index for "recent days" queries.
create index if not exists daily_sum_meds_user_date_desc_idx
  on public.daily_sum_meds (user_id, date desc);

-- 3) RLS (mirror existing patterns)
alter table public.daily_sum_meds enable row level security;

drop policy if exists daily_sum_meds_select_own on public.daily_sum_meds;
create policy daily_sum_meds_select_own
on public.daily_sum_meds for select
using (auth.uid() = user_id);

drop policy if exists daily_sum_meds_insert_own on public.daily_sum_meds;
create policy daily_sum_meds_insert_own
on public.daily_sum_meds for insert
with check (auth.uid() = user_id);

drop policy if exists daily_sum_meds_update_own on public.daily_sum_meds;
create policy daily_sum_meds_update_own
on public.daily_sum_meds for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists daily_sum_meds_delete_own on public.daily_sum_meds;
create policy daily_sum_meds_delete_own
on public.daily_sum_meds for delete
using (auth.uid() = user_id);

-- 4) Recompute function (single source of truth)
-- Treats legacy 'other' type as 'med' to match UI behavior
create or replace function public.recompute_daily_sum_meds(p_user_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_med_count int;
  v_supp_count int;
begin
  select
    coalesce(sum(case when type in ('med', 'other') then 1 else 0 end), 0)::int as med_count,
    coalesce(sum(case when type = 'supp' then 1 else 0 end), 0)::int as supp_count
  into
    v_med_count,
    v_supp_count
  from public.med_log
  where user_id = p_user_id
    and date = p_date;

  if v_med_count = 0 and v_supp_count = 0 then
    delete from public.daily_sum_meds
    where user_id = p_user_id and date = p_date;
  else
    insert into public.daily_sum_meds (
      user_id, date,
      med_count, supp_count,
      updated_at
    )
    values (
      p_user_id, p_date,
      v_med_count, v_supp_count,
      now()
    )
    on conflict (user_id, date)
    do update set
      med_count = excluded.med_count,
      supp_count = excluded.supp_count,
      updated_at = now();
  end if;
end;
$$;

-- Do not expose internal function (trigger-only)
revoke all on function public.recompute_daily_sum_meds(uuid, date) from public;

-- 5) Trigger function + trigger on med_log
create or replace function public.tg_med_log_recompute_daily_sum_meds()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.recompute_daily_sum_meds(new.user_id, new.date);
    return new;
  elsif (tg_op = 'UPDATE') then
    perform public.recompute_daily_sum_meds(old.user_id, old.date);
    perform public.recompute_daily_sum_meds(new.user_id, new.date);
    return new;
  elsif (tg_op = 'DELETE') then
    perform public.recompute_daily_sum_meds(old.user_id, old.date);
    return old;
  end if;

  return null;
end;
$$;

-- Trigger functions are not meant to be invoked directly
revoke all on function public.tg_med_log_recompute_daily_sum_meds() from public;

drop trigger if exists trg_med_log_recompute_daily_sum_meds on public.med_log;

create trigger trg_med_log_recompute_daily_sum_meds
after insert or update or delete on public.med_log
for each row
execute function public.tg_med_log_recompute_daily_sum_meds();

-- 6) Indexes on med_log (critical for recompute + date screens)
-- Ensure these exist (names can differ; use IF NOT EXISTS)
-- Note: med_log_user_date_idx already exists from med-log-setup.sql, but we add type index for recompute performance
create index if not exists med_log_user_date_type_idx
  on public.med_log (user_id, date, type);

-- 7) One-time backfill (safe to re-run)
insert into public.daily_sum_meds (
  user_id, date,
  med_count, supp_count,
  updated_at
)
select
  user_id,
  date,
  coalesce(sum(case when type in ('med', 'other') then 1 else 0 end), 0)::int as med_count,
  coalesce(sum(case when type = 'supp' then 1 else 0 end), 0)::int as supp_count,
  now()
from public.med_log
group by user_id, date
on conflict (user_id, date)
do update set
  med_count = excluded.med_count,
  supp_count = excluded.supp_count,
  updated_at = now();

