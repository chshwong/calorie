-- ============================================================================
-- MIGRATION: Add weight_g and volume_ml columns to food_servings
-- ============================================================================
-- 
-- This migration updates food_servings to cleanly support both weight-based
-- and volume-based foods by storing normalized values in grams and milliliters.
--
-- Changes:
-- 1. Add weight_g NUMERIC (nullable) - serving weight in grams
-- 2. Add volume_ml NUMERIC (nullable) - serving volume in milliliters  
-- 3. Add sort_order INTEGER - for UI ordering of servings
-- 4. Migrate existing 'grams' data to weight_g or volume_ml based on food_master.serving_unit
-- 5. Drop the old 'grams' column
--
-- Safe to run multiple times (idempotent)
-- ============================================================================

-- Step 1: Add new columns (if they don't exist)
-- weight_g stores the serving weight in grams
ALTER TABLE public.food_servings 
ADD COLUMN IF NOT EXISTS weight_g NUMERIC;

-- volume_ml stores the serving volume in milliliters
ALTER TABLE public.food_servings 
ADD COLUMN IF NOT EXISTS volume_ml NUMERIC;

-- sort_order for UI ordering (lower = higher priority)
ALTER TABLE public.food_servings 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Add comments documenting the columns
COMMENT ON COLUMN public.food_servings.weight_g IS 'Weight of this serving in grams. Used for solid/weight-based foods. NULL for volume-only foods.';
COMMENT ON COLUMN public.food_servings.volume_ml IS 'Volume of this serving in milliliters. Used for liquid/volume-based foods. NULL for weight-only foods.';
COMMENT ON COLUMN public.food_servings.sort_order IS 'Sort order for displaying servings in UI. Lower values appear first.';

-- ============================================================================
-- Step 2: Migrate existing 'grams' data to weight_g or volume_ml
-- 
-- The old 'grams' column actually stored "quantity_in_master_unit" - 
-- i.e., how many of food_master.serving_unit are in this serving.
--
-- For weight-based foods (serving_unit in 'g', 'kg', 'oz', 'lb'):
--   Convert the value to grams and store in weight_g
--
-- For volume-based foods (serving_unit in 'ml', 'l', 'cup', 'tbsp', 'tsp', 'floz'):
--   Convert the value to milliliters and store in volume_ml
-- ============================================================================

-- Only run the migration if grams column exists and data hasn't been migrated yet
DO $$
DECLARE
  grams_exists BOOLEAN;
  already_migrated BOOLEAN;
BEGIN
  -- Check if grams column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'food_servings' 
    AND column_name = 'grams'
  ) INTO grams_exists;

  -- Check if we've already migrated (weight_g or volume_ml has data)
  SELECT EXISTS (
    SELECT 1 FROM public.food_servings 
    WHERE weight_g IS NOT NULL OR volume_ml IS NOT NULL
    LIMIT 1
  ) INTO already_migrated;

  IF grams_exists AND NOT already_migrated THEN
    -- Migrate weight-based foods (serving_unit is a weight unit)
    -- The grams column stores quantity in the master unit, so we need to convert to actual grams
    UPDATE public.food_servings fs
    SET weight_g = CASE fm.serving_unit
      WHEN 'g' THEN fs.grams
      WHEN 'kg' THEN fs.grams * 1000
      WHEN 'oz' THEN fs.grams * 28.3495
      WHEN 'lb' THEN fs.grams * 453.592
      ELSE fs.grams  -- For 'g' or unknown, treat as grams
    END
    FROM public.food_master fm
    WHERE fs.food_id = fm.id
    AND LOWER(fm.serving_unit) IN ('g', 'kg', 'oz', 'lb')
    AND fs.grams IS NOT NULL;

    -- Migrate volume-based foods (serving_unit is a volume unit)
    -- The grams column stores quantity in the master unit, so we need to convert to actual ml
    UPDATE public.food_servings fs
    SET volume_ml = CASE LOWER(fm.serving_unit)
      WHEN 'ml' THEN fs.grams
      WHEN 'l' THEN fs.grams * 1000
      WHEN 'cup' THEN fs.grams * 240
      WHEN 'tbsp' THEN fs.grams * 15
      WHEN 'tsp' THEN fs.grams * 5
      WHEN 'floz' THEN fs.grams * 29.5735
      ELSE fs.grams  -- For 'ml' or unknown volume, treat as ml
    END
    FROM public.food_master fm
    WHERE fs.food_id = fm.id
    AND LOWER(fm.serving_unit) IN ('ml', 'l', 'cup', 'tbsp', 'tsp', 'floz')
    AND fs.grams IS NOT NULL;

    -- For foods with non-standard serving_unit (like 'piece', 'serving', etc.)
    -- Store the grams value in weight_g as a fallback
    -- These foods typically use weight for nutrient calculations
    UPDATE public.food_servings fs
    SET weight_g = fs.grams
    FROM public.food_master fm
    WHERE fs.food_id = fm.id
    AND LOWER(fm.serving_unit) NOT IN ('g', 'kg', 'oz', 'lb', 'ml', 'l', 'cup', 'tbsp', 'tsp', 'floz')
    AND fs.grams IS NOT NULL
    AND fs.weight_g IS NULL
    AND fs.volume_ml IS NULL;

    RAISE NOTICE 'Migration complete: grams data migrated to weight_g/volume_ml';
  ELSIF already_migrated THEN
    RAISE NOTICE 'Migration skipped: data already migrated';
  ELSIF NOT grams_exists THEN
    RAISE NOTICE 'Migration skipped: grams column does not exist';
  END IF;
