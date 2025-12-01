-- Add goal_type column to profiles table for onboarding
-- This column stores the user's fitness goal: 'lose', 'maintain', 'gain', or 'recomp'

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS goal_type TEXT;

-- Add a check constraint to ensure valid goal types
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS check_valid_goal_type;

ALTER TABLE profiles
ADD CONSTRAINT check_valid_goal_type 
CHECK (goal_type IS NULL OR goal_type IN ('lose', 'maintain', 'gain', 'recomp'));

-- Add comment to document the column
COMMENT ON COLUMN profiles.goal_type IS 'User fitness goal: lose (lose weight), maintain (maintain weight), gain (gain weight), or recomp (body recomposition)';

