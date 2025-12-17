-- Migration: Prevent duplicate custom foods per user per barcode
-- 
-- This migration:
-- 1. Identifies duplicate custom foods (same owner_user_id + barcode)
-- 2. Keeps the oldest one (by created_at or id) and deletes the rest
-- 3. Creates a unique index to prevent future duplicates
--
-- The index only applies to custom foods (is_custom = true) and only when
-- barcode is not null and not empty.

-- Step 1: Identify and remove duplicate custom foods
-- Keep the oldest entry (by id, which is typically created first)
-- and delete all other duplicates for the same (owner_user_id, barcode) pair

DO $$
DECLARE
  duplicate_record RECORD;
  keep_id UUID;
BEGIN
  -- Find all duplicate custom foods grouped by owner_user_id and barcode
  FOR duplicate_record IN
    SELECT 
      owner_user_id,
      barcode,
      COUNT(*) as duplicate_count
    FROM food_master
    WHERE is_custom = true
      AND barcode IS NOT NULL
      AND barcode <> ''
    GROUP BY owner_user_id, barcode
    HAVING COUNT(*) > 1
  LOOP
    -- For each duplicate group, find the ID to keep (oldest by id)
    SELECT id INTO keep_id
    FROM food_master
    WHERE owner_user_id = duplicate_record.owner_user_id
      AND barcode = duplicate_record.barcode
      AND is_custom = true
    ORDER BY id ASC  -- Keep the oldest (lowest UUID, typically created first)
    LIMIT 1;
    
    -- Delete all other duplicates for this (owner_user_id, barcode) pair
    DELETE FROM food_master
    WHERE owner_user_id = duplicate_record.owner_user_id
      AND barcode = duplicate_record.barcode
      AND is_custom = true
      AND id != keep_id;
    
    RAISE NOTICE 'Removed % duplicate(s) for user % and barcode %, kept id %', 
      duplicate_record.duplicate_count - 1,
      duplicate_record.owner_user_id,
      duplicate_record.barcode,
      keep_id;
  END LOOP;
END $$;

-- Step 2: Create the unique index to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS ux_food_master_owner_barcode_custom
ON public.food_master (owner_user_id, barcode)
WHERE is_custom = true 
  AND barcode IS NOT NULL 
  AND barcode <> '';

-- Note: This index will prevent duplicate custom foods even under race conditions.
-- If an insert fails due to this constraint, the application code should handle
-- it gracefully by looking up the existing custom food and using that instead.

