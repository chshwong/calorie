-- 1) Table
create table if not exists public.daily_sum_exercises (
  user_id uuid not null,
  date date not null,

  activity_count int not null default 0,

  cardio_count int not null default 0,
  cardio_minutes int not null default 0,
  cardio_distance_km numeric(12,4) not null default 0,

  strength_count int not null default 0,

  updated_at timestamptz not null default now(),

  primary key (user_id, date)
);

-- 2) Indexes (critical)
-- Primary key already gives (user_id, date) access; add a DESC index for "recent days" queries.
create index if not exists daily_sum_exercises_user_date_desc_idx
  on public.daily_sum_exercises (user_id, date desc);

-- 3) RLS (mirror existing patterns)
alter table public.daily_sum_exercises enable row level security;

drop policy if exists daily_sum_exercises_select_own on public.daily_sum_exercises;
create policy daily_sum_exercises_select_own
on public.daily_sum_exercises for select
using (auth.uid() = user_id);

drop policy if exists daily_sum_exercises_insert_own on public.daily_sum_exercises;
create policy daily_sum_exercises_insert_own
on public.daily_sum_exercises for insert
with check (auth.uid() = user_id);

drop policy if exists daily_sum_exercises_update_own on public.daily_sum_exercises;
create policy daily_sum_exercises_update_own
on public.daily_sum_exercises for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists daily_sum_exercises_delete_own on public.daily_sum_exercises;
create policy daily_sum_exercises_delete_own
on public.daily_sum_exercises for delete
using (auth.uid() = user_id);

-- 4) Recompute function (single source of truth)
create or replace function public.recompute_daily_sum_exercises(p_user_id uuid, p_date date)
returns void
language plpgsql
security definer
as $$
declare
  v_activity_count int;
  v_cardio_count int;
  v_cardio_minutes int;
  v_cardio_distance_km numeric(12,4);
  v_strength_count int;
begin
  select
    count(*)::int as activity_count,

    coalesce(sum(case when category = 'cardio_mind_body' then 1 else 0 end), 0)::int as cardio_count,
    coalesce(sum(case when category = 'cardio_mind_body' then coalesce(minutes, 0) else 0 end), 0)::int as cardio_minutes,
    round(coalesce(sum(case when category = 'cardio_mind_body' then coalesce(distance_km, 0) else 0 end), 0)::numeric, 4) as cardio_distance_km,

    coalesce(sum(case when category = 'strength' then 1 else 0 end), 0)::int as strength_count
  into
    v_activity_count,
    v_cardio_count,
    v_cardio_minutes,
    v_cardio_distance_km,
    v_strength_count
  from public.exercise_log
  where user_id = p_user_id
    and date = p_date;

  if v_activity_count = 0 then
    delete from public.daily_sum_exercises
    where user_id = p_user_id and date = p_date;
  else
    insert into public.daily_sum_exercises (
      user_id, date,
      activity_count,
      cardio_count, cardio_minutes, cardio_distance_km,
      strength_count,
      updated_at
    )
    values (
      p_user_id, p_date,
      v_activity_count,
      v_cardio_count, v_cardio_minutes, v_cardio_distance_km,
      v_strength_count,
      now()
    )
    on conflict (user_id, date)
    do update set
      activity_count = excluded.activity_count,
      cardio_count = excluded.cardio_count,
      cardio_minutes = excluded.cardio_minutes,
      cardio_distance_km = excluded.cardio_distance_km,
      strength_count = excluded.strength_count,
      updated_at = now();
  end if;
end;
$$;

-- 5) Trigger function + trigger on exercise_log
create or replace function public.tg_exercise_log_recompute_daily_sum_exercises()
returns trigger
language plpgsql
security definer
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.recompute_daily_sum_exercises(new.user_id, new.date);
    return new;
  elsif (tg_op = 'UPDATE') then
    perform public.recompute_daily_sum_exercises(old.user_id, old.date);
    perform public.recompute_daily_sum_exercises(new.user_id, new.date);
    return new;
  elsif (tg_op = 'DELETE') then
    perform public.recompute_daily_sum_exercises(old.user_id, old.date);
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_exercise_log_recompute_daily_sum_exercises on public.exercise_log;

create trigger trg_exercise_log_recompute_daily_sum_exercises
after insert or update or delete on public.exercise_log
for each row
execute function public.tg_exercise_log_recompute_daily_sum_exercises();

-- 6) Indexes on exercise_log (critical for recompute + date screens)
-- Ensure these exist (names can differ; use IF NOT EXISTS)
create index if not exists exercise_log_user_date_idx
  on public.exercise_log (user_id, date);

create index if not exists exercise_log_user_date_category_idx
  on public.exercise_log (user_id, date, category);

-- Optional: if you often fetch "recent/frequent exercises", this helps if you filter/sort by created_at
-- create index if not exists exercise_log_user_created_at_idx
--   on public.exercise_log (user_id, created_at desc);

-- 7) One-time backfill (safe to re-run)
insert into public.daily_sum_exercises (
  user_id, date,
  activity_count,
  cardio_count, cardio_minutes, cardio_distance_km,
  strength_count,
  updated_at
)
select
  user_id,
  date,
  count(*)::int as activity_count,

  coalesce(sum(case when category = 'cardio_mind_body' then 1 else 0 end), 0)::int as cardio_count,
  coalesce(sum(case when category = 'cardio_mind_body' then coalesce(minutes, 0) else 0 end), 0)::int as cardio_minutes,
  round(coalesce(sum(case when category = 'cardio_mind_body' then coalesce(distance_km, 0) else 0 end), 0)::numeric, 4) as cardio_distance_km,

  coalesce(sum(case when category = 'strength' then 1 else 0 end), 0)::int as strength_count,

  now()
from public.exercise_log
group by user_id, date
on conflict (user_id, date)
do update set
  activity_count = excluded.activity_count,
  cardio_count = excluded.cardio_count,
  cardio_minutes = excluded.cardio_minutes,
  cardio_distance_km = excluded.cardio_distance_km,
  strength_count = excluded.strength_count,
  updated_at = now();

