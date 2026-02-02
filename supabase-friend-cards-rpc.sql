-- Step 3.1: Friend cards + remove friend + friend request notifications
-- Assumes `public.daily_target_status` already exists and is populated (canonical target-state source).
-- Assumes `public.notifications` table exists (see supabase-announcements-notifications.sql).

-- ============================================================================
-- 1) RPC: rpc_get_friend_cards(p_date)
-- Target states come ONLY from public.daily_target_status (no recompute).
-- ============================================================================

-- NOTE: Postgres cannot change a function's OUT-parameter row type via CREATE OR REPLACE.
-- Drop first to keep this migration re-runnable.
drop function if exists public.rpc_get_friend_cards(date);

create or replace function public.rpc_get_friend_cards(p_date date)
returns table (
  friend_user_id uuid,
  friend_avoid text,
  friend_first_name text,
  friend_avatar_url text,
  protein_state text,
  fibre_state text,
  water_state text,
  logged_today boolean
)
language plpgsql
stable
security definer
as $$
begin
  -- SECURITY DEFINER hardening: safe search_path
  perform set_config('search_path', 'public', true);

  return query
  select
    f.friend_user_id,
    p.avoid as friend_avoid,
    p.first_name as friend_first_name,
    p.avatar_url as friend_avatar_url,
    dts.protein_state::text,
    dts.fibre_state::text,
    dts.water_state::text,
    dts.logged_today
  from public.friends f
  left join public.profiles p
    on p.user_id = f.friend_user_id
  left join public.daily_target_status dts
    on dts.user_id = f.friend_user_id
   and dts.entry_date = p_date
  where f.user_id = auth.uid()
  order by f.created_at desc;
end;
$$;

revoke all on function public.rpc_get_friend_cards(date) from public;
grant execute on function public.rpc_get_friend_cards(date) to authenticated;

-- ============================================================================
-- 2) RPC: rpc_remove_friend(p_friend_user_id)
-- Deletes both friend directions. Silent (no notification).
-- ============================================================================

-- Safe re-run if signature/body changes
drop function if exists public.rpc_remove_friend(uuid);

create or replace function public.rpc_remove_friend(p_friend_user_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
begin
  perform set_config('search_path', 'public', true);

  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_friend_user_id is null then
    raise exception 'friend_user_id is required';
  end if;

  delete from public.friends
  where (user_id = v_user_id and friend_user_id = p_friend_user_id)
     or (user_id = p_friend_user_id and friend_user_id = v_user_id);
end;
$$;

revoke all on function public.rpc_remove_friend(uuid) from public;
grant execute on function public.rpc_remove_friend(uuid) to authenticated;

-- ============================================================================
-- 3) Notifications: friend_request notification on incoming pending request
-- Creates notifications only for target_user_id (incoming requests).
-- ============================================================================

create or replace function public.trg_friend_request_notify()
returns trigger
language plpgsql
security definer
as $$
begin
  perform set_config('search_path', 'public', true);

  -- Only incoming requests with a resolved user_id create notifications.
  if new.status = 'pending' and new.target_user_id is not null then
    insert into public.notifications (user_id, type, link_path, meta)
    values (
      new.target_user_id,
      'friend_request',
      '/friends',
      jsonb_build_object(
        'request_id', new.id,
        'requester_user_id', new.requester_user_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_friend_request_notify on public.friend_requests;
create trigger trg_friend_request_notify
  after insert on public.friend_requests
  for each row execute function public.trg_friend_request_notify();

