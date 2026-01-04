-- Add distance_unit preference to user_config (profiles table)
-- This allows users to choose between km and mi for distance display
-- Storage is always in km (canonical), display converts based on preference

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS distance_unit text NULL DEFAULT 'km';

-- Update existing rows to default 'km' if null
UPDATE public.profiles
SET distance_unit = 'km'
WHERE distance_unit IS NULL;

-- Add constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_distance_unit_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_distance_unit_check
      CHECK (distance_unit IS NULL OR distance_unit IN ('km', 'mi'));
  END IF;
END $$;

