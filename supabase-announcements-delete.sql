-- Announcements - Admin delete support (RLS + FK cascade)
--
-- Goals:
-- - Admin can DELETE announcements
-- - Deleting an announcement cascades notifications cleanup via FK
-- - RLS must allow the cascade delete of notifications for admin

-- ============================================================================
-- 1) Ensure FK cascade exists: notifications.announcement_id -> announcements.id
-- ============================================================================

alter table public.notifications
  drop constraint if exists notifications_announcement_id_fkey;

alter table public.notifications
  add constraint notifications_announcement_id_fkey
  foreign key (announcement_id)
  references public.announcements(id)
  on delete cascade;

-- ============================================================================
-- 2) RLS: allow admin deletes (announcements + notifications)
-- ============================================================================

-- announcements: admin-only delete
drop policy if exists announcements_admin_delete on public.announcements;
create policy announcements_admin_delete
on public.announcements
for delete
to authenticated
using (public.is_admin() = true);

-- notifications: admin-only delete (required so FK cascade can succeed under RLS)
drop policy if exists notifications_admin_delete on public.notifications;
create policy notifications_admin_delete
on public.notifications
for delete
to authenticated
using (public.is_admin() = true);

