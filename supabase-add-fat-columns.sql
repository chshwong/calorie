-- Add fat detail columns to calorie_entries table
-- Run this SQL in your Supabase SQL Editor

ALTER TABLE calorie_entries 
ADD COLUMN IF NOT EXISTS trans_fat_g NUMERIC,
ADD COLUMN IF NOT EXISTS saturated_fat_g NUMERIC,
ADD COLUMN IF NOT EXISTS unsaturated_fat_g NUMERIC;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'calorie_entries' 
  AND column_name IN ('trans_fat_g', 'saturated_fat_g', 'unsaturated_fat_g')
ORDER BY column_name;

