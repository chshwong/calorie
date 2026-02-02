-- Outgoing friend requests: do NOT reveal resolved AvoID for email-based requests.
-- Per engineering-guidelines: Outgoing list must only show the identifier the requester used.
--
-- Changes:
-- - get_outgoing_friend_requests: remove JOIN to profiles; do NOT return target_resolved_avoid.
-- - Outgoing UI will derive display from requested_via + target_email/target_avoid only.
--
-- Run after supabase-friends-setup.sql. Idempotent.

drop function if exists public.get_outgoing_friend_requests();
create or replace function public.get_outgoing_friend_requests()
returns table (
  id uuid,
  target_user_id uuid,
  target_avoid text,
  target_email text,
  requested_via text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    fr.id,
    fr.target_user_id,
    fr.target_avoid,
    fr.target_email,
    fr.requested_via,
    fr.created_at
  from public.friend_requests fr
  where fr.requester_user_id = auth.uid() and fr.status = 'pending'
  order by fr.created_at desc;
$$;

revoke all on function public.get_outgoing_friend_requests() from public;
grant execute on function public.get_outgoing_friend_requests() to authenticated;
