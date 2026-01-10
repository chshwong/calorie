-- Migration: Add AI Quick Log columns to calorie_entries table
-- Per engineering guidelines section 3: SQL migrations must be idempotent and documented
-- Run this SQL in your Supabase SQL Editor
--
-- This migration ensures all columns needed for AI Quick Log V1 exist:
-- - AI provenance fields (source, ai_raw_text, ai_confidence)
-- - Nutrient fields parsed from AI (saturated_fat_g, trans_fat_g, total_sugar_g)
-- - Existing fields: sugar_g, sodium_mg (already exist from other migrations, but included for completeness)

-- ============================================================================
-- AI PROVENANCE COLUMNS
-- ============================================================================

-- Entry source: 'manual' = manually entered, 'ai' = AI-assisted Quick Log entry
-- NULL is treated as 'manual' for backward compatibility
ALTER TABLE public.calorie_entries 
ADD COLUMN IF NOT EXISTS source TEXT NULL;

-- Full AI reply text used to parse this entry
-- Truncated client-side to TEXT_LIMITS.AI_RAW_TEXT_MAX_LEN (30000 chars)
ALTER TABLE public.calorie_entries 
ADD COLUMN IF NOT EXISTS ai_raw_text TEXT NULL;

-- AI confidence level from the parsed reply
-- Valid values: 'low', 'med', 'high', or NULL if not provided
ALTER TABLE public.calorie_entries 
ADD COLUMN IF NOT EXISTS ai_confidence TEXT NULL;

-- ============================================================================
-- NUTRIENT COLUMNS (AI-parsed fields)
-- ============================================================================

-- Saturated fat in grams (nullable)
-- Range: 0 to FOOD_ENTRY.MACRO_G.MAX (9999.99) per constants/constraints.ts
ALTER TABLE public.calorie_entries 
ADD COLUMN IF NOT EXISTS saturated_fat_g NUMERIC NULL;

-- Trans fat in grams (nullable)
-- Range: 0 to FOOD_ENTRY.MACRO_G.MAX (9999.99) per constants/constraints.ts
ALTER TABLE public.calorie_entries 
ADD COLUMN IF NOT EXISTS trans_fat_g NUMERIC NULL;

-- Total sugar in grams (nullable)
-- Note: column name is 'sugar_g' (not 'total_sugar_g') for consistency with existing schema
-- Range: 0 to FOOD_ENTRY.MACRO_G.MAX (9999.99) per constants/constraints.ts
ALTER TABLE public.calorie_entries 
ADD COLUMN IF NOT EXISTS sugar_g NUMERIC NULL;

-- Sodium in milligrams (nullable)
-- Range: 0 to RANGES.SODIUM_MG.MAX (30000) per constants/constraints.ts
ALTER TABLE public.calorie_entries 
ADD COLUMN IF NOT EXISTS sodium_mg NUMERIC NULL;

-- ============================================================================
-- COLUMN COMMENTS (Documentation per engineering guidelines)
-- ============================================================================

COMMENT ON COLUMN public.calorie_entries.source IS 
  'Entry source: NULL or ''manual'' = manually entered, ''ai'' = AI-assisted Quick Log entry from AI Quick Log tab';

COMMENT ON COLUMN public.calorie_entries.ai_raw_text IS 
  'Full AI reply text used to parse this entry. Truncated client-side to TEXT_LIMITS.AI_RAW_TEXT_MAX_LEN (30000 chars). NULL for non-AI entries.';

COMMENT ON COLUMN public.calorie_entries.ai_confidence IS 
  'AI confidence level from parsed reply: ''low'' | ''med'' | ''high''. NULL if not provided or for non-AI entries.';

COMMENT ON COLUMN public.calorie_entries.saturated_fat_g IS 
  'Saturated fat in grams. Range: 0-9999.99 (FOOD_ENTRY.MACRO_G.MAX). NULL if not specified.';

COMMENT ON COLUMN public.calorie_entries.trans_fat_g IS 
  'Trans fat in grams. Range: 0-9999.99 (FOOD_ENTRY.MACRO_G.MAX). NULL if not specified.';

COMMENT ON COLUMN public.calorie_entries.sugar_g IS 
  'Total sugar in grams. Range: 0-9999.99 (FOOD_ENTRY.MACRO_G.MAX). NULL if not specified.';

COMMENT ON COLUMN public.calorie_entries.sodium_mg IS 
  'Sodium in milligrams. Range: 0-30000 (RANGES.SODIUM_MG.MAX). NULL if not specified.';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Verify all columns were added with correct data types
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    numeric_precision,
    numeric_scale,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'calorie_entries'
  AND column_name IN (
    'source', 
    'ai_raw_text', 
    'ai_confidence',
    'saturated_fat_g',
    'trans_fat_g',
    'sugar_g',
    'sodium_mg'
  )
ORDER BY column_name;
