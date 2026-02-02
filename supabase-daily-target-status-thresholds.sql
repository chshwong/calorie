-- Daily Target Status: Focus State Thresholds
-- 
-- Computes win/almost/halfway/started/none states for protein, fibre, water.
-- Used by daily_target_status table (via triggers) and displayed in Friends cards.
--
-- Thresholds:
--   win     = actual >= 100% of target
--   almost  = actual >= 85% of target
--   halfway = actual >= 50% of target
--   started = actual > 0% of target
--   none    = actual = 0% or no target set
--
-- Run this in Supabase SQL Editor. Idempotent.
-- ============================================================================

-- 0) Extend focus_state enum with new values (required for ALL daily_target_status state columns)
-- ============================================================================
-- The table daily_target_status has THREE columns that use the SAME enum type focus_state:
--   - protein_state
--   - fibre_state
--   - water_state
-- Adding 'started' and 'halfway' to the enum once fixes all three columns.
-- Run these once; if values already exist, you'll get "already exists" (safe to ignore on re-run).

ALTER TYPE public.focus_state ADD VALUE IF NOT EXISTS 'started';
ALTER TYPE public.focus_state ADD VALUE IF NOT EXISTS 'halfway';

-- 1) Core threshold function
-- ============================================================================

DROP FUNCTION IF EXISTS public.compute_focus_state(numeric, numeric);
CREATE OR REPLACE FUNCTION public.compute_focus_state(actual numeric, target numeric)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
begin
  if target is null or target <= 0 then
    return 'none';
  end if;

  if actual is null then
    actual := 0;
  end if;

  if actual >= target then
    return 'win';           -- 100%+
  end if;

  if actual >= (target * 0.85) then
    return 'almost';        -- 85%+
  end if;

  if actual >= (target * 0.50) then
    return 'halfway';       -- 50%+
  end if;

  if actual > 0 then
    return 'started';       -- >0%
  end if;

  return 'none';            -- 0%
end;
$$;

-- 2) Recompute daily_target_status for a user/date
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recompute_daily_target_status(p_user_id uuid, p_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_protein numeric := 0;
  v_fibre numeric := 0;
  v_water_ml numeric := 0;

  v_protein_target numeric := null;
  v_fibre_target numeric := null;
  v_water_target_ml numeric := null;

  v_food_logged boolean := false;
  v_water_logged boolean := false;
begin
  -- Targets from profiles
  select
    protein_g_min::numeric,
    fiber_g_min::numeric,
    water_goal_ml::numeric
  into
    v_protein_target,
    v_fibre_target,
    v_water_target_ml
  from public.profiles
  where user_id = p_user_id;

  -- Food daily totals (single row)
  select
    coalesce(protein_g, 0)::numeric,
    coalesce(fibre_g, 0)::numeric,
    (log_status <> 'unknown')
  into
    v_protein,
    v_fibre,
    v_food_logged
  from public.daily_sum_consumed
  where user_id = p_user_id
    and entry_date = p_date;

  if not found then
    v_protein := 0;
    v_fibre := 0;
    v_food_logged := false;
  end if;

  -- Water daily totals (single row)
  select
    coalesce(total, 0)::numeric,
    (coalesce(total, 0) > 0)
  into
    v_water_ml,
    v_water_logged
  from public.water_daily
  where user_id = p_user_id
    and date = p_date;

  if not found then
    v_water_ml := 0;
    v_water_logged := false;
  end if;

  insert into public.daily_target_status (
    user_id,
    entry_date,
    logged_today,
    protein_state,
    fibre_state,
    water_state,
    updated_at
  )
  values (
    p_user_id,
    p_date,
    (v_food_logged or v_water_logged),
    public.compute_focus_state(v_protein, v_protein_target)::public.focus_state,
    public.compute_focus_state(v_fibre, v_fibre_target)::public.focus_state,
    public.compute_focus_state(v_water_ml, v_water_target_ml)::public.focus_state,
    now()
  )
  on conflict (user_id, entry_date) do update set
    logged_today   = excluded.logged_today,
    protein_state  = excluded.protein_state,
    fibre_state    = excluded.fibre_state,
    water_state    = excluded.water_state,
    updated_at     = now();
end;
$$;

-- 3) Trigger functions (called by daily_sum_consumed and water_daily triggers)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trg_recompute_daily_target_status_from_consumed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  perform public.recompute_daily_target_status(new.user_id, new.entry_date);
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.trg_recompute_daily_target_status_from_water()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  perform public.recompute_daily_target_status(new.user_id, new.date);
  return new;
end;
$$;

-- 4) Triggers (attach to daily_sum_consumed and water_daily)
-- ============================================================================

DROP TRIGGER IF EXISTS daily_sum_consumed_recompute_daily_target_status ON public.daily_sum_consumed;
CREATE TRIGGER daily_sum_consumed_recompute_daily_target_status
  AFTER INSERT OR UPDATE ON public.daily_sum_consumed
  FOR EACH ROW
  EXECUTE FUNCTION trg_recompute_daily_target_status_from_consumed();

DROP TRIGGER IF EXISTS water_daily_recompute_daily_target_status ON public.water_daily;
CREATE TRIGGER water_daily_recompute_daily_target_status
  AFTER INSERT OR UPDATE ON public.water_daily
  FOR EACH ROW
  EXECUTE FUNCTION trg_recompute_daily_target_status_from_water();
