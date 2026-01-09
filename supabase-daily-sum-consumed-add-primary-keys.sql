-- ============================================================================
-- Add PRIMARY KEYS to daily_sum_consumed and daily_sum_consumed_meal
--
-- This migration:
-- 1. Adds composite PRIMARY KEY (user_id, entry_date) to daily_sum_consumed
-- 2. Adds composite PRIMARY KEY (user_id, entry_date, meal_type) to daily_sum_consumed_meal
-- 3. Removes redundant UNIQUE constraints (replaced by PKs)
-- 4. Adds FK from daily_sum_consumed_meal to daily_sum_consumed
--
-- VALIDATION: Before running, check for duplicates:
--   SELECT user_id, entry_date, COUNT(*) FROM public.daily_sum_consumed 
--   GROUP BY 1,2 HAVING COUNT(*) > 1;
--   SELECT user_id, entry_date, meal_type, COUNT(*) FROM public.daily_sum_consumed_meal 
--   GROUP BY 1,2,3 HAVING COUNT(*) > 1;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) daily_sum_consumed: Add composite PRIMARY KEY
-- ----------------------------------------------------------------------------

-- Check if PK already exists (idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_sum_consumed_pkey'
    AND contype = 'p'
  ) THEN
    -- Add composite PRIMARY KEY
    ALTER TABLE public.daily_sum_consumed
      ADD CONSTRAINT daily_sum_consumed_pkey 
      PRIMARY KEY (user_id, entry_date);
  END IF;
END $$;

-- Drop redundant UNIQUE constraint (PK provides uniqueness)
ALTER TABLE public.daily_sum_consumed
  DROP CONSTRAINT IF EXISTS daily_sum_consumed_user_date_unique;

-- ----------------------------------------------------------------------------
-- 2) daily_sum_consumed_meal: Add composite PRIMARY KEY
-- ----------------------------------------------------------------------------

-- Check if PK already exists (idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_sum_consumed_meal_pkey'
    AND contype = 'p'
  ) THEN
    -- Add composite PRIMARY KEY
    ALTER TABLE public.daily_sum_consumed_meal
      ADD CONSTRAINT daily_sum_consumed_meal_pkey 
      PRIMARY KEY (user_id, entry_date, meal_type);
  END IF;
END $$;

-- Drop redundant UNIQUE constraint (PK provides uniqueness)
ALTER TABLE public.daily_sum_consumed_meal
  DROP CONSTRAINT IF EXISTS daily_sum_consumed_meal_user_date_meal_unique;

-- ----------------------------------------------------------------------------
-- 3) daily_sum_consumed_meal: Add FK to daily_sum_consumed
-- ----------------------------------------------------------------------------

-- Check if FK already exists (idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'daily_sum_consumed_meal_parent_fkey'
    AND contype = 'f'
  ) THEN
    -- Add FK referencing the composite PK
    ALTER TABLE public.daily_sum_consumed_meal
      ADD CONSTRAINT daily_sum_consumed_meal_parent_fkey
      FOREIGN KEY (user_id, entry_date)
      REFERENCES public.daily_sum_consumed (user_id, entry_date)
      ON DELETE CASCADE;
  END IF;
END $$;


