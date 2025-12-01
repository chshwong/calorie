-- Add all missing columns for the new onboarding flow
-- This includes activity_level, weight_kg, goal_weight_kg, goal_weight_lb, daily_calorie_target, goal_target_date, and goal_timeframe

-- Add activity_level column
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS activity_level TEXT;

-- Add weight_kg column (for storing current weight in kg)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS weight_kg NUMERIC;

-- Add goal_weight_kg column (for storing goal weight in kg)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS goal_weight_kg NUMERIC;

-- Add goal_weight_lb column (for storing goal weight in lbs)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS goal_weight_lb NUMERIC;

-- Add daily_calorie_target column (calculated target calories)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS daily_calorie_target INTEGER;

-- Add goal_target_date column (target date for reaching goal)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS goal_target_date DATE;

-- Add goal_timeframe column (timeline option: '3_months', '6_months', '12_months', 'no_deadline', 'custom_date')
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS goal_timeframe TEXT;

-- Add check constraint for activity_level
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS check_valid_activity_level;

ALTER TABLE profiles
ADD CONSTRAINT check_valid_activity_level 
CHECK (activity_level IS NULL OR activity_level IN ('sedentary', 'light', 'moderate', 'high', 'very_high'));

-- Add check constraint for goal_timeframe
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS check_valid_goal_timeframe;

ALTER TABLE profiles
ADD CONSTRAINT check_valid_goal_timeframe 
CHECK (goal_timeframe IS NULL OR goal_timeframe IN ('3_months', '6_months', '12_months', 'no_deadline', 'custom_date'));

-- Add comments to document the columns
COMMENT ON COLUMN profiles.activity_level IS 'User activity level: sedentary (mostly sitting), light (lightly active), moderate (moderately active), high (very active), or very_high (athlete level)';
COMMENT ON COLUMN profiles.weight_kg IS 'Current weight in kilograms';
COMMENT ON COLUMN profiles.goal_weight_kg IS 'Goal weight in kilograms';
COMMENT ON COLUMN profiles.goal_weight_lb IS 'Goal weight in pounds';
COMMENT ON COLUMN profiles.daily_calorie_target IS 'Calculated daily calorie target based on BMR, TDEE, and goal';
COMMENT ON COLUMN profiles.goal_target_date IS 'Target date for reaching goal weight (for custom timeline)';
COMMENT ON COLUMN profiles.goal_timeframe IS 'Timeline option: 3_months, 6_months, 12_months, no_deadline, or custom_date';

