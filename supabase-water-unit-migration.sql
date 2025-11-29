-- Migration: Add water unit support and per-unit goal storage
-- This migration adds water_unit preference and stores goals in multiple units

-- ============================================================================
-- PROFILES TABLE CHANGES
-- ============================================================================

-- Add water_unit to profiles (default to 'ml')
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS water_unit TEXT NOT NULL DEFAULT 'ml'
CHECK (water_unit IN ('ml', 'floz', 'cup'));

-- Add goal fields to profiles (canonical ml + cached unit-specific values)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS goal_ml INTEGER;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS goal_floz INTEGER;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS goal_cup INTEGER;

-- Add constraint for goal range (480-5000ml equivalent)
-- Note: We validate in ml, but store in multiple units for convenience
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS water_goal_ml_range;
ALTER TABLE profiles
ADD CONSTRAINT water_goal_ml_range 
CHECK (goal_ml IS NULL OR (goal_ml >= 480 AND goal_ml <= 5000));

-- ============================================================================
-- WATER_DAILY TABLE CHANGES
-- ============================================================================

-- Add water_unit to water_daily (default to 'ml')
ALTER TABLE water_daily
ADD COLUMN IF NOT EXISTS water_unit TEXT NOT NULL DEFAULT 'ml'
CHECK (water_unit IN ('ml', 'floz', 'cup'));

-- Add goal fields (canonical ml + cached unit-specific values)
ALTER TABLE water_daily
ADD COLUMN IF NOT EXISTS goal_ml INTEGER;

ALTER TABLE water_daily
ADD COLUMN IF NOT EXISTS goal_floz INTEGER;

ALTER TABLE water_daily
ADD COLUMN IF NOT EXISTS goal_cup INTEGER;

-- Rename total_ml to total (keeping ml for backward compatibility initially)
-- We'll add total as a new column, migrate data, then drop total_ml
ALTER TABLE water_daily
ADD COLUMN IF NOT EXISTS total INTEGER;

-- Migrate existing total_ml to total (assuming existing data is in ml)
UPDATE water_daily
SET total = total_ml
WHERE total IS NULL AND total_ml IS NOT NULL;

-- Set default for total if still null
UPDATE water_daily
SET total = 0
WHERE total IS NULL;

-- Make total NOT NULL after migration
ALTER TABLE water_daily
ALTER COLUMN total SET NOT NULL;

-- Rename goal_ml to goal (keeping goal_ml for backward compatibility initially)
ALTER TABLE water_daily
ADD COLUMN IF NOT EXISTS goal INTEGER;

-- Migrate existing goal_ml to goal (assuming existing data is in ml)
UPDATE water_daily
SET goal = goal_ml
WHERE goal IS NULL AND goal_ml IS NOT NULL;

-- Migrate existing data: set water_unit = 'ml' and compute goal_floz/goal_cup from goal_ml
UPDATE water_daily
SET 
  water_unit = 'ml',
  goal_ml = COALESCE(goal_ml, goal),
  goal_floz = CASE 
    WHEN goal_ml IS NOT NULL THEN ROUND(goal_ml / 29.5735)
    ELSE NULL
  END,
  goal_cup = CASE
    WHEN goal_ml IS NOT NULL THEN ROUND(goal_ml / 240.0)
    ELSE NULL
  END
WHERE water_unit = 'ml' AND (goal_floz IS NULL OR goal_cup IS NULL);

-- Add constraint for goal range
ALTER TABLE water_daily
DROP CONSTRAINT IF EXISTS goal_ml_range;
ALTER TABLE water_daily
ADD CONSTRAINT goal_ml_range 
CHECK (goal_ml IS NULL OR (goal_ml >= 480 AND goal_ml <= 5000));

-- Add constraint for total non-negative
ALTER TABLE water_daily
DROP CONSTRAINT IF EXISTS total_ml_non_negative;
ALTER TABLE water_daily
ADD CONSTRAINT total_non_negative 
CHECK (total >= 0);

-- Add comments
COMMENT ON COLUMN profiles.water_unit IS 'User preference for water display unit: ml, floz, or cup';
COMMENT ON COLUMN profiles.goal_ml IS 'Canonical daily water goal in milliliters (480-5000ml)';
COMMENT ON COLUMN profiles.goal_floz IS 'Cached goal in fluid ounces (derived from goal_ml)';
COMMENT ON COLUMN profiles.goal_cup IS 'Cached goal in cups (derived from goal_ml)';

COMMENT ON COLUMN water_daily.water_unit IS 'Unit used for this date: ml, floz, or cup';
COMMENT ON COLUMN water_daily.total IS 'Total water consumed in the row''s water_unit';
COMMENT ON COLUMN water_daily.goal IS 'Daily goal in the row''s water_unit';
COMMENT ON COLUMN water_daily.goal_ml IS 'Canonical goal in milliliters (for conversions)';
COMMENT ON COLUMN water_daily.goal_floz IS 'Cached goal in fluid ounces (derived from goal_ml)';
COMMENT ON COLUMN water_daily.goal_cup IS 'Cached goal in cups (derived from goal_ml)';

