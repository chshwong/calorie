-- Add onboarding_complete column to profiles table
-- This tracks whether a user (especially OAuth users) has completed the onboarding flow

-- STEP 1: Add the onboarding_complete column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'onboarding_complete'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN onboarding_complete BOOLEAN DEFAULT false;
    
    -- Set existing profiles (who already have required fields) to onboarding_complete = true
    UPDATE public.profiles 
    SET onboarding_complete = true 
    WHERE first_name IS NOT NULL 
      AND date_of_birth IS NOT NULL 
      AND gender IS NOT NULL 
      AND height_cm IS NOT NULL 
      AND weight_lb IS NOT NULL;
  END IF;
END $$;

-- STEP 2: Drop existing function versions
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, DATE, TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, DATE, TEXT, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, DATE, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, BOOLEAN);

-- STEP 3: Create updated function with onboarding_complete parameter
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID,
  p_first_name TEXT,
  p_date_of_birth DATE,
  p_gender TEXT,
  p_height_cm NUMERIC,
  p_weight_lb NUMERIC,
  p_height_unit TEXT DEFAULT 'cm',
  p_weight_unit TEXT DEFAULT 'lbs',
  p_onboarding_complete BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (
    user_id,
    first_name,
    date_of_birth,
    gender,
    height_cm,
    weight_lb,
    height_unit,
    weight_unit,
    is_active,
    onboarding_complete
  ) VALUES (
    p_user_id,
    p_first_name,
    p_date_of_birth,
    p_gender,
    p_height_cm,
    p_weight_lb,
    COALESCE(p_height_unit, 'cm'),
    COALESCE(p_weight_unit, 'lbs'),
    true,
    COALESCE(p_onboarding_complete, true)
  )
  ON CONFLICT (user_id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    date_of_birth = EXCLUDED.date_of_birth,
    gender = EXCLUDED.gender,
    height_cm = EXCLUDED.height_cm,
    weight_lb = EXCLUDED.weight_lb,
    height_unit = EXCLUDED.height_unit,
    weight_unit = EXCLUDED.weight_unit,
    is_active = COALESCE(EXCLUDED.is_active, true),
    onboarding_complete = EXCLUDED.onboarding_complete,
    updated_at = now();
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile TO anon;
GRANT EXECUTE ON FUNCTION public.create_user_profile TO service_role;

-- Verify the column was added
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'onboarding_complete';

