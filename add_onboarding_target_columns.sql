-- Add columns for onboarding calorie target and nutrient targets
-- Run this migration to add the missing columns to the profiles table

ALTER TABLE public.profiles
  -- Calorie target metadata
  ADD COLUMN IF NOT EXISTS maintenance_calories integer NULL,
  ADD COLUMN IF NOT EXISTS calorie_plan text NULL,
  ADD COLUMN IF NOT EXISTS onboarding_calorie_set_at timestamp with time zone NULL,
  
  -- Daily nutrient targets
  ADD COLUMN IF NOT EXISTS protein_g_min integer NULL,
  ADD COLUMN IF NOT EXISTS fiber_g_min integer NULL,
  ADD COLUMN IF NOT EXISTS carbs_g_max integer NULL,
  ADD COLUMN IF NOT EXISTS sugar_g_max integer NULL,
  ADD COLUMN IF NOT EXISTS sodium_mg_max integer NULL,
  ADD COLUMN IF NOT EXISTS onboarding_targets_set_at timestamp with time zone NULL;

-- Add constraints for nutrient targets (optional, but recommended)
-- Drop constraints first if they exist (safe for re-running)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'protein_g_min_range') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT protein_g_min_range;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fiber_g_min_range') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT fiber_g_min_range;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'carbs_g_max_range') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT carbs_g_max_range;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sugar_g_max_range') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT sugar_g_max_range;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sodium_mg_max_range') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT sodium_mg_max_range;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_valid_calorie_plan') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT check_valid_calorie_plan;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT protein_g_min_range CHECK (
    protein_g_min IS NULL OR (protein_g_min >= 50 AND protein_g_min <= 300)
  ),
  ADD CONSTRAINT fiber_g_min_range CHECK (
    fiber_g_min IS NULL OR (fiber_g_min >= 15 AND fiber_g_min <= 60)
  ),
  ADD CONSTRAINT carbs_g_max_range CHECK (
    carbs_g_max IS NULL OR (carbs_g_max >= 50 AND carbs_g_max <= 500)
  ),
  ADD CONSTRAINT sugar_g_max_range CHECK (
    sugar_g_max IS NULL OR (sugar_g_max >= 10 AND sugar_g_max <= 150)
  ),
  ADD CONSTRAINT sodium_mg_max_range CHECK (
    sodium_mg_max IS NULL OR (sodium_mg_max >= 500 AND sodium_mg_max <= 5000)
  ),
  ADD CONSTRAINT check_valid_calorie_plan CHECK (
    calorie_plan IS NULL OR calorie_plan IN ('easy', 'recommended', 'aggressive', 'custom', 'calculated')
  );

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.maintenance_calories IS 'Estimated maintenance calories (TDEE) in kcal/day';
COMMENT ON COLUMN public.profiles.calorie_plan IS 'Calorie plan type: easy, recommended, aggressive, custom, or calculated';
COMMENT ON COLUMN public.profiles.onboarding_calorie_set_at IS 'Timestamp when calorie target was set during onboarding';
COMMENT ON COLUMN public.profiles.protein_g_min IS 'Daily minimum protein target in grams';
COMMENT ON COLUMN public.profiles.fiber_g_min IS 'Daily minimum fiber target in grams';
COMMENT ON COLUMN public.profiles.carbs_g_max IS 'Daily maximum carbs target in grams';
COMMENT ON COLUMN public.profiles.sugar_g_max IS 'Daily maximum sugar target in grams';
COMMENT ON COLUMN public.profiles.sodium_mg_max IS 'Daily maximum sodium target in milligrams';
COMMENT ON COLUMN public.profiles.onboarding_targets_set_at IS 'Timestamp when nutrient targets were set during onboarding';

