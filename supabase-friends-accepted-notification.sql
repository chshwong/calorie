-- Friends enhancements: accepted notification + incoming request cards RPC
-- - Adds notification type: friend_request_accepted (stored in public.notifications.type)
-- - Adds RPC: rpc_get_incoming_friend_requests() with requester display fields (scoped + block-filtered)
-- - Updates rpc_accept_friend_request() to insert an accepted notification (idempotent)

-- ============================================================================
-- 1) Notifications idempotency for friend_request_accepted
-- ============================================================================

-- Ensure only one accepted notification per (recipient, friend_request_id)
create unique index if not exists idx_notifications_friend_request_accepted_once
  on public.notifications (
    user_id,
    type,
    (meta->>'friend_request_id')
  )
  where type = 'friend_request_accepted';

-- ============================================================================
-- 2) RPC: rpc_get_incoming_friend_requests()
-- Returns requester display fields for incoming pending requests only.
-- Does NOT broaden outgoing request visibility.
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

-- ============================================================================
-- 3) Update RPC: rpc_accept_friend_request(p_request_id)
-- Adds notification for requester: type friend_request_accepted
-- ============================================================================

drop function if exists public.rpc_accept_friend_request(uuid);
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
  -- Lookup pending request
  select requester_user_id, target_user_id
  into v_requester, v_target
  from public.friend_requests
  where id = p_request_id
    and status = 'pending';

  if not found or v_target != auth.uid() then
    raise exception 'request_not_found_or_unauthorized' using errcode = 'P0001';
  end if;

  -- Accept request
  update public.friend_requests
  set status = 'accepted', updated_at = now()
  where id = p_request_id;

  -- Create friendship (both directions)
  insert into public.friends (user_id, friend_user_id)
  values (auth.uid(), v_requester), (v_requester, auth.uid())
  on conflict (user_id, friend_user_id) do nothing;

  -- Minimal accepter display fields for inbox copy (avoid direct profile exposure in UI)
  select p.first_name, p.avatar_url, p.avoid
  into v_accepter_first_name, v_accepter_avatar_url, v_accepter_avoid
  from public.profiles p
  where p.user_id = auth.uid();

  -- Insert notification for requester (idempotent via unique index)
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

