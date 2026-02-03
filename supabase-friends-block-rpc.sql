-- Block user RPC: remove as friend (if present), decline any pending request from that user,
-- then insert into friend_blocks.
-- Callable by authenticated users; blocker is always auth.uid().

create or replace function public.rpc_block_user(p_blocked_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_blocked_user_id is null then
    return;
  end if;
  if p_blocked_user_id = auth.uid() then
    return; -- no self-block
  end if;

  -- If we are currently friends, remove friendship (both directions).
  -- Safe to run even if not friends (0 rows affected).
  delete from public.friends
  where (user_id = auth.uid() and friend_user_id = p_blocked_user_id)
     or (user_id = p_blocked_user_id and friend_user_id = auth.uid());

  -- Decline any pending friend request from this user (so it disappears from incoming).
  update public.friend_requests
  set status = 'declined'
  where target_user_id = auth.uid()
    and requester_user_id = p_blocked_user_id
    and status = 'pending';

  -- Block the user.
  insert into public.friend_blocks (blocker_user_id, blocked_user_id)
  values (auth.uid(), p_blocked_user_id)
  on conflict (blocker_user_id, blocked_user_id) do nothing;
end;
$$;

revoke all on function public.rpc_block_user(uuid) from public;
grant execute on function public.rpc_block_user(uuid) to authenticated;

-- ============================================================================
-- List blocked users (current viewer only). Returns minimal display payload.
-- ============================================================================
create or replace function public.rpc_get_blocked_users()
returns table (
  blocked_user_id uuid,
  first_name text,
  avatar_url text,
  avoid text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    fb.blocked_user_id,
    p.first_name,
    p.avatar_url,
    p.avoid,
    fb.created_at
  from public.friend_blocks fb
  left join public.profiles p on p.user_id = fb.blocked_user_id
  where fb.blocker_user_id = auth.uid()
  order by fb.created_at desc;
$$;

revoke all on function public.rpc_get_blocked_users() from public;
grant execute on function public.rpc_get_blocked_users() to authenticated;

-- ============================================================================
-- Unblock a user. Deletes only where blocker = auth.uid() and blocked = p_blocked_user_id.
-- ============================================================================
create or replace function public.rpc_unblock_user(p_blocked_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  if p_blocked_user_id is null then
    return false;
  end if;
  delete from public.friend_blocks
  where blocker_user_id = auth.uid() and blocked_user_id = p_blocked_user_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function public.rpc_unblock_user(uuid) from public;
grant execute on function public.rpc_unblock_user(uuid) to authenticated;
