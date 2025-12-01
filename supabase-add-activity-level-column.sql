-- Add activity_level column to profiles table for onboarding
-- This column stores the user's activity level: 'sedentary', 'light', 'moderate', 'high', or 'very_high'

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS activity_level TEXT;

-- Add a check constraint to ensure valid activity levels
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS check_valid_activity_level;

ALTER TABLE profiles
ADD CONSTRAINT check_valid_activity_level 
CHECK (activity_level IS NULL OR activity_level IN ('sedentary', 'light', 'moderate', 'high', 'very_high'));

-- Add comment to document the column
COMMENT ON COLUMN profiles.activity_level IS 'User activity level: sedentary (mostly sitting), light (lightly active), moderate (moderately active), high (very active), or very_high (athlete level)';

