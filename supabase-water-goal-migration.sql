-- Migration: Add water_goal_ml to profiles table
-- This stores the user's current default water goal
-- Individual days' goals are stored in water_daily.goal_ml as snapshots

-- Add water_goal_ml column to profiles if it doesn't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS water_goal_ml INTEGER DEFAULT 2000;

-- Add constraint to ensure goal is within reasonable bounds (480-5000ml)
ALTER TABLE profiles
ADD CONSTRAINT IF NOT EXISTS water_goal_ml_range 
CHECK (water_goal_ml IS NULL OR (water_goal_ml >= 480 AND water_goal_ml <= 5000));

-- Add comment
COMMENT ON COLUMN profiles.water_goal_ml IS 'Current default daily water goal in ml. This is copied to water_daily.goal_ml when creating new days. Individual days keep their snapshot goal_ml for historical accuracy.';

-- Update existing profiles that don't have a water_goal_ml set
-- Use 2000ml as default (or migrate from default_water_goal_ml if that column exists)
UPDATE profiles
SET water_goal_ml = 2000
WHERE water_goal_ml IS NULL;

