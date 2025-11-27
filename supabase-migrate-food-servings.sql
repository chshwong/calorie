-- ============================================================================
-- MIGRATION: food_servings - Add weight_g, volume_ml, and sort_order columns
-- ============================================================================
--
-- Purpose:
-- Transform food_servings to support both weight-based and volume-based foods
-- with explicit weight_g and volume_ml columns instead of the generic 'grams' column.
--
-- Target Schema for food_servings:
--   id                  UUID PRIMARY KEY
--   food_id             UUID REFERENCES food_master(id)
--   serving_name        TEXT (e.g., "1 cup cooked", "1 slice", "1 portion")
--   weight_g            NUMERIC (nullable) - how many grams this serving represents
--   volume_ml           NUMERIC (nullable) - how many mL this serving represents
--   is_default          BOOLEAN DEFAULT false
--   sort_order          INTEGER DEFAULT 0 - for UI ordering
--   created_at          TIMESTAMPTZ
--   updated_at          TIMESTAMPTZ
--
-- Data Model:
-- - For weight-based foods (food_master.serving_unit = 'g'):
--   weight_g stores the serving weight in grams
--   
-- - For volume-based foods (food_master.serving_unit = 'ml'):
--   volume_ml stores the serving volume in milliliters
--
-- This migration is idempotent and safe to run multiple times.
-- ============================================================================

-- Step 1: Add weight_g column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'food_servings' 
        AND column_name = 'weight_g'
    ) THEN
        ALTER TABLE public.food_servings 
        ADD COLUMN weight_g NUMERIC;
        
        RAISE NOTICE 'Added weight_g column to food_servings';
    ELSE
        RAISE NOTICE 'weight_g column already exists';
    END IF;
END $$;

-- Step 2: Add volume_ml column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'food_servings' 
        AND column_name = 'volume_ml'
    ) THEN
        ALTER TABLE public.food_servings 
        ADD COLUMN volume_ml NUMERIC;
        
        RAISE NOTICE 'Added volume_ml column to food_servings';
    ELSE
        RAISE NOTICE 'volume_ml column already exists';
    END IF;
END $$;

-- Step 3: Add sort_order column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'food_servings' 
        AND column_name = 'sort_order'
    ) THEN
        ALTER TABLE public.food_servings 
        ADD COLUMN sort_order INTEGER DEFAULT 0;
        
        RAISE NOTICE 'Added sort_order column to food_servings';
    ELSE
        RAISE NOTICE 'sort_order column already exists';
    END IF;
END $$;

-- Step 4: Migrate data from 'grams' column to weight_g or volume_ml
-- Based on the food_master.serving_unit for each serving's parent food
DO $$
DECLARE
    has_grams_column BOOLEAN;
    rows_migrated INTEGER := 0;
BEGIN
    -- Check if grams column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'food_servings' 
        AND column_name = 'grams'
    ) INTO has_grams_column;
    
    IF has_grams_column THEN
        -- Migrate weight-based foods: grams -> weight_g
        -- A food is weight-based if food_master.serving_unit is 'g', 'kg', 'oz', 'lb'
        UPDATE public.food_servings fs
        SET weight_g = fs.grams
        FROM public.food_master fm
        WHERE fs.food_id = fm.id
        AND fs.grams IS NOT NULL
        AND fs.weight_g IS NULL
        AND LOWER(fm.serving_unit) IN ('g', 'kg', 'oz', 'lb');
        
        GET DIAGNOSTICS rows_migrated = ROW_COUNT;
        RAISE NOTICE 'Migrated % weight-based servings (grams -> weight_g)', rows_migrated;
        
        -- Migrate volume-based foods: grams -> volume_ml
        -- A food is volume-based if food_master.serving_unit is 'ml', 'l', 'cup', 'tbsp', 'tsp', 'floz'
        UPDATE public.food_servings fs
        SET volume_ml = fs.grams
        FROM public.food_master fm
        WHERE fs.food_id = fm.id
        AND fs.grams IS NOT NULL
        AND fs.volume_ml IS NULL
        AND LOWER(fm.serving_unit) IN ('ml', 'l', 'cup', 'tbsp', 'tsp', 'floz');
        
        GET DIAGNOSTICS rows_migrated = ROW_COUNT;
        RAISE NOTICE 'Migrated % volume-based servings (grams -> volume_ml)', rows_migrated;
        
        -- For any remaining servings where we couldn't determine the type,
        -- default to weight_g (safer assumption for most foods)
        UPDATE public.food_servings fs
        SET weight_g = fs.grams
        WHERE fs.grams IS NOT NULL
        AND fs.weight_g IS NULL
        AND fs.volume_ml IS NULL;
        
        GET DIAGNOSTICS rows_migrated = ROW_COUNT;
        IF rows_migrated > 0 THEN
            RAISE NOTICE 'Migrated % remaining servings to weight_g (fallback)', rows_migrated;
        END IF;
    ELSE
        RAISE NOTICE 'grams column does not exist - no migration needed';
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- Run these after the migration to verify data integrity
-- ============================================================================

-- Check migration status
SELECT 
    'Total servings' as metric,
    COUNT(*) as count
FROM public.food_servings
UNION ALL
SELECT 
    'Servings with weight_g' as metric,
    COUNT(*) as count
FROM public.food_servings WHERE weight_g IS NOT NULL
UNION ALL
SELECT 
    'Servings with volume_ml' as metric,
    COUNT(*) as count
FROM public.food_servings WHERE volume_ml IS NOT NULL
UNION ALL
SELECT 
    'Servings with neither (needs review)' as metric,
    COUNT(*) as count
FROM public.food_servings 
WHERE weight_g IS NULL AND volume_ml IS NULL;

-- ============================================================================
-- SUGGESTED INDEXES for performance
-- ============================================================================

-- Index for looking up servings by food_id (most common query)
CREATE INDEX IF NOT EXISTS idx_food_servings_food_id 
ON public.food_servings(food_id);

-- Index for finding default serving quickly
CREATE INDEX IF NOT EXISTS idx_food_servings_food_id_is_default 
ON public.food_servings(food_id, is_default) 
WHERE is_default = true;

-- Index for sorting servings by sort_order
CREATE INDEX IF NOT EXISTS idx_food_servings_food_id_sort_order 
ON public.food_servings(food_id, sort_order);

-- ============================================================================
-- DROP GRAMS COLUMN (after verifying migration)
-- ============================================================================
-- IMPORTANT: Only run this AFTER verifying the migration was successful!
-- Run this verification query first:
--   SELECT COUNT(*) FROM food_servings WHERE grams IS NOT NULL AND weight_g IS NULL AND volume_ml IS NULL;
-- If this returns 0, it's safe to drop the column.

-- Uncomment the following block to drop the grams column:
/*
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'food_servings' 
        AND column_name = 'grams'
    ) THEN
        ALTER TABLE public.food_servings DROP COLUMN grams;
        RAISE NOTICE 'Dropped grams column from food_servings';
    ELSE
        RAISE NOTICE 'grams column already dropped';
    END IF;
END $$;
*/

