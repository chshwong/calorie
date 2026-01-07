-- ============================================================================
-- Food Streak Simplification - No Grace, Non-Recoverable
--
-- Replaces the incremental food streak model (with grace period and break floor)
-- with a simple backward-scanning model like login streak, but with a critical
-- difference: days only count if the daily_sum_consumed row was created BEFORE
-- the end of that day (user's local time). This makes streaks non-recoverable
-- by backfill.
--
-- Key changes:
-- 1. Remove grace period columns (food_break_floor_date, food_pending_missing_days)
-- 2. Add helper function to compute end-of-day cutoff timestamps
-- 3. Replace food streak function with simple backward scan
-- 4. Update triggers to call simplified function
-- 5. Update view to remove grace columns
-- ============================================================================

-- ============================================================================
-- PART A: Schema Changes - Remove Grace Period Columns
-- ============================================================================

-- Drop view first (it depends on the columns we're about to drop)
DROP VIEW IF EXISTS public.v_streaks;

-- Now we can safely drop the grace period columns
ALTER TABLE public.streak_state
  DROP COLUMN IF EXISTS food_break_floor_date,
  DROP COLUMN IF EXISTS food_pending_missing_days;

-- ============================================================================
-- PART B: Helper Functions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: get_user_local_today
-- Returns the user's local "today" date based on their timezone setting
-- (Re-created here for idempotency, but should already exist from timezone migration)
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
  -- now() is a timestamptz in UTC, AT TIME ZONE converts it to timestamp in user's timezone
  BEGIN
    v_local_date := (now() AT TIME ZONE v_timezone)::date;
  EXCEPTION WHEN OTHERS THEN
    -- If timezone is invalid, fallback to UTC
    v_local_date := (now() AT TIME ZONE 'UTC')::date;
  END;
  
  RETURN v_local_date;
END;
$$;

-- Do not expose internal function (but allow SECURITY DEFINER functions to use it)
REVOKE ALL ON FUNCTION public.get_user_local_today(uuid) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- Function: get_user_local_day_cutoff
-- Returns the UTC timestamptz corresponding to the start of the next day
-- (end of the given day) in the user's local timezone
-- 
-- Example: For day 2026-01-06 in America/Toronto timezone:
--   Returns: 2026-01-07 05:00:00+00 (midnight EST = 5 AM UTC)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_local_day_cutoff(
  p_user_id uuid,
  p_day date
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timezone text;
  v_cutoff timestamptz;
BEGIN
  -- Get user's timezone from profiles
  SELECT timezone INTO v_timezone
  FROM public.profiles
  WHERE user_id = p_user_id;
  
  -- Fallback to UTC if timezone is null or empty
  IF v_timezone IS NULL OR v_timezone = '' THEN
    v_timezone := 'UTC';
  END IF;
  
  -- Compute cutoff: start of next day (p_day + 1) in user's timezone
  -- This is the end-of-day boundary for p_day
  -- Note: timestamp AT TIME ZONE tz returns timestamptz (already in UTC internally)
  BEGIN
    v_cutoff := (p_day + 1)::timestamp AT TIME ZONE v_timezone;
  EXCEPTION WHEN OTHERS THEN
    -- If timezone is invalid, fallback to UTC
    v_cutoff := (p_day + 1)::timestamp AT TIME ZONE 'UTC';
  END;
  
  RETURN v_cutoff;
END;
$$;

-- Do not expose internal function (but allow SECURITY DEFINER functions to use it)
REVOKE ALL ON FUNCTION public.get_user_local_day_cutoff(uuid, date) FROM PUBLIC;

-- ============================================================================
-- PART C: Replace Food Streak Function (Simple Backward Scan)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: recompute_food_streak
-- Simple backward-scanning food streak computation (like login streak)
-- A day counts ONLY if:
--   1. Row exists in daily_sum_consumed for that date
--   2. AND created_at < end_of_that_day (user's local time, converted to UTC)
-- This prevents backfill recovery: if you log yesterday's food today,
-- created_at will be after yesterday's cutoff, so it won't count.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_food_streak(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date;
  v_check_date date;
  v_streak_days int := 0;
  v_streak_start date;
  v_streak_end date;
  v_cutoff timestamptz;
  v_is_eligible boolean;
  v_pr_days int;
  v_pr_end_date date;
  v_iterations int := 0;
  v_max_iterations int := 800; -- Hard cap to prevent infinite loops
BEGIN
  -- Ensure streak_state row exists
  PERFORM public.ensure_streak_state_row(p_user_id);
  
  -- Get user's local "today"
  v_today := public.get_user_local_today(p_user_id);
  
  -- Start from user's local today and walk backward
  v_check_date := v_today;
  v_streak_end := v_today;
  v_streak_start := NULL;
  
  -- Walk backward while consecutive days are eligible
  WHILE v_iterations < v_max_iterations LOOP
    -- Get cutoff for this day (end of day boundary)
    v_cutoff := public.get_user_local_day_cutoff(p_user_id, v_check_date);
    
    -- Check if day is eligible:
    -- 1. Row exists for this date
    -- 2. AND created_at < cutoff (created before end of that day)
    -- Note: created_at should never be NULL (has DEFAULT now()), but we check anyway
    SELECT EXISTS(
      SELECT 1
      FROM public.daily_sum_consumed
      WHERE user_id = p_user_id
        AND entry_date = v_check_date
        AND created_at IS NOT NULL
        AND created_at < v_cutoff
    ) INTO v_is_eligible;
    
    IF v_is_eligible THEN
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
  
  -- If we found a streak, set end date to today
  IF v_streak_days > 0 THEN
    v_streak_end := v_today;
    v_streak_start := v_today - (v_streak_days - 1);
  ELSE
    v_streak_start := NULL;
    v_streak_end := NULL;
  END IF;
  
  -- Get current PR values
  SELECT food_pr_days, food_pr_end_date
  INTO v_pr_days, v_pr_end_date
  FROM public.streak_state
  WHERE user_id = p_user_id;
  
  -- Update streak_state
  UPDATE public.streak_state
  SET
    food_current_days = v_streak_days,
    food_current_start_date = v_streak_start,
    food_current_end_date = v_streak_end,
    food_pr_days = CASE
      WHEN v_streak_days > COALESCE(v_pr_days, 0) THEN v_streak_days
      ELSE COALESCE(v_pr_days, 0)
    END,
    food_pr_end_date = CASE
      WHEN v_streak_days > COALESCE(v_pr_days, 0) THEN v_streak_end
      ELSE v_pr_end_date
    END,
    last_recomputed_at = now(),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;

-- Do not expose internal function
REVOKE ALL ON FUNCTION public.recompute_food_streak(uuid) FROM PUBLIC;

-- ============================================================================
-- PART D: Update Triggers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trigger function: Call recompute_food_streak on daily_sum_consumed INSERT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_daily_sum_consumed_recompute_food_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recompute food streak for the user
  PERFORM public.recompute_food_streak(NEW.user_id);
  RETURN NEW;
END;
$$;

-- Do not expose trigger function
REVOKE ALL ON FUNCTION public.trg_daily_sum_consumed_recompute_food_streak() FROM PUBLIC;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS daily_sum_consumed_recompute_food_streak_insert ON public.daily_sum_consumed;
DROP TRIGGER IF EXISTS daily_sum_consumed_update_food_streak_insert ON public.daily_sum_consumed;
CREATE TRIGGER daily_sum_consumed_recompute_food_streak_insert
  AFTER INSERT ON public.daily_sum_consumed
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_daily_sum_consumed_recompute_food_streak();

-- Optional: Also trigger on UPDATE if entry_date or user_id changes
-- (Only if your system allows these columns to change)
-- Uncomment if needed:
/*
CREATE OR REPLACE FUNCTION public.trg_daily_sum_consumed_recompute_food_streak_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recompute for new tuple
  PERFORM public.recompute_food_streak(NEW.user_id);
  
  -- If entry_date or user_id changed, also recompute for old tuple
  IF (OLD.user_id IS DISTINCT FROM NEW.user_id) OR (OLD.entry_date IS DISTINCT FROM NEW.entry_date) THEN
    PERFORM public.recompute_food_streak(OLD.user_id);
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS daily_sum_consumed_recompute_food_streak_update ON public.daily_sum_consumed;
CREATE TRIGGER daily_sum_consumed_recompute_food_streak_update
  AFTER UPDATE OF entry_date, user_id ON public.daily_sum_consumed
  FOR EACH ROW
  WHEN (
    OLD.user_id IS DISTINCT FROM NEW.user_id OR
    OLD.entry_date IS DISTINCT FROM NEW.entry_date
  )
  EXECUTE FUNCTION public.trg_daily_sum_consumed_recompute_food_streak_update();
*/

-- ============================================================================
-- PART E: Recreate View (Without Grace Columns)
-- ============================================================================

-- View was already dropped in PART A, now recreate it without grace columns
CREATE VIEW public.v_streaks AS
SELECT
  user_id,
  food_pr_days,
  food_pr_end_date,
  food_current_start_date,
  food_current_end_date,
  food_current_days,
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
-- PART F: Cleanup - Remove Old Incremental Function (if exists)
-- ============================================================================

-- Drop the old incremental update function if it exists
-- (It's no longer needed with the simplified model)
DROP FUNCTION IF EXISTS public.update_food_streak_on_touch(uuid, date);

-- ============================================================================
-- PART G: Validation Queries
-- ============================================================================

-- Example validation queries (commented out - uncomment and use):

/*
-- 1) First, get your user_id:
SELECT id as user_id FROM auth.users WHERE email = 'your-email@example.com';

-- 2) Show streak_state row for a user (replace with actual UUID):
SELECT * FROM public.streak_state WHERE user_id = 'YOUR_ACTUAL_UUID_HERE';

-- 3) Debug today's eligibility - check if today's row counts (replace with actual UUID):
SELECT 
  entry_date,
  created_at,
  public.get_user_local_day_cutoff('YOUR_ACTUAL_UUID_HERE'::uuid, entry_date) AS cutoff,
  now() AS current_time,
  public.get_user_local_today('YOUR_ACTUAL_UUID_HERE'::uuid) AS local_today,
  (SELECT timezone FROM public.profiles WHERE user_id = 'YOUR_ACTUAL_UUID_HERE'::uuid) AS user_timezone,
  CASE 
    WHEN created_at < public.get_user_local_day_cutoff('YOUR_ACTUAL_UUID_HERE'::uuid, entry_date) 
    THEN 'Counts for streak'
    ELSE 'Does NOT count (created_at >= cutoff)'
  END AS eligibility,
  created_at < public.get_user_local_day_cutoff('YOUR_ACTUAL_UUID_HERE'::uuid, entry_date) AS is_eligible
FROM public.daily_sum_consumed
WHERE user_id = 'YOUR_ACTUAL_UUID_HERE'::uuid
  AND entry_date = public.get_user_local_today('YOUR_ACTUAL_UUID_HERE'::uuid);

-- 3) Show last 7 days eligibility with cutoff timestamps (uses auth.uid()):
-- This shows which days count for streak (row exists AND created_at < cutoff)
WITH date_series AS (
  SELECT generate_series(
    public.get_user_local_today(auth.uid()) - 6,
    public.get_user_local_today(auth.uid()),
    INTERVAL '1 day'
  )::date AS d
)
SELECT 
  ds.d,
  EXISTS(
    SELECT 1 
    FROM public.daily_sum_consumed dsc
    WHERE dsc.user_id = auth.uid() 
      AND dsc.entry_date = ds.d
      AND dsc.created_at IS NOT NULL
      AND dsc.created_at < public.get_user_local_day_cutoff(auth.uid(), ds.d)
  ) AS counts_for_streak,
  (SELECT MIN(created_at) FROM public.daily_sum_consumed WHERE user_id = auth.uid() AND entry_date = ds.d) AS created_at,
  public.get_user_local_day_cutoff(auth.uid(), ds.d) AS cutoff_timestamp
FROM date_series ds
ORDER BY ds.d;

-- 4) Verify backfill prevention (uses auth.uid()):
-- If a row was created AFTER the cutoff, it should NOT count for streak
-- Example: Logging yesterday's food today will have created_at > yesterday's cutoff
SELECT 
  entry_date,
  created_at,
  public.get_user_local_day_cutoff(auth.uid(), entry_date) AS cutoff,
  CASE 
    WHEN created_at < public.get_user_local_day_cutoff(auth.uid(), entry_date) 
    THEN 'Counts for streak'
    ELSE 'Does NOT count (backfilled)'
  END AS eligibility
FROM public.daily_sum_consumed
WHERE user_id = auth.uid()
  AND entry_date >= public.get_user_local_today(auth.uid()) - 7
ORDER BY entry_date DESC;

-- 5) COMPREHENSIVE DIAGNOSTIC: Check if rows exist and why they might be missing
-- Run this to see what's happening (uses auth.uid()):
SELECT 
  'Profile exists' AS check_type,
  CASE WHEN EXISTS(SELECT 1 FROM public.profiles WHERE user_id = auth.uid()) 
    THEN 'YES' ELSE 'NO' END AS result,
  (SELECT timezone FROM public.profiles WHERE user_id = auth.uid()) AS timezone_value
UNION ALL
SELECT 
  'Local today',
  public.get_user_local_today(auth.uid())::text,
  NULL
UNION ALL
SELECT 
  'Calorie entries today',
  COUNT(*)::text,
  NULL
FROM public.calorie_entries
WHERE user_id = auth.uid()
  AND entry_date = public.get_user_local_today(auth.uid())
UNION ALL
SELECT 
  'Daily sum consumed today',
  COUNT(*)::text,
  NULL
FROM public.daily_sum_consumed
WHERE user_id = auth.uid()
  AND entry_date = public.get_user_local_today(auth.uid())
UNION ALL
SELECT 
  'Streak state exists',
  CASE WHEN EXISTS(SELECT 1 FROM public.streak_state WHERE user_id = auth.uid()) 
    THEN 'YES' ELSE 'NO' END,
  NULL
UNION ALL
SELECT 
  'Total calorie entries (all time)',
  COUNT(*)::text,
  NULL
FROM public.calorie_entries
WHERE user_id = auth.uid()
UNION ALL
SELECT 
  'Total daily_sum_consumed (all time)',
  COUNT(*)::text,
  NULL
FROM public.daily_sum_consumed
WHERE user_id = auth.uid();

-- 6) Check recent calorie_entries to see if trigger should have fired:
SELECT 
  entry_date,
  created_at,
  updated_at,
  calories_kcal
FROM public.calorie_entries
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 10;

-- 7) Check if daily_sum_consumed was created for those dates:
SELECT 
  dsc.entry_date,
  dsc.created_at,
  dsc.updated_at,
  dsc.calories,
  EXISTS(
    SELECT 1 
    FROM public.calorie_entries ce 
    WHERE ce.user_id = dsc.user_id 
      AND ce.entry_date = dsc.entry_date
  ) AS has_calorie_entries
FROM public.daily_sum_consumed dsc
WHERE dsc.user_id = auth.uid()
ORDER BY dsc.entry_date DESC
LIMIT 10;

-- 8) Check if triggers are set up correctly:
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table IN ('calorie_entries', 'daily_sum_consumed')
  AND trigger_name LIKE '%recompute%'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- MANUAL TEST QUERIES (Replace 'YOUR_USER_ID_HERE' with your actual UUID)
-- ============================================================================

-- STEP 1: Get your user_id (run this first):
SELECT user_id, first_name, timezone 
FROM public.profiles 
ORDER BY created_at DESC 
LIMIT 5;

-- STEP 2: Replace 'YOUR_USER_ID_HERE' below with one of the UUIDs from STEP 1, then run:

-- Force creation of daily_sum_consumed for today:
SELECT public.recompute_daily_sum_consumed_for_date(
  'f0e891f3-a79f-47f4-a8b7-9aeff4c8e06a'::uuid,
  public.get_user_local_today('f0e891f3-a79f-47f4-a8b7-9aeff4c8e06a'::uuid),
  true
);

-- Check if it was created and is eligible:
SELECT 
  entry_date,
  created_at,
  calories,
  public.get_user_local_day_cutoff('f0e891f3-a79f-47f4-a8b7-9aeff4c8e06a'::uuid, entry_date) AS cutoff,
  created_at < public.get_user_local_day_cutoff('f0e891f3-a79f-47f4-a8b7-9aeff4c8e06a'::uuid, entry_date) AS is_eligible,
  now() AS current_time
FROM public.daily_sum_consumed
WHERE user_id = 'f0e891f3-a79f-47f4-a8b7-9aeff4c8e06a'::uuid
  AND entry_date = public.get_user_local_today('f0e891f3-a79f-47f4-a8b7-9aeff4c8e06a'::uuid);

-- Manually trigger streak recompute:
SELECT public.recompute_food_streak('f0e891f3-a79f-47f4-a8b7-9aeff4c8e06a'::uuid);

-- Check streak_state:
SELECT 
  food_current_days,
  food_current_start_date,
  food_current_end_date,
  food_pr_days,
  food_pr_end_date
FROM public.streak_state
WHERE user_id = 'YOUR_USER_ID_HERE'::uuid;

-- Comprehensive diagnostic with explicit user_id:
SELECT 
  'Profile exists' AS check_type,
  CASE WHEN EXISTS(SELECT 1 FROM public.profiles WHERE user_id = 'YOUR_USER_ID_HERE'::uuid) 
    THEN 'YES' ELSE 'NO' END AS result,
  (SELECT timezone FROM public.profiles WHERE user_id = 'YOUR_USER_ID_HERE'::uuid) AS timezone_value
UNION ALL
SELECT 
  'Local today',
  public.get_user_local_today('YOUR_USER_ID_HERE'::uuid)::text,
  NULL
UNION ALL
SELECT 
  'Calorie entries today',
  COUNT(*)::text,
  NULL
FROM public.calorie_entries
WHERE user_id = 'YOUR_USER_ID_HERE'::uuid
  AND entry_date = public.get_user_local_today('YOUR_USER_ID_HERE'::uuid)
UNION ALL
SELECT 
  'Daily sum consumed today',
  COUNT(*)::text,
  NULL
FROM public.daily_sum_consumed
WHERE user_id = 'YOUR_USER_ID_HERE'::uuid
  AND entry_date = public.get_user_local_today('YOUR_USER_ID_HERE'::uuid)
UNION ALL
SELECT 
  'Streak state exists',
  CASE WHEN EXISTS(SELECT 1 FROM public.streak_state WHERE user_id = 'YOUR_USER_ID_HERE'::uuid) 
    THEN 'YES' ELSE 'NO' END,
  NULL;
*/

