-- ============================================================================
-- Streak Tracking Setup (Login + Food)
--
-- Implements streak tracking for:
-- - Login streak: consecutive days with login (no grace window)
-- - Food streak: consecutive days with food interaction (3-day grace window)
--
-- Food streak eligibility: ANY day with a row in daily_sum_consumed
-- (regardless of log_status: completed/fasted/unknown/reopened all count)
--
-- Food streak uses "settled streak" concept:
-- - settled_end = current_date - 3
-- - Current streak = consecutive days ending at settled_end
-- - Last 3 days are "pending" and do NOT break stored streak
--
-- This file creates:
-- - table: public.daily_login
-- - table: public.streak_state
-- - functions: ensure_streak_state_row, recompute_login_streak, recompute_food_streak
-- - RPCs: touch_daily_login, recompute_my_streaks
-- - triggers: on daily_sum_consumed INSERT
-- - view: public.v_streaks (optional)
-- - RLS policies for all tables
-- ============================================================================

-- ============================================================================
-- PART A: Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table: public.daily_login
-- Tracks daily login events (one row per user per day)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_login (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  first_login_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_login_user_date_unique UNIQUE (user_id, entry_date)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS daily_login_user_date_idx
  ON public.daily_login (user_id, entry_date);

-- ----------------------------------------------------------------------------
-- Table: public.streak_state
-- Stores streak state (one row per user)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.streak_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Food streak fields
  food_pr_days int NOT NULL DEFAULT 0,
  food_pr_end_date date NULL,
  food_current_start_date date NULL,
  food_current_end_date date NULL,
  food_current_days int NOT NULL DEFAULT 0,
  
  -- Login streak fields
  login_pr_days int NOT NULL DEFAULT 0,
  login_pr_end_date date NULL,
  login_current_start_date date NULL,
  login_current_end_date date NULL,
  login_current_days int NOT NULL DEFAULT 0,
  
  -- Metadata
  last_recomputed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index on user_id (optional, PK already covers it, but explicit for clarity)
CREATE INDEX IF NOT EXISTS streak_state_user_id_idx
  ON public.streak_state (user_id);

-- ============================================================================
-- PART B: updated_at Triggers
-- ============================================================================

-- Ensure update_updated_at_column function exists (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for daily_login
DROP TRIGGER IF EXISTS update_daily_login_updated_at ON public.daily_login;
CREATE TRIGGER update_daily_login_updated_at
  BEFORE UPDATE ON public.daily_login
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for streak_state
DROP TRIGGER IF EXISTS update_streak_state_updated_at ON public.streak_state;
CREATE TRIGGER update_streak_state_updated_at
  BEFORE UPDATE ON public.streak_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- PART C: RLS Policies
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RLS for public.daily_login
-- ----------------------------------------------------------------------------
ALTER TABLE public.daily_login ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotency)
DROP POLICY IF EXISTS "Users can select their own daily login" ON public.daily_login;
DROP POLICY IF EXISTS "Users can insert their own daily login" ON public.daily_login;
DROP POLICY IF EXISTS "Users can update their own daily login" ON public.daily_login;
DROP POLICY IF EXISTS "Disallow delete daily_login" ON public.daily_login;

CREATE POLICY "Users can select their own daily login"
  ON public.daily_login
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily login"
  ON public.daily_login
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily login"
  ON public.daily_login
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Explicitly disallow deletes
CREATE POLICY "Disallow delete daily_login"
  ON public.daily_login
  FOR DELETE
  TO authenticated
  USING (false);

-- ----------------------------------------------------------------------------
-- RLS for public.streak_state
-- ----------------------------------------------------------------------------
ALTER TABLE public.streak_state ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotency)
DROP POLICY IF EXISTS "Users can select their own streak state" ON public.streak_state;
DROP POLICY IF EXISTS "Disallow insert streak_state" ON public.streak_state;
DROP POLICY IF EXISTS "Disallow update streak_state" ON public.streak_state;
DROP POLICY IF EXISTS "Disallow delete streak_state" ON public.streak_state;

CREATE POLICY "Users can select their own streak state"
  ON public.streak_state
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- All writes blocked (only SECURITY DEFINER RPCs can write)
CREATE POLICY "Disallow insert streak_state"
  ON public.streak_state
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "Disallow update streak_state"
  ON public.streak_state
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "Disallow delete streak_state"
  ON public.streak_state
  FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================================
-- PART D: Helper Functions (SECURITY DEFINER)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: ensure_streak_state_row
-- Ensures a streak_state row exists for the user
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_streak_state_row(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.streak_state (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Do not expose internal function
REVOKE ALL ON FUNCTION public.ensure_streak_state_row(uuid) FROM PUBLIC;

-- ----------------------------------------------------------------------------
-- Function: recompute_login_streak
-- Recomputes login streak by walking backward from current_date
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_login_streak(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_date date := current_date;
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
  
  -- Start from current_date and walk backward
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

-- ----------------------------------------------------------------------------
-- Function: recompute_food_streak
-- Recomputes food streak by walking backward from settled_end (current_date - 3)
-- IMPORTANT: Only checks row existence in daily_sum_consumed, NOT log_status
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_food_streak(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_date date := current_date;
  v_settled_end date := v_current_date - 3; -- 3-day grace window
  v_check_date date;
  v_streak_days int := 0;
  v_streak_start date;
  v_streak_end date;
  v_has_food boolean;
  v_pr_days int;
  v_pr_end_date date;
  v_iterations int := 0;
  v_max_iterations int := 800; -- Hard cap to prevent infinite loops
BEGIN
  -- Ensure streak_state row exists
  PERFORM public.ensure_streak_state_row(p_user_id);
  
  -- Start from settled_end and walk backward
  v_check_date := v_settled_end;
  v_streak_end := v_settled_end;
  v_streak_start := NULL;
  
  -- Walk backward while consecutive days have food interaction
  WHILE v_iterations < v_max_iterations LOOP
    -- Check if daily_sum_consumed row exists for this date
    -- IMPORTANT: Only check row existence, NOT log_status
    SELECT EXISTS(
      SELECT 1
      FROM public.daily_sum_consumed
      WHERE user_id = p_user_id
        AND entry_date = v_check_date
    ) INTO v_has_food;
    
    IF v_has_food THEN
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
  
  -- If we found a streak, set end date to settled_end
  IF v_streak_days > 0 THEN
    v_streak_end := v_settled_end;
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
-- PART E: Client-Callable RPCs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- RPC: touch_daily_login
-- Records a login for the current date and recomputes login streak
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_daily_login()
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_today date := current_date;
  v_now timestamptz := now();
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
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

-- ----------------------------------------------------------------------------
-- RPC: recompute_my_streaks (optional)
-- Manually recomputes both login and food streaks for the current user
-- Useful when user returns after >3 days to refresh stale streaks
-- ----------------------------------------------------------------------------
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
  
  -- Recompute both streaks
  PERFORM public.recompute_login_streak(v_user_id);
  PERFORM public.recompute_food_streak(v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_my_streaks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_my_streaks() TO authenticated;

-- ============================================================================
-- PART F: Triggers
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trigger: Recompute food streak on daily_sum_consumed INSERT
-- This ensures food streak is updated whenever a day is "touched"
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

-- Create trigger
DROP TRIGGER IF EXISTS daily_sum_consumed_recompute_food_streak_insert ON public.daily_sum_consumed;
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
-- PART G: Optional View
-- ============================================================================

-- ----------------------------------------------------------------------------
-- View: public.v_streaks
-- Simple view over streak_state (relies on underlying RLS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_streaks AS
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

