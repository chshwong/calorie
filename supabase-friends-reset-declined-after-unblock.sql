-- One-time: reset declined friend requests to pending when the recipient no longer blocks the requester.
-- Use after migrating from "blocks" to "friend_blocks" with an empty friend_blocks table, or after
-- bulk-unblocking, so that previously-blocked users' requests can appear again for the recipient.
--
-- Only updates where there is no existing pending request for the same (requester, target), so we
-- never violate idx_friend_requests_uniq_pending_user. Safe to run multiple times.

update public.friend_requests fr
set status = 'pending', updated_at = now()
where fr.status = 'declined'
  and fr.target_user_id is not null
  and fr.requester_user_id is not null
  and not exists (
    select 1 from public.friend_blocks b
    where b.blocker_user_id = fr.target_user_id
      and b.blocked_user_id = fr.requester_user_id
  )
  and not exists (
    select 1 from public.friend_requests other
    where other.requester_user_id = fr.requester_user_id
      and other.target_user_id = fr.target_user_id
      and other.status = 'pending'
      and other.id <> fr.id
  );
