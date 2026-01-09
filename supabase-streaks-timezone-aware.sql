-- ============================================================================
-- Timezone-Aware Streak Calculations Migration
--
-- Makes streak calculations use user's local timezone instead of server UTC.
-- This ensures "today" means the user's local day, not UTC day.
--
-- Changes:
-- 1. Add timezone column to profiles table
-- 2. Create helper function to get user's local "today"
-- 3. Update all streak functions to use user's local date
-- ============================================================================

-- ============================================================================
-- PART A: Add timezone column to profiles
-- ============================================================================

-- Add timezone column if it doesn't exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Toronto';

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.timezone IS 'IANA timezone identifier (e.g., America/Toronto, Europe/London). Used for streak calculations to determine user''s local "today".';

-- ============================================================================
-- PART B: Create timezone helper function
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: get_user_local_today
-- Returns the user's local "today" date based on their timezone setting
-- Falls back to UTC if timezone is null or invalid
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_local_today(p_user_id uuid)
RETURNS date
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone text;
  v_local_date date;
BEGIN
  -- Get user's timezone from profiles
  SELECT timezone INTO v_timezone
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  -- Fallback to UTC if timezone is null or empty
  IF v_timezone IS NULL OR v_timezone = '' THEN
    v_timezone := 'UTC';
  END IF;
  
  -- Convert current timestamp to user's timezone and extract date
  -- This gives us the user's local "today"
  BEGIN
    v_local_date := (now() AT TIME ZONE 'UTC' AT TIME ZONE v_timezone)::date;
  EXCEPTION WHEN OTHERS THEN
    -- If timezone is invalid, fallback to UTC
    v_local_date := (now() AT TIME ZONE 'UTC')::date;
  END;
  
  RETURN v_local_date;
END;
$$;

-- Do not expose internal function (but allow SECURITY DEFINER functions to use it)
REVOKE ALL ON FUNCTION public.get_user_local_today(uuid) FROM PUBLIC;

-- ============================================================================
-- PART C: Update touch_daily_login RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.touch_daily_login()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_today date;
  v_now timestamptz := now();
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get user's local "today" instead of server UTC date
  v_today := public.get_user_local_today(v_user_id);
  
  -- Upsert daily_login
  INSERT INTO public.daily_login (
    user_id,
    entry_date,
    first_login_at,
    last_login_at,
    created_at,
    updated_at
  )
  VALUES (
    v_user_id,
    v_today,
    v_now,
    v_now,
    v_now,
    v_now
  )
  ON CONFLICT ON CONSTRAINT daily_login_user_date_unique
  DO UPDATE SET
    last_login_at = v_now,
    updated_at = v_now;
  
  -- Recompute login streak
  PERFORM public.recompute_login_streak(v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.touch_daily_login() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_daily_login() TO authenticated;

-- ============================================================================
-- PART D: Update recompute_login_streak
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recompute_login_streak(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_date date;
  v_check_date date;
  v_streak_days int := 0;
  v_streak_start date;
  v_streak_end date;
  v_has_login boolean;
  v_pr_days int;
  v_pr_end_date date;
  v_iterations int := 0;
  v_max_iterations int := 400; -- Hard cap to prevent infinite loops
BEGIN
  -- Ensure streak_state row exists
  PERFORM public.ensure_streak_state_row(p_user_id);
  
  -- Get user's local "today" instead of server UTC date
  v_current_date := public.get_user_local_today(p_user_id);
  
  -- Start from user's local today and walk backward
  v_check_date := v_current_date;
  v_streak_end := v_current_date;
  v_streak_start := NULL;
  
  -- Walk backward while consecutive days have login
  WHILE v_iterations < v_max_iterations LOOP
    -- Check if login exists for this date
    SELECT EXISTS(
      SELECT 1
      FROM public.daily_login
      WHERE user_id = p_user_id
        AND entry_date = v_check_date
    ) INTO v_has_login;
    
    IF v_has_login THEN
      -- This day counts, extend streak
      v_streak_days := v_streak_days + 1;
      v_streak_start := v_check_date;
      v_check_date := v_check_date - INTERVAL '1 day';
      v_iterations := v_iterations + 1;
    ELSE
      -- Streak broken, exit loop
      EXIT;
    END IF;
  END LOOP;
  
  -- If we found a streak, set end date
  IF v_streak_days > 0 THEN
    v_streak_end := v_current_date;
  ELSE
    v_streak_start := NULL;
    v_streak_end := NULL;
  END IF;
  
  -- Get current PR values
  SELECT login_pr_days, login_pr_end_date
  INTO v_pr_days, v_pr_end_date
  FROM public.streak_state
  WHERE user_id = p_user_id;
  
  -- Update streak_state
  UPDATE public.streak_state
  SET
    login_current_days = v_streak_days,
    login_current_start_date = v_streak_start,
    login_current_end_date = v_streak_end,
    login_pr_days = CASE
      WHEN v_streak_days > COALESCE(v_pr_days, 0) THEN v_streak_days
      ELSE COALESCE(v_pr_days, 0)
    END,
    login_pr_end_date = CASE
      WHEN v_streak_days > COALESCE(v_pr_days, 0) THEN v_streak_end
      ELSE v_pr_end_date
    END,
    last_recomputed_at = now(),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Do not expose internal function
REVOKE ALL ON FUNCTION public.recompute_login_streak(uuid) FROM PUBLIC;

-- ============================================================================
-- PART E: Update update_food_streak_on_touch (incremental model)
-- ============================================================================

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
  v_today date;
  v_floor date;
  v_grace_boundary date;
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
  
  -- Get user's local "today" instead of server UTC date
  v_today := public.get_user_local_today(p_user_id);
  v_grace_boundary := v_today - 3;
  
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
    
    -- End date is always user's local today when streak is active
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
-- PART F: Update recompute_food_streak wrapper
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recompute_food_streak(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
BEGIN
  -- Get user's local "today" instead of server UTC date
  v_today := public.get_user_local_today(p_user_id);
  
  -- Call incremental update with user's local today
  PERFORM public.update_food_streak_on_touch(p_user_id, v_today);
END;
$$;

-- Do not expose internal function
REVOKE ALL ON FUNCTION public.recompute_food_streak(uuid) FROM PUBLIC;

-- ============================================================================
-- PART G: Update recompute_my_streaks RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recompute_my_streaks()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Recompute both streaks (they now use user's local timezone internally)
  PERFORM public.recompute_login_streak(v_user_id);
  PERFORM public.recompute_food_streak(v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_my_streaks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_my_streaks() TO authenticated;

-- ============================================================================
-- Validation Notes
-- ============================================================================

/*
To verify timezone-aware behavior:

1. Check user's timezone:
   SELECT user_id, timezone FROM public.profiles WHERE user_id = '...';

2. Test helper function:
   SELECT public.get_user_local_today('...') as local_today, current_date as server_utc_today;

3. Verify streaks use local date:
   SELECT 
     food_current_end_date,
     login_current_end_date,
     public.get_user_local_today(user_id) as local_today
   FROM public.streak_state
   WHERE user_id = '...';
*/


