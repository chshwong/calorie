-- Migration: Drop unused water_quick_presets table
-- This table is not used - presets are hard-coded in utils/waterQuickAddPresets.ts

-- Drop RLS policies if they exist
DROP POLICY IF EXISTS "Users can read their own water quick presets" ON public.water_quick_presets;
DROP POLICY IF EXISTS "Users can insert their own water quick presets" ON public.water_quick_presets;
DROP POLICY IF EXISTS "Users can update their own water quick presets" ON public.water_quick_presets;
DROP POLICY IF EXISTS "Users can delete their own water quick presets" ON public.water_quick_presets;

-- Drop the table (this will also drop all constraints, indexes, and triggers)
DROP TABLE IF EXISTS public.water_quick_presets CASCADE;

-- Note: If there are any foreign key constraints from other tables referencing this table,
-- they will be dropped automatically by CASCADE. If you want to be more explicit, you can
-- check for dependencies first:
-- SELECT 
--   tc.table_name, 
--   kcu.column_name, 
--   ccu.table_name AS foreign_table_name,
--   ccu.column_name AS foreign_column_name 
-- FROM information_schema.table_constraints AS tc 
-- JOIN information_schema.key_column_usage AS kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--   ON ccu.constraint_name = tc.constraint_name
-- WHERE constraint_type = 'FOREIGN KEY' 
--   AND ccu.table_name = 'water_quick_presets';

