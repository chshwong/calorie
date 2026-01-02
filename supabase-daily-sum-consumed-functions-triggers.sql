-- ============================================================================
-- daily_sum_consumed maintenance (functions + triggers)
--
-- Maintains public.daily_sum_consumed from public.calorie_entries via triggers.
-- - INSERT/UPDATE/DELETE on calorie_entries => recompute totals for affected day(s)
-- - UPDATE trigger is conditional to avoid noisy recomputes
--
-- Security model:
-- - Internal recompute function is SECURITY DEFINER and NOT executable by authenticated.
-- - Client-callable RPCs use auth.uid() (no user_id parameter) and are explicitly granted.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Internal recompute helper (trigger-only; do not expose)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_daily_sum_consumed_for_date(
  p_user_id uuid,
  p_entry_date date,
  p_touch boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calories_sum numeric;
  v_protein_sum numeric;
  v_carbs_sum numeric;
  v_fat_sum numeric;
  v_fibre_sum numeric;
  v_sugar_sum numeric;
  v_sat_fat_sum numeric;
  v_trans_fat_sum numeric;
  v_sodium_sum numeric;
  v_last_entry_activity_at timestamptz;
BEGIN
  -- Aggregate per-entry nutrients (NULL => 0)
  SELECT
    COALESCE(SUM(COALESCE(calories_kcal, 0)), 0),
    COALESCE(SUM(COALESCE(protein_g, 0)), 0),
    COALESCE(SUM(COALESCE(carbs_g, 0)), 0),
    COALESCE(SUM(COALESCE(fat_g, 0)), 0),
    COALESCE(SUM(COALESCE(fiber_g, 0)), 0),
    COALESCE(SUM(COALESCE(sugar_g, 0)), 0),
    COALESCE(SUM(COALESCE(saturated_fat_g, 0)), 0),
    COALESCE(SUM(COALESCE(trans_fat_g, 0)), 0),
    COALESCE(SUM(COALESCE(sodium_mg, 0)), 0),
    MAX(COALESCE(updated_at, created_at))
  INTO
    v_calories_sum,
    v_protein_sum,
    v_carbs_sum,
    v_fat_sum,
    v_fibre_sum,
    v_sugar_sum,
    v_sat_fat_sum,
    v_trans_fat_sum,
    v_sodium_sum,
    v_last_entry_activity_at
  FROM public.calorie_entries
  WHERE user_id = p_user_id
    AND entry_date = p_entry_date;

  INSERT INTO public.daily_sum_consumed (
    user_id,
    entry_date,
    calories,
    protein_g,
    carbs_g,
    fat_g,
    fibre_g,
    sugar_g,
    saturated_fat_g,
    trans_fat_g,
    sodium_mg,
    last_recomputed_at,
    touched_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_entry_date,
    ROUND(v_calories_sum)::int,
    v_protein_sum,
    v_carbs_sum,
    v_fat_sum,
    v_fibre_sum,
    v_sugar_sum,
    v_sat_fat_sum,
    v_trans_fat_sum,
    ROUND(v_sodium_sum)::int,
    now(),
    CASE
      WHEN p_touch THEN now()
      ELSE COALESCE(v_last_entry_activity_at, now())
    END,
    now()
  )
  ON CONFLICT (user_id, entry_date)
  DO UPDATE SET
    calories = EXCLUDED.calories,
    protein_g = EXCLUDED.protein_g,
    carbs_g = EXCLUDED.carbs_g,
    fat_g = EXCLUDED.fat_g,
    fibre_g = EXCLUDED.fibre_g,
    sugar_g = EXCLUDED.sugar_g,
    saturated_fat_g = EXCLUDED.saturated_fat_g,
    trans_fat_g = EXCLUDED.trans_fat_g,
    sodium_mg = EXCLUDED.sodium_mg,
    last_recomputed_at = EXCLUDED.last_recomputed_at,
    updated_at = EXCLUDED.updated_at,
    touched_at = CASE
      WHEN p_touch THEN now()
      ELSE public.daily_sum_consumed.touched_at
    END;
END;
$$;

-- Do not expose internal function
REVOKE ALL ON FUNCTION public.recompute_daily_sum_consumed_for_date(uuid, date, boolean) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- Client-callable RPC: set day status (explicit intent; no totals recompute)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_daily_consumed_status(
  p_entry_date date,
  p_status public.daily_log_status
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_now timestamptz := now();
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.daily_sum_consumed (
    user_id,
    entry_date,
    log_status,
    status_updated_at,
    completed_at,
    touched_at,
    updated_at
  )
  VALUES (
    v_user_id,
    p_entry_date,
    p_status,
    v_now,
    CASE WHEN p_status = 'completed' THEN v_now ELSE NULL END,
    v_now,
    v_now
  )
  ON CONFLICT (user_id, entry_date)
  DO UPDATE SET
    log_status = EXCLUDED.log_status,
    status_updated_at = EXCLUDED.status_updated_at,
    completed_at = EXCLUDED.completed_at,
    touched_at = EXCLUDED.touched_at,
    updated_at = EXCLUDED.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.set_daily_consumed_status(date, public.daily_log_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_daily_consumed_status(date, public.daily_log_status) TO authenticated;

-- ----------------------------------------------------------------------------
-- Client-callable RPC: recompute a single day (debug/repair; does NOT touch touched_at)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_daily_sum_consumed(
  p_entry_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.recompute_daily_sum_consumed_for_date(v_user_id, p_entry_date, false);
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_daily_sum_consumed(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_daily_sum_consumed(date) TO authenticated;

-- ----------------------------------------------------------------------------
-- Client-callable RPC: recompute a range (set-based; does NOT create missed days)
-- - Does NOT update touched_at for existing rows
-- - Only inserts rows for dates that are touched via entries or already have a row
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_daily_sum_consumed_range(
  p_start date,
  p_end date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_days integer;
  v_now timestamptz := now();
  v_rows integer := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_start IS NULL OR p_end IS NULL THEN
    RAISE EXCEPTION 'Start and end dates are required';
  END IF;
  IF p_start > p_end THEN
    RAISE EXCEPTION 'Start date must be <= end date';
  END IF;

  v_days := (p_end - p_start) + 1;
  IF v_days > 366 THEN
    RAISE EXCEPTION 'Range too large (max 366 days)';
  END IF;

  WITH date_series AS (
    SELECT gs::date AS entry_date
    FROM generate_series(p_start::timestamptz, p_end::timestamptz, interval '1 day') gs
  ),
  touched_dates AS (
    SELECT DISTINCT ce.entry_date
    FROM public.calorie_entries ce
    WHERE ce.user_id = v_user_id
      AND ce.entry_date >= p_start
      AND ce.entry_date <= p_end
    UNION
    SELECT dsc.entry_date
    FROM public.daily_sum_consumed dsc
    WHERE dsc.user_id = v_user_id
      AND dsc.entry_date >= p_start
      AND dsc.entry_date <= p_end
  ),
  target_dates AS (
    SELECT ds.entry_date
    FROM date_series ds
    JOIN touched_dates td ON td.entry_date = ds.entry_date
  ),
  agg AS (
    SELECT
      v_user_id AS user_id,
      td.entry_date,
      COALESCE(SUM(COALESCE(ce.calories_kcal, 0)), 0) AS calories_sum,
      COALESCE(SUM(COALESCE(ce.protein_g, 0)), 0) AS protein_sum,
      COALESCE(SUM(COALESCE(ce.carbs_g, 0)), 0) AS carbs_sum,
      COALESCE(SUM(COALESCE(ce.fat_g, 0)), 0) AS fat_sum,
      COALESCE(SUM(COALESCE(ce.fiber_g, 0)), 0) AS fibre_sum,
      COALESCE(SUM(COALESCE(ce.sugar_g, 0)), 0) AS sugar_sum,
      COALESCE(SUM(COALESCE(ce.saturated_fat_g, 0)), 0) AS sat_fat_sum,
      COALESCE(SUM(COALESCE(ce.trans_fat_g, 0)), 0) AS trans_fat_sum,
      COALESCE(SUM(COALESCE(ce.sodium_mg, 0)), 0) AS sodium_sum,
      MAX(COALESCE(ce.updated_at, ce.created_at)) AS last_entry_activity_at
    FROM target_dates td
    LEFT JOIN public.calorie_entries ce
      ON ce.user_id = v_user_id
     AND ce.entry_date = td.entry_date
    GROUP BY td.entry_date
  ),
  upserted AS (
    INSERT INTO public.daily_sum_consumed (
      user_id,
      entry_date,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      fibre_g,
      sugar_g,
      saturated_fat_g,
      trans_fat_g,
      sodium_mg,
      last_recomputed_at,
      touched_at,
      updated_at
    )
    SELECT
      a.user_id,
      a.entry_date,
      ROUND(a.calories_sum)::int,
      a.protein_sum,
      a.carbs_sum,
      a.fat_sum,
      a.fibre_sum,
      a.sugar_sum,
      a.sat_fat_sum,
      a.trans_fat_sum,
      ROUND(a.sodium_sum)::int,
      v_now,
      COALESCE(a.last_entry_activity_at, v_now),
      v_now
    FROM agg a
    ON CONFLICT (user_id, entry_date)
    DO UPDATE SET
      calories = EXCLUDED.calories,
      protein_g = EXCLUDED.protein_g,
      carbs_g = EXCLUDED.carbs_g,
      fat_g = EXCLUDED.fat_g,
      fibre_g = EXCLUDED.fibre_g,
      sugar_g = EXCLUDED.sugar_g,
      saturated_fat_g = EXCLUDED.saturated_fat_g,
      trans_fat_g = EXCLUDED.trans_fat_g,
      sodium_mg = EXCLUDED.sodium_mg,
      last_recomputed_at = EXCLUDED.last_recomputed_at,
      updated_at = EXCLUDED.updated_at
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_rows FROM upserted;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_daily_sum_consumed_range(date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_daily_sum_consumed_range(date, date) TO authenticated;

-- ----------------------------------------------------------------------------
-- Trigger function on calorie_entries (SECURITY DEFINER so it can call internal recompute)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_calorie_entries_recompute_daily_sum_consumed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_daily_sum_consumed_for_date(NEW.user_id, NEW.entry_date, true);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_daily_sum_consumed_for_date(OLD.user_id, OLD.entry_date, true);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Recompute for new tuple
    PERFORM public.recompute_daily_sum_consumed_for_date(NEW.user_id, NEW.entry_date, true);

    -- If entry_date/user_id changed, also recompute the old tuple
    IF (OLD.user_id IS DISTINCT FROM NEW.user_id) OR (OLD.entry_date IS DISTINCT FROM NEW.entry_date) THEN
      PERFORM public.recompute_daily_sum_consumed_for_date(OLD.user_id, OLD.entry_date, true);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

-- Trigger functions are not meant to be invoked directly
REVOKE ALL ON FUNCTION public.trg_calorie_entries_recompute_daily_sum_consumed() FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- Triggers on public.calorie_entries
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS calorie_entries_recompute_daily_sum_consumed_insert ON public.calorie_entries;
CREATE TRIGGER calorie_entries_recompute_daily_sum_consumed_insert
  AFTER INSERT ON public.calorie_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_calorie_entries_recompute_daily_sum_consumed();

DROP TRIGGER IF EXISTS calorie_entries_recompute_daily_sum_consumed_delete ON public.calorie_entries;
CREATE TRIGGER calorie_entries_recompute_daily_sum_consumed_delete
  AFTER DELETE ON public.calorie_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_calorie_entries_recompute_daily_sum_consumed();

DROP TRIGGER IF EXISTS calorie_entries_recompute_daily_sum_consumed_update ON public.calorie_entries;
CREATE TRIGGER calorie_entries_recompute_daily_sum_consumed_update
  AFTER UPDATE ON public.calorie_entries
  FOR EACH ROW
  WHEN (
    OLD.user_id IS DISTINCT FROM NEW.user_id OR
    OLD.entry_date IS DISTINCT FROM NEW.entry_date OR
    OLD.calories_kcal IS DISTINCT FROM NEW.calories_kcal OR
    OLD.protein_g IS DISTINCT FROM NEW.protein_g OR
    OLD.carbs_g IS DISTINCT FROM NEW.carbs_g OR
    OLD.fat_g IS DISTINCT FROM NEW.fat_g OR
    OLD.fiber_g IS DISTINCT FROM NEW.fiber_g OR
    OLD.sugar_g IS DISTINCT FROM NEW.sugar_g OR
    OLD.saturated_fat_g IS DISTINCT FROM NEW.saturated_fat_g OR
    OLD.trans_fat_g IS DISTINCT FROM NEW.trans_fat_g OR
    OLD.sodium_mg IS DISTINCT FROM NEW.sodium_mg
  )
  EXECUTE FUNCTION public.trg_calorie_entries_recompute_daily_sum_consumed();


