-- One-time migration: rename public.blocks to public.friend_blocks (friend_ prefix).
-- Run this only if you already have the table named "blocks" from an earlier migration.
-- New installs use supabase-friends-setup.sql which creates friend_blocks directly.

-- Rename table (policies and index stay attached; policy names remain blocks_* unless we drop/recreate).
alter table if exists public.blocks rename to friend_blocks;

-- Optionally rename policies for consistency with friend_blocks naming.
drop policy if exists "blocks_select" on public.friend_blocks;
create policy "friend_blocks_select" on public.friend_blocks
  for select to authenticated
  using (blocker_user_id = auth.uid());

drop policy if exists "blocks_insert" on public.friend_blocks;
create policy "friend_blocks_insert" on public.friend_blocks
  for insert to authenticated
  with check (blocker_user_id = auth.uid());

drop policy if exists "blocks_delete" on public.friend_blocks;
create policy "friend_blocks_delete" on public.friend_blocks
  for delete to authenticated
  using (blocker_user_id = auth.uid());

-- Optionally rename index for consistency.
drop index if exists public.idx_blocks_blocker;
create index if not exists idx_friend_blocks_blocker on public.friend_blocks (blocker_user_id);
