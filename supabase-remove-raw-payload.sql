-- Migration: Remove raw_payload column from external_food_cache table
-- This column was storing the full JSON response from OpenFoodFacts API
-- but was never actually used in the application logic.
-- 
-- Note: This migration is idempotent - safe to run multiple times.
-- If the column doesn't exist, it will simply do nothing.

-- Drop the raw_payload column (if it exists)
ALTER TABLE external_food_cache 
DROP COLUMN IF EXISTS raw_payload;

