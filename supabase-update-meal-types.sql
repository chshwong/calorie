-- Step 1: Check the current constraint (for reference)
-- You can run this to see what values are currently allowed:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conname = 'calorie_entries_meal_type_check';

-- Step 2: Drop the existing check constraint FIRST
-- This allows us to update the data without constraint violations
ALTER TABLE calorie_entries 
DROP CONSTRAINT IF EXISTS calorie_entries_meal_type_check;

-- Step 3: Update existing data from 'snack' to 'afternoon_snack'
-- Do this BEFORE adding the new constraint
UPDATE calorie_entries
SET meal_type = 'afternoon_snack'
WHERE meal_type = 'snack';

-- Step 4: Update existing data from 'other' to 'dinner'
-- Do this BEFORE adding the new constraint
UPDATE calorie_entries
SET meal_type = 'dinner'
WHERE meal_type = 'other';

-- Step 5: Now create the new check constraint with updated meal types
-- This is safe now because all data has been updated
ALTER TABLE calorie_entries 
ADD CONSTRAINT calorie_entries_meal_type_check 
CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'afternoon_snack'));

-- Step 6: Verify the updates
-- SELECT meal_type, COUNT(*) 
-- FROM calorie_entries 
-- GROUP BY meal_type 
-- ORDER BY meal_type;

