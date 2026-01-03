-- Migration: Clean up profile water columns and change to NUMERIC
-- 1. Migrate goal_ml to water_goal_ml if needed
-- 2. Change water_goal_ml to NUMERIC(10,4) for 4 decimal precision
-- 3. Drop dead columns: goal_ml, goal_floz, goal_cup

-- Migrate goal_ml to water_goal_ml if water_goal_ml is null
UPDATE profiles
SET water_goal_ml = goal_ml
WHERE water_goal_ml IS NULL AND goal_ml IS NOT NULL;

-- Change water_goal_ml to NUMERIC(10,4) for precision
ALTER TABLE profiles
ALTER COLUMN water_goal_ml TYPE NUMERIC(10,4) USING water_goal_ml::NUMERIC(10,4);

-- Drop dead columns
ALTER TABLE profiles
DROP COLUMN IF EXISTS goal_ml,
DROP COLUMN IF EXISTS goal_floz,
DROP COLUMN IF EXISTS goal_cup;

-- Update constraint for NUMERIC type
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS water_goal_ml_range;
ALTER TABLE profiles
ADD CONSTRAINT water_goal_ml_range 
CHECK (water_goal_ml IS NULL OR (water_goal_ml >= 480 AND water_goal_ml <= 5000));

COMMENT ON COLUMN profiles.water_goal_ml IS 'Current default daily water goal in ml (NUMERIC with 4 decimal precision). This is the single source of truth for water goals.';

