-- Remove Quick Log related columns from calories_entries_mealtype_meta table
-- This migration removes all Quick Log functionality from the database

DO $$ 
BEGIN
    -- Drop quick_kcal column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_kcal'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        DROP COLUMN quick_kcal;
    END IF;

    -- Drop quick_protein_g column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_protein_g'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        DROP COLUMN quick_protein_g;
    END IF;

    -- Drop quick_carbs_g column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_carbs_g'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        DROP COLUMN quick_carbs_g;
    END IF;

    -- Drop quick_fat_g column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_fat_g'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        DROP COLUMN quick_fat_g;
    END IF;

    -- Drop quick_fiber_g column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_fiber_g'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        DROP COLUMN quick_fiber_g;
    END IF;

    -- Drop quick_saturated_fat_g column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_saturated_fat_g'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        DROP COLUMN quick_saturated_fat_g;
    END IF;

    -- Drop quick_trans_fat_g column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_trans_fat_g'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        DROP COLUMN quick_trans_fat_g;
    END IF;

    -- Drop quick_sugar_g column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_sugar_g'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        DROP COLUMN quick_sugar_g;
    END IF;

    -- Drop quick_sodium_mg column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_sodium_mg'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        DROP COLUMN quick_sodium_mg;
    END IF;

    -- Drop quick_log_food column if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'calories_entries_mealtype_meta' 
        AND column_name = 'quick_log_food'
    ) THEN
        ALTER TABLE public.calories_entries_mealtype_meta 
        DROP COLUMN quick_log_food;
    END IF;
END $$;

-- Verify the columns were removed
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calories_entries_mealtype_meta' 
  AND column_name LIKE 'quick%'
ORDER BY column_name;

