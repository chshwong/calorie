-- ============================================================================
-- daily_sum_consumed (durable daily fact table)
--
-- Semantics:
-- - 1 row per (user_id, entry_date)
-- - Row existence = user "touched" that day (food logging interaction or status set)
-- - Missing row = missed day (no interaction)
-- - Rows are NEVER auto-deleted, even if totals become 0
--
-- This file creates:
-- - enum: public.daily_log_status
-- - table: public.daily_sum_consumed
-- - constraints + indexes
-- - updated_at trigger (reuses public.update_updated_at_column())
-- - RLS policies (select/insert/update own rows; delete disallowed)
-- ============================================================================

-- 1) Enum type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'daily_log_status'
  ) THEN
    CREATE TYPE public.daily_log_status AS ENUM ('unknown', 'completed', 'fasted');
  END IF;
END $$;

-- 2) Table
CREATE TABLE IF NOT EXISTS public.daily_sum_consumed (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,

  -- Derived totals (recomputable from calorie_entries)
  calories integer NOT NULL DEFAULT 0,
  protein_g numeric NOT NULL DEFAULT 0,
  carbs_g numeric NOT NULL DEFAULT 0,
  fat_g numeric NOT NULL DEFAULT 0,
  fibre_g numeric NOT NULL DEFAULT 0, -- maps from calorie_entries.fiber_g
  sugar_g numeric NOT NULL DEFAULT 0,
  saturated_fat_g numeric NOT NULL DEFAULT 0,
  trans_fat_g numeric NOT NULL DEFAULT 0,
  sodium_mg integer NOT NULL DEFAULT 0,

  -- Explicit day state (user intent)
  log_status public.daily_log_status NOT NULL DEFAULT 'unknown',

  created_at timestamptz NOT NULL DEFAULT now(),
  touched_at timestamptz NOT NULL DEFAULT now(),
  status_updated_at timestamptz NULL,
  completed_at timestamptz NULL,
  last_recomputed_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT daily_sum_consumed_user_date_unique UNIQUE (user_id, entry_date),
  CONSTRAINT daily_sum_consumed_non_negative CHECK (
    calories >= 0 AND sodium_mg >= 0 AND
    protein_g >= 0 AND carbs_g >= 0 AND fat_g >= 0 AND
    fibre_g >= 0 AND sugar_g >= 0 AND
    saturated_fat_g >= 0 AND trans_fat_g >= 0
  ),
  CONSTRAINT daily_sum_consumed_completed_at_consistency CHECK (
    (log_status = 'completed' AND completed_at IS NOT NULL) OR
    (log_status <> 'completed' AND completed_at IS NULL)
  )
);

-- 3) Indexes
CREATE INDEX IF NOT EXISTS daily_sum_consumed_user_date_idx
  ON public.daily_sum_consumed (user_id, entry_date);

CREATE INDEX IF NOT EXISTS daily_sum_consumed_user_status_date_idx
  ON public.daily_sum_consumed (user_id, log_status, entry_date);

-- 4) updated_at trigger (reuse existing shared function; define if missing)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_daily_sum_consumed_updated_at ON public.daily_sum_consumed;
CREATE TRIGGER update_daily_sum_consumed_updated_at
  BEFORE UPDATE ON public.daily_sum_consumed
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5) RLS
ALTER TABLE public.daily_sum_consumed ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (idempotency)
DROP POLICY IF EXISTS "Users can select their own daily consumed" ON public.daily_sum_consumed;
DROP POLICY IF EXISTS "Users can insert their own daily consumed" ON public.daily_sum_consumed;
DROP POLICY IF EXISTS "Users can update their own daily consumed" ON public.daily_sum_consumed;
DROP POLICY IF EXISTS "Users can delete their own daily consumed" ON public.daily_sum_consumed;
DROP POLICY IF EXISTS "Disallow delete daily_sum_consumed" ON public.daily_sum_consumed;

CREATE POLICY "Users can select their own daily consumed"
  ON public.daily_sum_consumed
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily consumed"
  ON public.daily_sum_consumed
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily consumed"
  ON public.daily_sum_consumed
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Explicitly disallow deletes (even though RLS would deny by default)
CREATE POLICY "Disallow delete daily_sum_consumed"
  ON public.daily_sum_consumed
  FOR DELETE
  TO authenticated
  USING (false);


