-- Meds Screen Refactor: Remove 'other' type and add user preferences
-- 
-- 1. Add med_prefs JSONB column to profiles table
-- 2. Update med_log constraint to remove 'other' type
-- 3. Convert existing 'other' rows to 'med'

-- Step 1: Add med_prefs column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS med_prefs jsonb DEFAULT '{}'::jsonb;

-- Step 2: Convert existing 'other' type rows to 'med' (safer than deleting)
UPDATE public.med_log
SET type = 'med'
WHERE type = 'other';

-- Step 3: Drop the old constraint
ALTER TABLE public.med_log
DROP CONSTRAINT IF EXISTS med_log_type_valid;

-- Step 4: Add new constraint without 'other'
ALTER TABLE public.med_log
ADD CONSTRAINT med_log_type_valid CHECK (type IN ('med','supp'));

-- Note: The constraint change will prevent any new 'other' inserts going forward.
-- Legacy 'other' rows have been converted to 'med' above.



