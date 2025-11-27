-- Migration: Create external_food_cache table for OpenFoodFacts integration
-- This table caches products fetched from external sources (primarily OpenFoodFacts)
-- All nutrition values are per 100g/ml to align with OpenFoodFacts standards

-- ============================================================================
-- Table: external_food_cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS external_food_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Barcode identification
  barcode text NOT NULL,                    -- Normalized 13-digit EAN-13 string
  source text NOT NULL DEFAULT 'openfoodfacts',  -- Source identifier
  source_food_id text,                      -- Original ID from source (e.g., OFF "code")
  
  -- Product info
  product_name text,
  brand text,
  
  -- Nutrition per 100g/ml (matching OpenFoodFacts naming convention)
  energy_kcal_100g numeric,                 -- kcal per 100g/ml
  protein_100g numeric,                     -- protein (g) per 100g/ml
  carbs_100g numeric,                       -- carbohydrates (g) per 100g/ml
  fat_100g numeric,                         -- fat (g) per 100g/ml
  saturated_fat_100g numeric,               -- saturated fat (g) per 100g/ml
  sugars_100g numeric,                      -- sugars (g) per 100g/ml
  fiber_100g numeric,                       -- fiber (g) per 100g/ml
  sodium_100g numeric,                      -- sodium (g) per 100g/ml (note: OFF uses g, not mg)
  
  -- Serving info
  serving_size text,                        -- Raw serving text from OFF, e.g., "250 ml"
  
  -- Full payload for reference
  raw_payload jsonb,                        -- Full original JSON from OpenFoodFacts
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  last_fetched_at timestamptz,              -- Last time we called OFF for this barcode
  
  -- Usage tracking
  times_scanned integer DEFAULT 1,
  
  -- Promotion to canonical food
  promoted_food_master_id uuid REFERENCES food_master(id) ON DELETE SET NULL
);

-- ============================================================================
-- Indexes
-- ============================================================================

-- Unique constraint: one row per barcode + source combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_food_cache_barcode_source 
  ON external_food_cache(barcode, source);

-- Index for barcode lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_external_food_cache_barcode 
  ON external_food_cache(barcode);

-- Index for finding promoted items
CREATE INDEX IF NOT EXISTS idx_external_food_cache_promoted 
  ON external_food_cache(promoted_food_master_id) 
  WHERE promoted_food_master_id IS NOT NULL;

-- ============================================================================
-- Trigger: Auto-update updated_at on row changes
-- ============================================================================

-- Create trigger function if not exists (may already exist from other tables)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing trigger if present (for idempotency)
DROP TRIGGER IF EXISTS update_external_food_cache_updated_at ON external_food_cache;

-- Create the trigger
CREATE TRIGGER update_external_food_cache_updated_at
  BEFORE UPDATE ON external_food_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE external_food_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read cached external foods (they're public data from OFF)
CREATE POLICY "external_food_cache_select_all" ON external_food_cache
  FOR SELECT
  USING (true);

-- Policy: Only authenticated users can insert/update (when scanning)
CREATE POLICY "external_food_cache_insert_authenticated" ON external_food_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "external_food_cache_update_authenticated" ON external_food_cache
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE external_food_cache IS 
  'Cache for products fetched from external sources like OpenFoodFacts. All nutrition values are per 100g/ml.';

COMMENT ON COLUMN external_food_cache.barcode IS 
  'Normalized 13-digit EAN-13 barcode string. UPC-A (12-digit) codes are prefixed with 0.';

COMMENT ON COLUMN external_food_cache.source IS 
  'Source identifier, e.g., "openfoodfacts". Allows for future integration with other databases.';

COMMENT ON COLUMN external_food_cache.energy_kcal_100g IS 
  'Energy in kcal per 100g/ml of product.';

COMMENT ON COLUMN external_food_cache.sodium_100g IS 
  'Sodium in grams per 100g/ml (OpenFoodFacts uses grams, not milligrams).';

COMMENT ON COLUMN external_food_cache.raw_payload IS 
  'Full JSON response from the external API for debugging and future field extraction.';

COMMENT ON COLUMN external_food_cache.promoted_food_master_id IS 
  'If this external food was promoted to a canonical food_master entry, this references that row.';

-- ============================================================================
-- Verify food_master.barcode is TEXT type
-- ============================================================================

-- This should already be TEXT, but let's ensure it explicitly
-- Note: Only run this if barcode column exists and needs type change
-- ALTER TABLE food_master ALTER COLUMN barcode TYPE text;

-- Add comment to food_master.barcode for clarity
COMMENT ON COLUMN food_master.barcode IS 
  'Optional normalized 13-digit EAN-13 barcode. Used for canonical/curated branded products. Takes precedence over external_food_cache lookups.';

