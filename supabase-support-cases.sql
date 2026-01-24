-- Support Cases MVP (WEB) - Tables, RLS, RPCs, Storage
-- Requirements:
-- - Server-enforced rate limit + dedupe via RPC create_case()
-- - Admin-only replies/notes via RPC admin_add_case_message()
-- - Notifications integration via existing public.notifications table
-- - Storage: private bucket case-attachments with strict policies

-- ============================================================================
-- 0) Tables
-- ============================================================================

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null,
  category text not null,
  subject text null,
  message text not null,
  status text not null default 'new',
  resolved_at timestamptz null,
  page_path text null,
  user_agent text null,
  app_version text null,
  fingerprint text not null,
  constraint cases_category_valid check (
    category in ('bug', 'feature_request', 'food_addition', 'improvement', 'appreciation', 'other')
  ),
  constraint cases_status_valid check (status in ('new', 'in_progress', 'resolved')),
  constraint cases_fingerprint_nonempty check (length(btrim(fingerprint)) > 0)
);

create table if not exists public.case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  message text not null,
  is_internal boolean not null default false
);

create table if not exists public.case_attachments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid not null,
  storage_path text not null,
  bytes int null,
  content_type text null,
  width int null,
  height int null
);

-- ============================================================================
-- 1) Triggers
-- - Reuse existing public.set_updated_at() if already present (defined elsewhere).
-- ============================================================================

drop trigger if exists trg_cases_updated_at on public.cases;
create trigger trg_cases_updated_at
before update on public.cases
for each row execute function public.set_updated_at();

-- ============================================================================
-- 2) Indexes (keyset + filters)
-- ============================================================================

create index if not exists idx_cases_created_by_created_at_desc
  on public.cases (created_by, created_at desc);

create index if not exists idx_cases_status_created_at_desc
  on public.cases (status, created_at desc);

create index if not exists idx_cases_category_created_at_desc
  on public.cases (category, created_at desc);

create index if not exists idx_cases_created_by_fingerprint_created_at_desc
  on public.cases (created_by, fingerprint, created_at desc);

create index if not exists idx_case_messages_case_id_created_at_asc
  on public.case_messages (case_id, created_at asc);

create index if not exists idx_case_attachments_case_id_created_at_asc
  on public.case_attachments (case_id, created_at asc);

-- ============================================================================
-- 3) RPCs (SECURITY DEFINER)
-- ============================================================================

