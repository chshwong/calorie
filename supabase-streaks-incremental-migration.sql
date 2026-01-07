-- ============================================================================
-- Food Streak Incremental Migration
--
-- Replaces expensive history-scanning food streak computation with an
-- incremental, O(1) model using a "break floor date" concept.
--
-- Key changes:
-- - Streak counts up to TODAY (no 3-day lag in display)
-- - Breaks only confirmed after 3-day grace period
-- - Once confirmed (floor advanced), backdating cannot recover before floor
-- - Performance: only checks 4 dates max (today, today-1, today-2, today-3)
-- ============================================================================

-- ============================================================================
-- PART A: Schema Changes
-- ============================================================================

-- Add new columns to streak_state
ALTER TABLE public.streak_state
  ADD COLUMN IF NOT EXISTS food_break_floor_date date NOT NULL DEFAULT '1970-01-01',
  ADD COLUMN IF NOT EXISTS food_pending_missing_days int NOT NULL DEFAULT 0;

-- ============================================================================
-- PART B: New Incremental Update Function
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: update_food_streak_on_touch
-- Fast incremental update (O(1)) called when a day becomes "touched"
-- Only checks today, today-1, today-2, today-3 (never scans history)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_food_streak_on_touch(
  p_user_id uuid,
  p_touch_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := current_date;
  v_floor date;
  v_grace_boundary date := v_today - 3;
  v_has_today boolean;
  v_has_today_minus_1 boolean;
  v_has_today_minus_2 boolean;
  v_has_today_minus_3 boolean;
  v_pending_missing int := 0;
  v_current_start date;
  v_current_end date;
  v_current_days int;
  v_pr_days int;
  v_pr_end_date date;
  v_earliest_in_grace date;
BEGIN
  -- Ensure streak_state row exists
  PERFORM public.ensure_streak_state_row(p_user_id);
  
  -- Get current floor
  SELECT food_break_floor_date, food_current_start_date, food_current_end_date, food_current_days, food_pr_days, food_pr_end_date
  INTO v_floor, v_current_start, v_current_end, v_current_days, v_pr_days, v_pr_end_date
  FROM public.streak_state
  WHERE user_id = p_user_id;
  
  -- Check existence for only 4 dates: today, today-1, today-2, today-3
  -- (O(1) performance - no scans)
  SELECT 
    EXISTS(SELECT 1 FROM public.daily_sum_consumed WHERE user_id = p_user_id AND entry_date = v_today),
    EXISTS(SELECT 1 FROM public.daily_sum_consumed WHERE user_id = p_user_id AND entry_date = v_today - 1),
    EXISTS(SELECT 1 FROM public.daily_sum_consumed WHERE user_id = p_user_id AND entry_date = v_today - 2),
    EXISTS(SELECT 1 FROM public.daily_sum_consumed WHERE user_id = p_user_id AND entry_date = v_grace_boundary)
  INTO v_has_today, v_has_today_minus_1, v_has_today_minus_2, v_has_today_minus_3;
  
  -- Confirm break only if grace boundary (today-3) is older than floor AND missing
  -- This is the ONLY place floor advances forward (never backward)
  IF v_grace_boundary > v_floor AND NOT v_has_today_minus_3 THEN
    -- Confirm break: advance floor to grace boundary
    v_floor := v_grace_boundary;
    
    -- If current streak start is at or before new floor, reset it
    IF v_current_start IS NULL OR v_current_start <= v_floor THEN
      v_current_start := NULL;
      v_current_end := NULL;
      v_current_days := 0;
    END IF;
  END IF;
  
  -- Compute pending missing days within grace window (only dates > floor)
  -- Check: today, today-1, today-2 (but only if > floor)
  v_pending_missing := 0;
  IF v_today > v_floor AND NOT v_has_today THEN
    v_pending_missing := v_pending_missing + 1;
  END IF;
  IF (v_today - 1) > v_floor AND NOT v_has_today_minus_1 THEN
    v_pending_missing := v_pending_missing + 1;
  END IF;
  IF (v_today - 2) > v_floor AND NOT v_has_today_minus_2 THEN
    v_pending_missing := v_pending_missing + 1;
  END IF;
  
  -- Determine current streak state
  -- If there's at least one day in grace window with data, maintain/advance streak
  IF v_has_today OR v_has_today_minus_1 OR v_has_today_minus_2 THEN
    -- Streak is active (at least one day in grace window has data)
    
    -- Find earliest existing day in grace window (but only if > floor)
    v_earliest_in_grace := NULL;
    IF v_has_today_minus_2 AND (v_today - 2) > v_floor THEN
      v_earliest_in_grace := v_today - 2;
    END IF;
    IF v_has_today_minus_1 AND (v_today - 1) > v_floor THEN
      IF v_earliest_in_grace IS NULL OR (v_today - 1) < v_earliest_in_grace THEN
        v_earliest_in_grace := v_today - 1;
      END IF;
    END IF;
    IF v_has_today AND v_today > v_floor THEN
      IF v_earliest_in_grace IS NULL OR v_today < v_earliest_in_grace THEN
        v_earliest_in_grace := v_today;
      END IF;
    END IF;
    
    -- Update streak start/end
    -- If we have a current start and it's still valid (> floor), keep it
    -- This maintains long streaks across multiple calls
    -- Only reset if floor advanced past it (handled above) or if it's null
    IF v_current_start IS NULL OR v_current_start <= v_floor THEN
      -- Need to set a new start date
      -- Use earliest day in grace window, or today if p_touch_date is today
      IF v_earliest_in_grace IS NOT NULL THEN
        v_current_start := v_earliest_in_grace;
      ELSIF p_touch_date = v_today AND v_has_today THEN
        v_current_start := v_today;
      ELSE
        -- No valid start found in grace window
        v_current_start := NULL;
      END IF;
    END IF;
    -- If v_current_start is still valid (> floor), we keep it as-is
    
    -- End date is always today when streak is active
    v_current_end := v_today;
    
    -- Calculate days: from start to today (inclusive)
    IF v_current_start IS NOT NULL AND v_current_start > v_floor THEN
      v_current_days := (v_current_end - v_current_start) + 1;
    ELSE
      v_current_days := 0;
      v_current_start := NULL;
      v_current_end := NULL;
    END IF;
  ELSE
    -- No days in grace window have data
    -- Check if we should reset or keep on hold
    IF v_pending_missing = 0 THEN
      -- All grace days checked and all missing - streak broken
      v_current_start := NULL;
      v_current_end := NULL;
      v_current_days := 0;
    ELSE
      -- Still in grace (pending > 0) - keep existing streak state (on hold)
      -- Don't change current_start/current_end/current_days
      -- They remain as-is until grace period expires
    END IF;
  END IF;
  
  -- Update PR only when not on hold (pending_missing_days = 0)
  IF v_pending_missing = 0 AND v_current_days > COALESCE(v_pr_days, 0) THEN
    v_pr_days := v_current_days;
    v_pr_end_date := v_current_end;
  END IF;
  
  -- Update streak_state
  UPDATE public.streak_state
  SET
    food_break_floor_date = v_floor,
    food_pending_missing_days = v_pending_missing,
    food_current_start_date = v_current_start,
    food_current_end_date = v_current_end,
    food_current_days = v_current_days,
    food_pr_days = v_pr_days,
    food_pr_end_date = v_pr_end_date,
    last_recomputed_at = now(),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Do not expose internal function
REVOKE ALL ON FUNCTION public.update_food_streak_on_touch(uuid, date) FROM PUBLIC;

-- ============================================================================
-- PART C: Update recompute_food_streak to be a wrapper
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: recompute_food_streak (updated)
-- Now a simple wrapper that calls the incremental update function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_food_streak(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call incremental update with current date
  PERFORM public.update_food_streak_on_touch(p_user_id, current_date);
END;
$$;

-- Do not expose internal function
REVOKE ALL ON FUNCTION public.recompute_food_streak(uuid) FROM PUBLIC;

-- ============================================================================
-- PART D: Update Triggers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trigger function: Call incremental update on daily_sum_consumed INSERT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_daily_sum_consumed_update_food_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call incremental update with the touched date
  PERFORM public.update_food_streak_on_touch(NEW.user_id, NEW.entry_date);
  RETURN NEW;
END;
$$;

-- Do not expose trigger function
REVOKE ALL ON FUNCTION public.trg_daily_sum_consumed_update_food_streak() FROM PUBLIC;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS daily_sum_consumed_recompute_food_streak_insert ON public.daily_sum_consumed;
CREATE TRIGGER daily_sum_consumed_update_food_streak_insert
  AFTER INSERT ON public.daily_sum_consumed
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_daily_sum_consumed_update_food_streak();

-- Optional: Also trigger on UPDATE if entry_date or user_id changes
-- (Only if your system allows these columns to change)
-- Uncomment if needed:
/*
CREATE OR REPLACE FUNCTION public.trg_daily_sum_consumed_update_food_streak_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recompute for new tuple
  PERFORM public.update_food_streak_on_touch(NEW.user_id, NEW.entry_date);
  
  -- If entry_date or user_id changed, also recompute for old tuple
  IF (OLD.user_id IS DISTINCT FROM NEW.user_id) OR (OLD.entry_date IS DISTINCT FROM NEW.entry_date) THEN
    PERFORM public.update_food_streak_on_touch(OLD.user_id, OLD.entry_date);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_sum_consumed_update_food_streak_update ON public.daily_sum_consumed;
CREATE TRIGGER daily_sum_consumed_update_food_streak_update
  AFTER UPDATE OF entry_date, user_id ON public.daily_sum_consumed
  FOR EACH ROW
  WHEN (
    OLD.user_id IS DISTINCT FROM NEW.user_id OR
    OLD.entry_date IS DISTINCT FROM NEW.entry_date
  )
  EXECUTE FUNCTION public.trg_daily_sum_consumed_update_food_streak_on_update();
*/

-- ============================================================================
-- PART E: Update View
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: public.v_streaks (updated to include new columns)
-- ----------------------------------------------------------------------------
-- Drop and recreate view to allow column structure changes
DROP VIEW IF EXISTS public.v_streaks;

CREATE VIEW public.v_streaks AS
SELECT
  user_id,
  food_pr_days,
  food_pr_end_date,
  food_current_start_date,
  food_current_end_date,
  food_current_days,
  food_break_floor_date,
  food_pending_missing_days,
  login_pr_days,
  login_pr_end_date,
  login_current_start_date,
  login_current_end_date,
  login_current_days,
  last_recomputed_at,
  created_at,
  updated_at
FROM public.streak_state;

-- Grant select on view (RLS from underlying table applies)
GRANT SELECT ON public.v_streaks TO authenticated;

-- ============================================================================
-- PART F: Validation Queries
-- ============================================================================

-- Example validation queries (commented out - uncomment and replace user_id as needed):

/*
-- 1) Show streak_state row for a user
SELECT * FROM public.streak_state WHERE user_id = 'YOUR_USER_ID_HERE';

-- 2) Debug last 10 days existence
WITH date_series AS (
  SELECT generate_series(current_date - 9, current_date, INTERVAL '1 day')::date AS d
)
SELECT 
  ds.d,
  EXISTS(
    SELECT 1 
    FROM public.daily_sum_consumed
    WHERE user_id = 'YOUR_USER_ID_HERE' 
      AND entry_date = ds.d
  ) AS has_day
FROM date_series ds
ORDER BY ds.d;
*/

