-- Announcement Images (Pattern 2) - WEB MVP
-- - Admin can attach up to 3 compressed images to draft announcements
-- - Storage bucket is PUBLIC (read via getPublicUrl)
-- - Admin-only writes to storage.objects for this bucket
-- - image_paths stored on announcements row (no per-user duplication)

-- ============================================================================
-- 1) Schema: announcements.image_paths
-- ============================================================================

alter table public.announcements
  add column if not exists image_paths jsonb null;

do $$
begin
  -- Keep DB simple: image_paths is NULL or JSON array
  alter table public.announcements
    add constraint announcements_image_paths_is_array
    check (image_paths is null or jsonb_typeof(image_paths) = 'array');
exception
  when duplicate_object then
    null;
end;
$$;

-- ============================================================================
-- 2) Immutability after publish: lock image_paths too
-- ============================================================================

create or replace function public.tg_announcements_block_published_updates()
returns trigger
language plpgsql
as $$
begin
  if old.is_published then
    if new.title_i18n is distinct from old.title_i18n
      or new.body_i18n is distinct from old.body_i18n
      or new.link_path is distinct from old.link_path
      or new.image_paths is distinct from old.image_paths
      or new.is_published is distinct from old.is_published
      or new.published_at is distinct from old.published_at
    then
      raise exception 'published announcement content is immutable';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger already exists and references this function; no need to recreate it.

-- ============================================================================
-- 3) Storage: announcement-images bucket (PUBLIC read) + admin-only writes
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('announcement-images', 'announcement-images', true)
on conflict (id) do nothing;

-- NOTE: Bucket is PUBLIC, so reads use public URLs (no signed URLs).
-- No SELECT policy is required for reads in MVP.

-- Admin-only writes (bucket-scoped; do not grant writes to other buckets).
drop policy if exists "announcement_images_admin_insert" on storage.objects;
create policy "announcement_images_admin_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'announcement-images'
  and public.is_admin() = true
);

drop policy if exists "announcement_images_admin_update" on storage.objects;
create policy "announcement_images_admin_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'announcement-images'
  and public.is_admin() = true
)
with check (
  bucket_id = 'announcement-images'
  and public.is_admin() = true
);

drop policy if exists "announcement_images_admin_delete" on storage.objects;
create policy "announcement_images_admin_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'announcement-images'
  and public.is_admin() = true
);