-- 3.1 create_case() - server-enforced rate limit + dedupe
create or replace function public.create_case(
  p_category text,
  p_subject text,
  p_message text,
  p_page_path text,
  p_user_agent text,
  p_app_version text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_recent_count int;
  v_subject text;
  v_norm text;
  v_fingerprint text;
  v_case_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = 'P0001';
  end if;

  -- Rate limit: max 2 cases per rolling 24 hours per user
  select count(*)::int
  into v_recent_count
  from public.cases c
  where c.created_by = v_user_id
    and c.created_at >= now() - interval '24 hours';

  if v_recent_count >= 2 then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;

  v_subject := coalesce(p_subject, '');

  -- Normalization: lower(trim), collapse whitespace
  v_norm := lower(
    btrim(
      regexp_replace(
        coalesce(p_category, '') || ' ' || v_subject || ' ' || coalesce(p_message, ''),
        '\\s+',
        ' ',
        'g'
      )
    )
  );

  -- SHA-256 hex fingerprint
  v_fingerprint := encode(digest(v_norm, 'sha256'), 'hex');

  -- Dedupe: block identical fingerprint within 10 minutes
  if exists (
    select 1
    from public.cases c
    where c.created_by = v_user_id
      and c.fingerprint = v_fingerprint
      and c.created_at >= now() - interval '10 minutes'
  ) then
    raise exception 'duplicate_case' using errcode = 'P0001';
  end if;

  insert into public.cases (
    created_by,
    category,
    subject,
    message,
    status,
    resolved_at,
    page_path,
    user_agent,
    app_version,
    fingerprint
  )
  values (
    v_user_id,
    p_category,
    nullif(btrim(p_subject), ''),
    p_message,
    'new',
    null,
    nullif(btrim(p_page_path), ''),
    nullif(btrim(p_user_agent), ''),
    nullif(btrim(p_app_version), ''),
    v_fingerprint
  )
  returning id into v_case_id;

  return v_case_id;
end;
$$;

-- 3.2 admin_add_case_message() - admin-only note/reply (+ optional status change + notification)
create or replace function public.admin_add_case_message(
  p_case_id uuid,
  p_message text,
  p_is_internal boolean,
  p_new_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_case_owner uuid;
  v_status text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select c.created_by
  into v_case_owner
  from public.cases c
  where c.id = p_case_id;

  if v_case_owner is null then
    raise exception 'case not found';
  end if;

  insert into public.case_messages (
    case_id,
    created_by,
    message,
    is_internal
  ) values (
    p_case_id,
    v_user_id,
    p_message,
    coalesce(p_is_internal, false)
  );

  if p_new_status is not null and btrim(p_new_status) <> '' then
    v_status := btrim(p_new_status);

    update public.cases
    set status = v_status,
        resolved_at = case when v_status = 'resolved' then coalesce(resolved_at, now()) else null end
    where id = p_case_id;
  end if;

  if coalesce(p_is_internal, false) = false then
    insert into public.notifications (user_id, type, announcement_id, link_path, meta)
    values (
      v_case_owner,
      'case_reply',
      null,
      '/support/cases/' || p_case_id::text,
      jsonb_build_object('case_id', p_case_id)
    );
  end if;
end;
$$;

-- ============================================================================
-- 4) Row Level Security (RLS)
-- ============================================================================

alter table public.cases enable row level security;
alter table public.case_messages enable row level security;
alter table public.case_attachments enable row level security;

-- cases
drop policy if exists cases_user_select_own on public.cases;
create policy cases_user_select_own
on public.cases
for select
to authenticated
using (created_by = auth.uid());

drop policy if exists cases_admin_select_all on public.cases;
create policy cases_admin_select_all
on public.cases
for select
to authenticated
using (public.is_admin());

drop policy if exists cases_admin_update on public.cases;
create policy cases_admin_update
on public.cases
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- case_messages
drop policy if exists case_messages_user_select_public_for_own_cases on public.case_messages;
create policy case_messages_user_select_public_for_own_cases
on public.case_messages
for select
to authenticated
using (
  is_internal = false
  and exists (
    select 1
    from public.cases c
    where c.id = case_id
      and c.created_by = auth.uid()
  )
);

drop policy if exists case_messages_admin_select_all on public.case_messages;
create policy case_messages_admin_select_all
on public.case_messages
for select
to authenticated
using (public.is_admin());

drop policy if exists case_messages_admin_insert on public.case_messages;
create policy case_messages_admin_insert
on public.case_messages
for insert
to authenticated
with check (public.is_admin());

-- case_attachments
drop policy if exists case_attachments_user_select_own on public.case_attachments;
create policy case_attachments_user_select_own
on public.case_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.cases c
    where c.id = case_id
      and c.created_by = auth.uid()
  )
);

drop policy if exists case_attachments_admin_select_all on public.case_attachments;
create policy case_attachments_admin_select_all
on public.case_attachments
for select
to authenticated
using (public.is_admin());

drop policy if exists case_attachments_user_insert_own on public.case_attachments;
create policy case_attachments_user_insert_own
on public.case_attachments
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.cases c
    where c.id = case_id
      and c.created_by = auth.uid()
  )
);

-- ============================================================================
-- 5) Storage bucket + policies (private bucket)
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('case-attachments', 'case-attachments', false)
on conflict (id) do nothing;

-- Users can upload only to their own folder in this bucket: {auth.uid()}/{caseId}/{uuid}.jpg
drop policy if exists "case_attachments_upload_own" on storage.objects;
create policy "case_attachments_upload_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'case-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "case_attachments_update_own" on storage.objects;
create policy "case_attachments_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'case-attachments'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Private read: owner folder OR admin
drop policy if exists "case_attachments_read_owner_or_admin" on storage.objects;
create policy "case_attachments_read_owner_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'case-attachments'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

