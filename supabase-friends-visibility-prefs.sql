-- Friends Settings: sharing preferences (friend visibility prefs)
-- - Stores what each user allows friends to see
-- - Enforced by rpc_get_friend_cards (see supabase-friends-signals-step3.sql)
--
-- ============================================================================
-- 1) Table: friend_visibility_prefs
-- ============================================================================

create table if not exists public.friend_visibility_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,

  show_protein boolean not null default true,
  show_fibre boolean not null default true,
  show_water boolean not null default true,
  show_steps boolean not null default true,
  show_food_streak boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 2) updated_at trigger
-- ============================================================================

drop trigger if exists update_friend_visibility_prefs_updated_at on public.friend_visibility_prefs;
create trigger update_friend_visibility_prefs_updated_at
  before update on public.friend_visibility_prefs
  for each row
  execute function public.update_updated_at_column();

-- ============================================================================
-- 3) RLS
-- ============================================================================

alter table public.friend_visibility_prefs enable row level security;

drop policy if exists "friend_visibility_prefs_select_own" on public.friend_visibility_prefs;
create policy "friend_visibility_prefs_select_own"
  on public.friend_visibility_prefs
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "friend_visibility_prefs_insert_own" on public.friend_visibility_prefs;
create policy "friend_visibility_prefs_insert_own"
  on public.friend_visibility_prefs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "friend_visibility_prefs_update_own" on public.friend_visibility_prefs;
create policy "friend_visibility_prefs_update_own"
  on public.friend_visibility_prefs
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================================
-- 4) RPCs (Save-only flow)
-- ============================================================================

drop function if exists public.rpc_get_friend_visibility_prefs();
create or replace function public.rpc_get_friend_visibility_prefs()
returns table (
  show_protein boolean,
  show_fibre boolean,
  show_water boolean,
  show_steps boolean,
  show_food_streak boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  -- Ensure a prefs row exists for the viewer (defaults apply).
  insert into public.friend_visibility_prefs (user_id)
  values (auth.uid())
  on conflict (user_id) do nothing;

  return query
  select
    p.show_protein,
    p.show_fibre,
    p.show_water,
    p.show_steps,
    p.show_food_streak,
    p.created_at,
    p.updated_at
  from public.friend_visibility_prefs p
  where p.user_id = auth.uid();
end;
$$;

revoke all on function public.rpc_get_friend_visibility_prefs() from public;
grant execute on function public.rpc_get_friend_visibility_prefs() to authenticated;

drop function if exists public.rpc_upsert_friend_visibility_prefs(boolean, boolean, boolean, boolean, boolean);
create or replace function public.rpc_upsert_friend_visibility_prefs(
  p_show_protein boolean,
  p_show_fibre boolean,
  p_show_water boolean,
  p_show_steps boolean,
  p_show_food_streak boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.friend_visibility_prefs (
    user_id,
    show_protein,
    show_fibre,
    show_water,
    show_steps,
    show_food_streak
  )
  values (
    auth.uid(),
    p_show_protein,
    p_show_fibre,
    p_show_water,
    p_show_steps,
    p_show_food_streak
  )
  on conflict (user_id) do update
    set
      show_protein = excluded.show_protein,
      show_fibre = excluded.show_fibre,
      show_water = excluded.show_water,
      show_steps = excluded.show_steps,
      show_food_streak = excluded.show_food_streak;
end;
$$;

revoke all on function public.rpc_upsert_friend_visibility_prefs(boolean, boolean, boolean, boolean, boolean) from public;
grant execute on function public.rpc_upsert_friend_visibility_prefs(boolean, boolean, boolean, boolean, boolean) to authenticated;