END $$;

-- ============================================================================
-- Step 3: Set sort_order for existing servings
-- Default servings get sort_order = 0, others get incremental values
-- ============================================================================

-- Update sort_order for servings that don't have it set
UPDATE public.food_servings
SET sort_order = CASE WHEN is_default = true THEN 0 ELSE 1 END
WHERE sort_order IS NULL OR sort_order = 0;

-- ============================================================================
-- Step 4: Create indexes for query performance
-- ============================================================================

-- Index for looking up servings by food_id with ordering
CREATE INDEX IF NOT EXISTS idx_food_servings_food_id_sort 
ON public.food_servings(food_id, sort_order);

-- Index for finding default servings quickly
CREATE INDEX IF NOT EXISTS idx_food_servings_default 
ON public.food_servings(food_id, is_default) 
WHERE is_default = true;

-- ============================================================================
-- Step 5: Drop the old grams column (AFTER verifying migration)
-- 
-- IMPORTANT: Only uncomment and run this AFTER verifying the migration worked!
-- You should:
-- 1. Run the migration above
-- 2. Verify data in weight_g and volume_ml is correct
-- 3. Then uncomment and run this section
-- ============================================================================

-- Uncomment the following lines after verifying migration:
-- ALTER TABLE public.food_servings DROP COLUMN IF EXISTS grams;
-- RAISE NOTICE 'Dropped grams column';

-- ============================================================================
-- Verification queries (run these to check the migration)
-- ============================================================================

-- Check column structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'food_servings'
ORDER BY ordinal_position;

-- Check sample of migrated data
SELECT 
  fs.id,
  fs.serving_name,
  fs.grams as old_grams,
  fs.weight_g,
  fs.volume_ml,
  fs.sort_order,
  fs.is_default,
  fm.name as food_name,
  fm.serving_size,
  fm.serving_unit
FROM public.food_servings fs
JOIN public.food_master fm ON fs.food_id = fm.id
LIMIT 20;

-- Check count of migrated servings by type
SELECT 
  CASE 
    WHEN weight_g IS NOT NULL AND volume_ml IS NULL THEN 'weight_only'
    WHEN weight_g IS NULL AND volume_ml IS NOT NULL THEN 'volume_only'
    WHEN weight_g IS NOT NULL AND volume_ml IS NOT NULL THEN 'both'
    ELSE 'neither'
  END as serving_type,
  COUNT(*) as count
FROM public.food_servings
GROUP BY 1;

