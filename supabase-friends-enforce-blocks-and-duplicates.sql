-- Friends: enforce block rules + prevent duplicate/invalid requests.
-- - Adds is_blocked(a uuid, b uuid) helper
-- - Updates rpc_send_friend_request: block, already friends, outgoing pending, incoming pending
-- - Updates rpc_accept_friend_request: is_blocked check + idempotency
-- Run after supabase-friends-setup.sql. Idempotent.

-- ============================================================================
-- 1) Helper: is_blocked(a uuid, b uuid)
-- ============================================================================
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friend_blocks fb
    where (fb.blocker_user_id = a and fb.blocked_user_id = b)
       or (fb.blocker_user_id = b and fb.blocked_user_id = a)
  );
$$;

revoke all on function public.is_blocked(uuid, uuid) from public;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

-- ============================================================================
-- 2) rpc_send_friend_request — full checks then insert
-- ============================================================================
create or replace function public.rpc_send_friend_request(
  p_target_type text,
  p_target_value text,
  p_note_key text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester uuid;
  v_target_user_id uuid := null;
  v_target_email text := null;
  v_target_avoid text := null;
  v_val text;
begin
  v_requester := auth.uid();
  if v_requester is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  v_val := lower(btrim(p_target_value));
  if v_val = '' then
    raise exception 'target_value_required' using errcode = 'P0002';
  end if;

  if p_target_type = 'avoid' then
    v_target_avoid := btrim(p_target_value);
    select user_id into v_target_user_id
    from public.profiles
    where lower(avoid) = lower(v_target_avoid);

    if v_target_user_id = v_requester then
      raise exception 'cannot_request_self' using errcode = 'P0003';
    end if;

    if v_target_user_id is not null then
      if exists (
        select 1 from public.friend_blocks
        where blocker_user_id = v_requester and blocked_user_id = v_target_user_id
      ) then
        raise exception 'unblock_first' using errcode = 'P0014';
      end if;
      if exists (
        select 1 from public.friends f
        where (f.user_id = v_requester and f.friend_user_id = v_target_user_id)
           or (f.user_id = v_target_user_id and f.friend_user_id = v_requester)
      ) then
        raise exception 'already_friends' using errcode = 'P0011';
      end if;
      if exists (
        select 1 from public.friend_requests
        where requester_user_id = v_target_user_id and target_user_id = v_requester and status = 'pending'
      ) then
        raise exception 'they_sent_you_request' using errcode = 'P0013';
      end if;
      insert into public.friend_requests (requester_user_id, target_user_id, target_avoid, requested_via, note_key)
      values (v_requester, v_target_user_id, v_target_avoid, 'avoid', p_note_key)
      on conflict (requester_user_id, target_user_id) where (status = 'pending' and target_user_id is not null) do nothing;
      return;
    else
      if exists (
        select 1 from public.friend_requests
        where requester_user_id = v_requester and lower(target_avoid) = lower(v_target_avoid) and status = 'pending'
      ) then
        raise exception 'request_already_sent' using errcode = 'P0012';
      end if;
      insert into public.friend_requests (requester_user_id, target_user_id, target_avoid, requested_via, note_key)
      values (v_requester, v_target_user_id, v_target_avoid, 'avoid', p_note_key);
      return;
    end if;

  elsif p_target_type = 'email' then
    v_target_email := btrim(p_target_value);
    select au.id into v_target_user_id
    from auth.users au
    join public.profiles p on p.user_id = au.id
    where lower(au.email) = lower(v_target_email)
      and p.email_discoverable = true;

    if v_target_user_id = v_requester then
      raise exception 'cannot_request_self' using errcode = 'P0003';
    end if;

    if v_target_user_id is not null then
      if exists (
        select 1 from public.friend_blocks
        where blocker_user_id = v_requester and blocked_user_id = v_target_user_id
      ) then
        raise exception 'unblock_first' using errcode = 'P0014';
      end if;
      if exists (
        select 1 from public.friends f
        where (f.user_id = v_requester and f.friend_user_id = v_target_user_id)
           or (f.user_id = v_target_user_id and f.friend_user_id = v_requester)
      ) then
        raise exception 'already_friends' using errcode = 'P0011';
      end if;
      if exists (
        select 1 from public.friend_requests
        where requester_user_id = v_target_user_id and target_user_id = v_requester and status = 'pending'
      ) then
        raise exception 'they_sent_you_request' using errcode = 'P0013';
      end if;
      insert into public.friend_requests (requester_user_id, target_user_id, target_email, requested_via, note_key)
      values (v_requester, v_target_user_id, v_target_email, 'email', p_note_key)
      on conflict (requester_user_id, target_user_id) where (status = 'pending' and target_user_id is not null) do nothing;
      return;
    else
      if exists (
        select 1 from public.friend_requests
        where requester_user_id = v_requester and lower(target_email) = lower(v_target_email) and status = 'pending'
      ) then
        raise exception 'request_already_sent' using errcode = 'P0012';
      end if;
      insert into public.friend_requests (requester_user_id, target_user_id, target_email, requested_via, note_key)
      values (v_requester, v_target_user_id, v_target_email, 'email', p_note_key);
      return;
    end if;

  else
    raise exception 'invalid_target_type' using errcode = 'P0004';
  end if;
end;
$$;

revoke all on function public.rpc_send_friend_request(text, text, text) from public;
grant execute on function public.rpc_send_friend_request(text, text, text) to authenticated;

-- ============================================================================
-- 3) rpc_accept_friend_request — is_blocked + idempotency then accept + notify requester
-- ============================================================================
create or replace function public.rpc_accept_friend_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester uuid;
  v_target uuid;
  v_accepter_first_name text;
  v_accepter_avatar_url text;
  v_accepter_avoid text;
begin
  select requester_user_id, target_user_id into v_requester, v_target
  from public.friend_requests
  where id = p_request_id and status = 'pending';

  if not found or v_target != auth.uid() then
    raise exception 'request_not_found_or_unauthorized' using errcode = 'P0001';
  end if;

  if public.is_blocked(v_requester, v_target) then
    raise exception 'blocked' using errcode = 'P0010';
  end if;

  update public.friend_requests set status = 'accepted', updated_at = now() where id = p_request_id;

  insert into public.friends (user_id, friend_user_id)
  values (auth.uid(), v_requester), (v_requester, auth.uid())
  on conflict (user_id, friend_user_id) do nothing;

  -- Accepter display fields for requester's inbox (idempotent via unique index)
  select p.first_name, p.avatar_url, p.avoid
  into v_accepter_first_name, v_accepter_avatar_url, v_accepter_avoid
  from public.profiles p
  where p.user_id = auth.uid();

  insert into public.notifications (user_id, type, link_path, meta)
  values (
    v_requester,
    'friend_request_accepted',
    '/friends',
    jsonb_build_object(
      'accepter_user_id', auth.uid(),
      'accepter_first_name', v_accepter_first_name,
      'accepter_avatar_url', v_accepter_avatar_url,
      'accepter_avoid', v_accepter_avoid,
      'friend_request_id', p_request_id
    )
  )
  on conflict do nothing;
end;
$$;

revoke all on function public.rpc_accept_friend_request(uuid) from public;
grant execute on function public.rpc_accept_friend_request(uuid) to authenticated;
