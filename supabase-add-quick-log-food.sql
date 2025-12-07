-- Add quick_log_food column to calories_entries_mealtype_meta table
-- This column stores an optional food name/label for Quick Log entries (max 20 characters)

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_log_food'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        ADD COLUMN quick_log_food text NULL;
    END IF;
END $$;

