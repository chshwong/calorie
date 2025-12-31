-- Remove Late Night meal type (late_night)
--
-- What this does:
-- 1) Migrates existing calorie_entries.meal_type late_night -> dinner
-- 2) Migrates calories_entries_mealtype_meta.meal_type late_night -> dinner
--    - If dinner meta already exists for the same (user_id, entry_date), keep dinner and delete late_night to avoid UNIQUE conflicts
-- 3) Replaces the calorie_entries meal_type CHECK constraint to exclude late_night
--
-- IMPORTANT:
-- - Run this in Supabase SQL editor (or your migration runner) during a maintenance window if your table is large.
-- - After running, the app code should no longer send late_night.

BEGIN;

-- 1) calorie_entries: late_night -> dinner
UPDATE calorie_entries
SET meal_type = 'dinner'
WHERE meal_type = 'late_night';

-- 2) calories_entries_mealtype_meta: resolve conflicts, then migrate late_night -> dinner
-- Delete late_night rows that would conflict with existing dinner rows for same user/date
DELETE FROM calories_entries_mealtype_meta ln
USING calories_entries_mealtype_meta d
WHERE ln.user_id = d.user_id
  AND ln.entry_date = d.entry_date
  AND ln.meal_type = 'late_night'
  AND d.meal_type = 'dinner';

-- Rename remaining late_night -> dinner
UPDATE calories_entries_mealtype_meta
SET meal_type = 'dinner',
    updated_at = NOW()
WHERE meal_type = 'late_night';

-- 3) Update constraint on calorie_entries to forbid late_night going forward
ALTER TABLE calorie_entries
DROP CONSTRAINT IF EXISTS calorie_entries_meal_type_check;

ALTER TABLE calorie_entries
ADD CONSTRAINT calorie_entries_meal_type_check
CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'afternoon_snack'));

-- Verification
-- SELECT meal_type, COUNT(*) FROM calorie_entries GROUP BY meal_type ORDER BY meal_type;
-- SELECT meal_type, COUNT(*) FROM calories_entries_mealtype_meta GROUP BY meal_type ORDER BY meal_type;

COMMIT;


