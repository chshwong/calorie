-- Migration: Remove is_public column references from food_master table
-- This removes all references to is_public from indexes, RLS policies, and functions
-- Run this in your Supabase SQL Editor

-- Step 1: Drop indexes that reference is_public
DROP INDEX IF EXISTS idx_food_master_public;
DROP INDEX IF EXISTS idx_food_master_user_custom_public;

-- Step 2: Create new index for system foods (without is_public)
CREATE INDEX IF NOT EXISTS idx_food_master_system 
ON food_master(is_custom) 
WHERE is_custom = FALSE;

-- Step 3: Update RLS policy to remove is_public check
DROP POLICY IF EXISTS "Users can read food_master" ON food_master;

CREATE POLICY "Users can read food_master"
ON food_master
FOR SELECT
TO authenticated
USING (
  (is_custom = FALSE) OR
  (is_custom = TRUE AND owner_user_id = auth.uid())
);

-- Step 4: Update get_frequent_foods function to remove is_public
CREATE OR REPLACE FUNCTION public.get_frequent_foods(
  p_user_id UUID,
  p_months_back INTEGER DEFAULT 14,
  p_limit_count INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  brand TEXT,
  serving_size NUMERIC,
  serving_unit TEXT,
  calories_kcal NUMERIC,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  fiber_g NUMERIC,
  saturated_fat_g NUMERIC,
  unsaturated_fat_g NUMERIC,
  trans_fat_g NUMERIC,
  source TEXT,
  is_custom BOOLEAN,
  owner_user_id UUID,
  log_count BIGINT,
  last_logged_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH recent_entries AS (
    -- Get entries from last N months with food_id
    SELECT 
      food_id,
      COUNT(*) as entry_count,
      MAX(created_at) as most_recent
    FROM calorie_entries
    WHERE user_id = p_user_id
      AND food_id IS NOT NULL
      AND created_at >= NOW() - (p_months_back || ' months')::INTERVAL
    GROUP BY food_id
  ),
  ranked_foods AS (
    -- Join with food_master and rank by frequency
    -- Includes all foods: both custom (is_custom = true) and database foods (is_custom = false)
    SELECT 
      fm.*,
      re.entry_count as log_count,
      re.most_recent as last_logged_at,
      ROW_NUMBER() OVER (
        ORDER BY re.entry_count DESC, re.most_recent DESC
      ) as rank
    FROM recent_entries re
    INNER JOIN food_master fm ON fm.id = re.food_id
    -- No WHERE clause filtering by is_custom - includes all foods
  )
  SELECT 
    rf.id,
    rf.name,
    rf.brand,
    rf.serving_size,
    rf.serving_unit,
    rf.calories_kcal,
    rf.protein_g,
    rf.carbs_g,
    rf.fat_g,
    rf.fiber_g,
    rf.saturated_fat_g,
    rf.unsaturated_fat_g,
    rf.trans_fat_g,
    rf.source,
    rf.is_custom,
    rf.owner_user_id,
    rf.log_count,
    rf.last_logged_at
  FROM ranked_foods rf
  WHERE rf.rank <= p_limit_count
  ORDER BY rf.log_count DESC, rf.last_logged_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_frequent_foods TO authenticated;

-- Step 5: (OPTIONAL) Drop the is_public column entirely
-- Uncomment the following lines if you want to completely remove the column from the table
-- WARNING: This will permanently delete the column and all its data
-- Make sure you have a backup before running this!

-- ALTER TABLE food_master DROP COLUMN IF EXISTS is_public;

-- Verification queries (run these to check the changes)
-- Check if indexes were updated correctly
SELECT 
  indexname, 
  indexdef 
FROM pg_indexes 
WHERE tablename = 'food_master' 
  AND schemaname = 'public'
ORDER BY indexname;

-- Check RLS policies
SELECT 
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'food_master' 
  AND schemaname = 'public';

-- Check function signature
SELECT 
  routine_name,
  routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public' 
  AND routine_name = 'get_frequent_foods';










