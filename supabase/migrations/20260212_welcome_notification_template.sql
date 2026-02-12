-- Welcome notification template + profile insert delivery
-- Additive only; idempotent migration.

-- ============================================================================
-- 1) Templates table
-- ============================================================================

create table if not exists public.notification_templates (
  key text primary key,
  title_i18n jsonb not null,
  body_i18n jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.trg_notification_templates_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_notification_templates_updated_at on public.notification_templates;
create trigger trg_notification_templates_updated_at
before update on public.notification_templates
for each row execute function public.trg_notification_templates_set_updated_at();

-- Seed/Upsert welcome template (editable in DB, no redeploy needed)
insert into public.notification_templates (
  key,
  title_i18n,
  body_i18n,
  is_active
)
values (
  'welcome_v1',
  '{
    "en": "Welcome aboard, AvoViber 🥑",
    "fr": "Bienvenue à bord, AvoViber 🥑"
  }'::jsonb,
  '{
    "en": "Start with one bite — that''s how streaks grow 🌱\n\nSync a ⌚ wearable to level up your burn tracking.\n\nQuestions? We''re in [Settings → Contact Support](/support).",
    "fr": "Commence par une bouchée — c''est comme ça que les streaks poussent 🌱\n\nSynchronise une ⌚ montre connectée pour booster ton suivi des calories brûlées.\n\nDes questions ? On est dans [Paramètres → Contacter le support](/support)."
  }'::jsonb,
  true
)
on conflict (key) do update
set
  title_i18n = excluded.title_i18n,
  body_i18n = excluded.body_i18n,
  is_active = excluded.is_active,
  updated_at = now();

-- ============================================================================
-- 2) Notifications additive columns + idempotency index
-- ============================================================================

alter table public.notifications
  add column if not exists type text,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists template_key text null,
  add column if not exists title_i18n jsonb null,
  add column if not exists body_i18n jsonb null;

alter table public.notifications
  drop constraint if exists notifications_template_key_fkey;

alter table public.notifications
  add constraint notifications_template_key_fkey
  foreign key (template_key)
  references public.notification_templates(key)
  on update cascade
  on delete set null;

create unique index if not exists idx_notifications_user_template_active_unique
  on public.notifications (user_id, template_key)
  where template_key is not null and is_deleted = false;

-- ============================================================================
-- 3) Profile insert trigger -> welcome notification
-- Non-blocking: profile creation must never fail due to inbox/template errors.
-- ============================================================================

create or replace function public.trg_insert_welcome_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_announcement_id constant uuid := '9fd0ee2d-a669-444c-bf16-3a8fdc7bd814';
  v_title_i18n jsonb;
  v_body_i18n jsonb;
begin
  begin
    select nt.title_i18n, nt.body_i18n
    into v_title_i18n, v_body_i18n
    from public.notification_templates nt
    where nt.key = 'welcome_v1'
      and nt.is_active = true
    limit 1;

    if v_title_i18n is not null and v_body_i18n is not null then
      insert into public.announcements (
        id,
        created_by,
        published_at,
        is_published,
        title_i18n,
        body_i18n,
        link_path
      )
      values (
        v_announcement_id,
        new.user_id,
        now(),
        true,
        v_title_i18n,
        v_body_i18n,
        null
      )
      on conflict (id) do nothing;

      insert into public.notifications (
        user_id,
        type,
        announcement_id,
        template_key,
        is_deleted
      )
      values (
        new.user_id,
        'announcement',
        v_announcement_id,
        'welcome_v1',
        false
      )
      on conflict do nothing;
    end if;
  exception when others then
    -- Never block profile creation due to welcome-notification failures.
    null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_profiles_insert_welcome_notification on public.profiles;
create trigger trg_profiles_insert_welcome_notification
after insert on public.profiles
for each row
execute function public.trg_insert_welcome_notification();

-- ============================================================================
-- 3b) One-time backfill: convert prior welcome rows to announcement rows
-- ============================================================================

do $$
declare
  v_announcement_id constant uuid := '9fd0ee2d-a669-444c-bf16-3a8fdc7bd814';
  v_title_i18n jsonb;
  v_body_i18n jsonb;
begin
  select nt.title_i18n, nt.body_i18n
  into v_title_i18n, v_body_i18n
  from public.notification_templates nt
  where nt.key = 'welcome_v1'
    and nt.is_active = true
  limit 1;

  if v_title_i18n is not null and v_body_i18n is not null then
    insert into public.announcements (
      id,
      created_by,
      published_at,
      is_published,
      title_i18n,
      body_i18n,
      link_path
    )
    values (
      v_announcement_id,
      coalesce((select p.user_id from public.profiles p order by p.created_at asc limit 1), '00000000-0000-0000-0000-000000000000'::uuid),
      now(),
      true,
      v_title_i18n,
      v_body_i18n,
      null
    )
    on conflict (id) do nothing;
  end if;

  with ranked as (
    select
      n.id,
      row_number() over (
        partition by n.user_id
        order by n.created_at desc, n.id desc
      ) as rn
    from public.notifications n
    where n.template_key = 'welcome_v1'
      and n.is_deleted = false
  )
  update public.notifications n
  set is_deleted = true,
      read_at = coalesce(n.read_at, now())
  where n.id in (
    select r.id
    from ranked r
    where r.rn > 1
  );

  update public.notifications n
  set
    type = 'announcement',
    announcement_id = v_announcement_id
  where n.template_key = 'welcome_v1'
    and n.is_deleted = false;
end;
$$;

-- ============================================================================
-- 4) RLS for templates (admin-only read; not public to all users)
-- ============================================================================

alter table public.notification_templates enable row level security;

drop policy if exists notification_templates_admin_read on public.notification_templates;
create policy notification_templates_admin_read
on public.notification_templates
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and coalesce(p.is_admin, false) = true
  )
);
