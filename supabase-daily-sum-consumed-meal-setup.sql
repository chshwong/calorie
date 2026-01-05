-- ============================================================================
-- daily_sum_consumed_meal (per-meal daily fact table)
--
-- Semantics:
-- - 1 row per (user_id, entry_date, meal_type)
-- - Row existence = meal has entries for that day
-- - Missing row = meal has no entries (or was deleted)
-- - Rows are deleted when meal_type has no entries (derived data cleanup)
--
-- This file creates:
-- - table: public.daily_sum_consumed_meal
-- - constraints + indexes
-- - updated_at trigger (reuses public.update_updated_at_column())
-- - RLS policies (select/insert/update own rows; delete disallowed)
-- ============================================================================

-- 1) Table
CREATE TABLE IF NOT EXISTS public.daily_sum_consumed_meal (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  meal_type text NOT NULL,

  -- Derived totals (recomputable from calorie_entries grouped by meal_type)
  calories integer NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  carbs_g numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  fibre_g numeric NOT NULL DEFAULT 0, -- maps from calorie_entries.fiber_g
  sugar_g numeric NOT NULL DEFAULT 0,
  saturated_fat_g numeric NOT NULL DEFAULT 0,
  trans_fat_g numeric NOT NULL DEFAULT 0,
  sodium_mg integer NOT NULL DEFAULT 0,

  -- System timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  last_recomputed_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT daily_sum_consumed_meal_user_date_meal_unique UNIQUE (user_id, entry_date, meal_type),
  CONSTRAINT daily_sum_consumed_meal_non_negative CHECK (
    calories >= 0 AND sodium_mg >= 0 AND
    protein_g >= 0 AND carbs_g >= 0 AND fat_g >= 0 AND
    fibre_g >= 0 AND sugar_g >= 0 AND
    saturated_fat_g >= 0 AND trans_fat_g >= 0
  )
);

-- 2) Indexes
CREATE INDEX IF NOT EXISTS daily_sum_consumed_meal_user_date_idx
  ON public.daily_sum_consumed_meal (user_id, entry_date);

CREATE INDEX IF NOT EXISTS daily_sum_consumed_meal_user_date_meal_idx
  ON public.daily_sum_consumed_meal (user_id, entry_date, meal_type);

-- 3) updated_at trigger (reuse existing shared function; define if missing)
-- Note: update_updated_at_column() is already defined in supabase-daily-sum-consumed-setup.sql
-- but we ensure it exists here for idempotency
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_daily_sum_consumed_meal_updated_at ON public.daily_sum_consumed_meal;
CREATE TRIGGER update_daily_sum_consumed_meal_updated_at
  BEFORE UPDATE ON public.daily_sum_consumed_meal
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4) RLS
ALTER TABLE public.daily_sum_consumed_meal ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotency)
DROP POLICY IF EXISTS "Users can select their own daily consumed meal" ON public.daily_sum_consumed_meal;
DROP POLICY IF EXISTS "Users can insert their own daily consumed meal" ON public.daily_sum_consumed_meal;
DROP POLICY IF EXISTS "Users can update their own daily consumed meal" ON public.daily_sum_consumed_meal;
DROP POLICY IF EXISTS "Disallow delete daily_sum_consumed_meal" ON public.daily_sum_consumed_meal;

CREATE POLICY "Users can select their own daily consumed meal"
  ON public.daily_sum_consumed_meal
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily consumed meal"
  ON public.daily_sum_consumed_meal
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily consumed meal"
  ON public.daily_sum_consumed_meal
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Explicitly disallow deletes (even though RLS would deny by default)
-- Note: recompute function uses SECURITY DEFINER so it can delete for cleanup
CREATE POLICY "Disallow delete daily_sum_consumed_meal"
  ON public.daily_sum_consumed_meal
  FOR DELETE
  TO authenticated
  USING (false);

