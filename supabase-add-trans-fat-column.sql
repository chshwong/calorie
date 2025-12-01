-- Migration: Add trans_fat_100g column to external_food_cache
-- This column stores trans fat in grams per 100g/ml, matching the pattern of other nutrient columns

ALTER TABLE public.external_food_cache
ADD COLUMN IF NOT EXISTS trans_fat_100g numeric NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.external_food_cache.trans_fat_100g IS 
  'Trans fat in grams per 100g/ml of product. NULL if not available from source.';

