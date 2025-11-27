-- Add sugar_g and sodium_mg columns to calorie_entries table
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE calorie_entries 
ADD COLUMN IF NOT EXISTS sugar_g NUMERIC,
ADD COLUMN IF NOT EXISTS sodium_mg NUMERIC;

-- Add comments for documentation
COMMENT ON COLUMN calorie_entries.sugar_g IS 'Sugar content in grams (nullable)';
COMMENT ON COLUMN calorie_entries.sodium_mg IS 'Sodium content in milligrams (nullable)';

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'calorie_entries' 
  AND column_name IN ('sugar_g', 'sodium_mg')
ORDER BY column_name;

