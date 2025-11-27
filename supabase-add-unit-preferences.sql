-- Add height_unit and weight_unit columns to profiles table
-- These store user preferences for displaying height and weight

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS height_unit TEXT DEFAULT 'cm' CHECK (height_unit IN ('cm', 'ft')),
ADD COLUMN IF NOT EXISTS weight_unit TEXT DEFAULT 'lbs' CHECK (weight_unit IN ('lbs', 'kg'));

-- Add comments for documentation
COMMENT ON COLUMN profiles.height_unit IS 'User preference for height display unit: cm or ft (feet/inches)';
COMMENT ON COLUMN profiles.weight_unit IS 'User preference for weight display unit: lbs or kg';

