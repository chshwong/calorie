-- Migration: Add custom food support to food_master table
-- This adds is_custom and owner_user_id columns to support user-created custom foods

-- Step 1: Add the new columns
ALTER TABLE food_master
ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE;

-- Step 2: Set default values for existing rows (all existing foods are system/global foods)
UPDATE food_master
SET 
  is_custom = FALSE,
  owner_user_id = NULL
WHERE is_custom IS NULL OR owner_user_id IS NOT NULL;

-- Step 3: Add CHECK constraint to ensure data integrity
-- Rule: If is_custom = TRUE, owner_user_id must be set
--       If is_custom = FALSE, owner_user_id must be NULL
ALTER TABLE food_master
DROP CONSTRAINT IF EXISTS food_master_custom_check;

ALTER TABLE food_master
ADD CONSTRAINT food_master_custom_check 
CHECK (
  (is_custom = TRUE AND owner_user_id IS NOT NULL) OR
  (is_custom = FALSE AND owner_user_id IS NULL)
);

-- Step 4: Create indexes for query performance

-- Index for filtering custom foods by user (most common query)
CREATE INDEX IF NOT EXISTS idx_food_master_owner_custom 
ON food_master(owner_user_id, is_custom) 
WHERE is_custom = TRUE;

-- Index for system foods (for search performance)
CREATE INDEX IF NOT EXISTS idx_food_master_system 
ON food_master(is_custom) 
WHERE is_custom = FALSE;

-- Step 5: Add comment to document the columns
COMMENT ON COLUMN food_master.is_custom IS 'TRUE for user-created custom foods, FALSE for system/global foods';
COMMENT ON COLUMN food_master.owner_user_id IS 'User ID who owns this custom food. NULL for system/global foods.';

-- Step 6: Update RLS policies (if RLS is enabled)
-- Note: Adjust these policies based on your existing RLS setup

-- Policy: Users can read system foods OR their own custom foods
DROP POLICY IF EXISTS "Users can read food_master" ON food_master;

CREATE POLICY "Users can read food_master"
ON food_master
FOR SELECT
TO authenticated
USING (
  (is_custom = FALSE) OR
  (is_custom = TRUE AND owner_user_id = auth.uid())
);

-- Policy: Users can insert their own custom foods
DROP POLICY IF EXISTS "Users can insert custom foods" ON food_master;

CREATE POLICY "Users can insert custom foods"
ON food_master
FOR INSERT
TO authenticated
WITH CHECK (
  is_custom = TRUE AND 
  owner_user_id = auth.uid()
);

-- Policy: Users can update their own custom foods
DROP POLICY IF EXISTS "Users can update custom foods" ON food_master;

CREATE POLICY "Users can update custom foods"
ON food_master
FOR UPDATE
TO authenticated
USING (
  is_custom = TRUE AND 
  owner_user_id = auth.uid()
)
WITH CHECK (
  is_custom = TRUE AND 
  owner_user_id = auth.uid()
);

-- Policy: Users can delete their own custom foods
DROP POLICY IF EXISTS "Users can delete custom foods" ON food_master;

CREATE POLICY "Users can delete custom foods"
ON food_master
FOR DELETE
TO authenticated
USING (
  is_custom = TRUE AND 
  owner_user_id = auth.uid()
);

-- Note: System foods (is_custom = FALSE) should only be modifiable by admins
-- If you have admin users, add additional policies for them

