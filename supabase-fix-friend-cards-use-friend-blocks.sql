-- One-time fix: replace RPCs that referenced public.blocks so they use public.friend_blocks.
-- Run this if you see: relation "public.blocks" does not exist (e.g. after renaming blocks -> friend_blocks).
-- Fixes: rpc_get_friend_cards, rpc_get_incoming_friend_requests.
-- rpc_get_friend_cards requires: get_viewer_local_date(), friend_visibility_prefs, streak_state, daily_sum_exercises, daily_target_status.
-- If rpc_get_friend_cards fails due to missing objects, run supabase-friends-signals-step3.sql; then run supabase-friends-accepted-notification.sql for incoming.

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

-- ============================================================================
-- rpc_get_incoming_friend_requests() — use friend_blocks (not blocks)
-- ============================================================================
drop function if exists public.rpc_get_incoming_friend_requests();
create or replace function public.rpc_get_incoming_friend_requests()
returns table (
  friend_request_id uuid,
  requester_user_id uuid,
  requester_first_name text,
  requester_avatar_url text,
  requester_avoid text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fr.id as friend_request_id,
    fr.requester_user_id,
    p.first_name as requester_first_name,
    p.avatar_url as requester_avatar_url,
    p.avoid as requester_avoid,
    fr.created_at
  from public.friend_requests fr
  left join public.profiles p
    on p.user_id = fr.requester_user_id
  where fr.target_user_id = auth.uid()
    and fr.status = 'pending'
    and not exists (
      select 1
      from public.friend_blocks b
      where (b.blocker_user_id = auth.uid() and b.blocked_user_id = fr.requester_user_id)
         or (b.blocker_user_id = fr.requester_user_id and b.blocked_user_id = auth.uid())
    )
  order by fr.created_at desc;
$$;

revoke all on function public.rpc_get_incoming_friend_requests() from public;
grant execute on function public.rpc_get_incoming_friend_requests() to authenticated;
