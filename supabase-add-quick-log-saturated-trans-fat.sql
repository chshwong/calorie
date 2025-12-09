-- Migration: Add saturated fat and trans fat columns to calories_entries_mealtype_meta table
-- This adds quick_saturated_fat_g and quick_trans_fat_g columns to support Quick Log tracking of these nutrients

-- Add new columns if they don't exist (for existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_saturated_fat_g'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        ADD COLUMN quick_saturated_fat_g numeric NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_trans_fat_g'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        ADD COLUMN quick_trans_fat_g numeric NULL;
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'calories_entries_mealtype_meta' 
  AND column_name IN ('quick_saturated_fat_g', 'quick_trans_fat_g')
ORDER BY column_name;

