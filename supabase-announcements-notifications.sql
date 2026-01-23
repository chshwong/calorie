-- 1) Helper: is_admin()
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false);
$$;

-- 2) announcements table (canonical content)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  published_at timestamptz null,
  is_published boolean not null default false,
  title_i18n jsonb not null,
  body_i18n jsonb not null,
  link_path text null,
  constraint announcements_title_i18n_has_en check (title_i18n ? 'en'),
  constraint announcements_body_i18n_has_en check (body_i18n ? 'en'),
  constraint announcements_link_path_valid check (link_path is null or link_path like '/%'),
  constraint announcements_title_en_nonempty_on_publish check (
    not is_published or length(btrim(coalesce(title_i18n->>'en', ''))) > 0
  ),
  constraint announcements_body_en_nonempty_on_publish check (
    not is_published or length(btrim(coalesce(body_i18n->>'en', ''))) > 0
  )
);

-- updated_at trigger (reuse existing pattern if you have one; otherwise create minimal)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_announcements_updated_at on public.announcements;
create trigger trg_announcements_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

-- Immutable content fields after publish (field-level)
create or replace function public.tg_announcements_block_published_updates()
returns trigger
language plpgsql
as $$
begin
  if old.is_published then
    if new.title_i18n is distinct from old.title_i18n
      or new.body_i18n is distinct from old.body_i18n
      or new.link_path is distinct from old.link_path
      or new.is_published is distinct from old.is_published
      or new.published_at is distinct from old.published_at
    then
      raise exception 'published announcement content is immutable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_announcements_block_published_updates on public.announcements;
create trigger trg_announcements_block_published_updates
before update on public.announcements
for each row execute function public.tg_announcements_block_published_updates();

-- 3) notifications table (per-user inbox rows)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null,
  type text not null,
  announcement_id uuid null references public.announcements(id) on delete cascade,
  link_path text null,
  read_at timestamptz null,
  meta jsonb null,
  constraint notifications_unique_delivery unique (user_id, type, announcement_id)
);

-- 4) Indexes (avoid DB inefficiency)
-- inbox list: user_id + created_at desc + id desc (keyset)
create index if not exists idx_notifications_user_created_id_desc
  on public.notifications (user_id, created_at desc, id desc);

-- unread badge: fast path via partial index
create index if not exists idx_notifications_unread_user
  on public.notifications (user_id)
  where read_at is null;

-- admin stats by announcement
create index if not exists idx_notifications_announcement
  on public.notifications (announcement_id);

-- announcements published listing
create index if not exists idx_announcements_published_at
  on public.announcements (is_published, published_at desc);

-- 5) Broadcast publish function (transactional)
create or replace function public.publish_announcement(p_announcement_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title jsonb;
  v_body jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select a.title_i18n, a.body_i18n
  into v_title, v_body
  from public.announcements a
  where a.id = p_announcement_id;

  if v_title is null then
    raise exception 'announcement not found';
  end if;

  if length(btrim(coalesce(v_title->>'en', ''))) = 0 then
    raise exception 'announcement title (en) is required';
  end if;

  if length(btrim(coalesce(v_body->>'en', ''))) = 0 then
    raise exception 'announcement body (en) is required';
  end if;

  update public.announcements
  set is_published = true,
      published_at = coalesce(published_at, now())
  where id = p_announcement_id;

  insert into public.notifications (user_id, type, announcement_id)
  select p.user_id, 'announcement', p_announcement_id
  from public.profiles p
  on conflict (user_id, type, announcement_id) do nothing;
end;
$$;

-- 6) Mark notification read (RPC)
create or replace function public.mark_notification_read(notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1 from public.notifications
    where id = notification_id and user_id = v_user_id
  ) then
    raise exception 'not authorized';
  end if;

  update public.notifications
  set read_at = now()
  where id = notification_id
    and user_id = v_user_id
    and read_at is null;
end;
$$;

-- 6b) Get announcement notification stats (RPC)
-- Returns read/total counts per announcement for admin list
create or replace function public.get_announcement_notification_stats(p_announcement_ids uuid[])
returns table (
  announcement_id uuid,
  total bigint,
  read bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  return query
  select
    n.announcement_id,
    count(*)::bigint as total,
    count(*) filter (where n.read_at is not null)::bigint as read
  from public.notifications n
  where n.announcement_id = any(p_announcement_ids)
  group by n.announcement_id;
end;
$$;

-- 7) RLS
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;

-- announcements policies
drop policy if exists announcements_read_published on public.announcements;
create policy announcements_read_published
on public.announcements
for select
to authenticated
using (is_published = true or public.is_admin());

drop policy if exists announcements_admin_insert on public.announcements;
create policy announcements_admin_insert
on public.announcements
for insert
to authenticated
with check (public.is_admin() = true);

drop policy if exists announcements_admin_update on public.announcements;
create policy announcements_admin_update
on public.announcements
for update
to authenticated
using (public.is_admin() = true)
with check (public.is_admin() = true);

-- notifications policies
drop policy if exists notifications_user_mark_read on public.notifications;
drop policy if exists notifications_user_update_own on public.notifications;

drop policy if exists notifications_user_read_own on public.notifications;
create policy notifications_user_read_own
on public.notifications
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_admin_insert on public.notifications;
create policy notifications_admin_insert
on public.notifications
for insert
to authenticated
with check (public.is_admin() = true);
