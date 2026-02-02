-- Step 3: Friend status signals (daily_target_status canonical)
-- - Adds get_viewer_local_date() (viewer-local today from profiles.timezone; no params)
-- - Adds rpc_get_friend_cards(p_date date default null) (friends-only, block-filtered, daily_target_status only)

-- ============================================================================
-- 1) Helper: get_viewer_local_date()
-- ============================================================================

drop function if exists public.get_viewer_local_date();
create or replace function public.get_viewer_local_date()
returns date
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_timezone text;
begin
  select p.timezone into v_timezone
  from public.profiles p
  where p.user_id = auth.uid();

  if v_timezone is null or btrim(v_timezone) = '' then
    v_timezone := 'UTC';
  end if;

  -- Invalid tz must not throw: validate against pg_timezone_names
  if not exists (
    select 1
    from pg_catalog.pg_timezone_names t
    where t.name = v_timezone
  ) then
    v_timezone := 'UTC';
  end if;

  return (now() at time zone v_timezone)::date;
end;
$$;

revoke all on function public.get_viewer_local_date() from public;
grant execute on function public.get_viewer_local_date() to authenticated;

-- ============================================================================
-- 2) RPC: rpc_get_friend_cards(p_date default null)
-- ============================================================================

-- Postgres cannot change OUT-parameter row types via CREATE OR REPLACE; drop by signature.
drop function if exists public.rpc_get_friend_cards(date);
create or replace function public.rpc_get_friend_cards(p_date date default null)
returns table (
  friend_user_id uuid,
  first_name text,
  avatar_url text,
  avoid text,
  protein_state text,
  fibre_state text,
  water_state text,
  steps integer,
  food_streak_days integer,
  logged_today boolean,
  entry_date date
)
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select coalesce(p_date, public.get_viewer_local_date()) as entry_date
  ),
  allowed_friends as (
    select f.friend_user_id
    from public.friends f
    where f.user_id = auth.uid()
      and not exists (
        select 1
        from public.friend_blocks b
        where (b.blocker_user_id = auth.uid() and b.blocked_user_id = f.friend_user_id)
           or (b.blocker_user_id = f.friend_user_id and b.blocked_user_id = auth.uid())
      )
  )
  select
    af.friend_user_id,
    p.first_name,
    p.avatar_url,
    p.avoid,
    case
      when coalesce(fvp.show_protein, true) then coalesce(dts.protein_state::text, 'none')
      else null
    end as protein_state,
    case
      when coalesce(fvp.show_fibre, true) then coalesce(dts.fibre_state::text, 'none')
      else null
    end as fibre_state,
    case
      when coalesce(fvp.show_water, true) then coalesce(dts.water_state::text, 'none')
      else null
    end as water_state,
    case
      when coalesce(fvp.show_steps, true) then coalesce(dse.steps, 0)
      else null
    end as steps,
    case
      when coalesce(fvp.show_food_streak, true) then coalesce(ss.food_current_days, 0)
      else null
    end as food_streak_days,
    (dts.user_id is not null) as logged_today,
    v.entry_date
  from allowed_friends af
  cross join viewer v
  left join public.profiles p
    on p.user_id = af.friend_user_id
  left join public.friend_visibility_prefs fvp
    on fvp.user_id = af.friend_user_id
  left join public.streak_state ss
    on ss.user_id = af.friend_user_id
  left join public.daily_sum_exercises dse
    on dse.user_id = af.friend_user_id
   and dse.date = v.entry_date
  left join public.daily_target_status dts
    on dts.user_id = af.friend_user_id
   and dts.entry_date = v.entry_date
  order by p.first_name nulls last, p.avoid, af.friend_user_id;
$$;

revoke all on function public.rpc_get_friend_cards(date) from public;
grant execute on function public.rpc_get_friend_cards(date) to authenticated;

