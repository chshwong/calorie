-- Fix RLS policies for registration
-- This allows users to create their profile during registration

-- STEP 1: Ensure is_active column exists in profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- STEP 2: Drop ALL versions of the function (be aggressive)
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, DATE, TEXT, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, DATE, TEXT, NUMERIC, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_user_profile(UUID, TEXT, DATE, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, BOOLEAN);

-- STEP 3: Create the function with SECURITY DEFINER to bypass RLS
-- This version includes height_unit and weight_unit parameters
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID,
  p_first_name TEXT,
  p_date_of_birth DATE,
  p_gender TEXT,
  p_height_cm NUMERIC,
  p_weight_lb NUMERIC,
  p_height_unit TEXT DEFAULT 'cm',
  p_weight_unit TEXT DEFAULT 'lbs'
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
    is_active
  ) VALUES (
    p_user_id,
    p_first_name,
    p_date_of_birth,
    p_gender,
    p_height_cm,
    p_weight_lb,
    COALESCE(p_height_unit, 'cm'),
    COALESCE(p_weight_unit, 'lbs'),
    true
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
    updated_at = now();
END;
$$;

-- Grant execute permission to authenticated, anon, and service_role users
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile TO anon;
GRANT EXECUTE ON FUNCTION public.create_user_profile TO service_role;

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies (clean slate)
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile inserts during signup" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated users to insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;
DROP POLICY IF EXISTS "read own profile" ON profiles;
DROP POLICY IF EXISTS "insert own profile" ON profiles;
DROP POLICY IF EXISTS "update own profile" ON profiles;
DROP POLICY IF EXISTS "delete own profile" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;

-- Policy: Allow users to read their own profile
CREATE POLICY "Users can read their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Allow users to update their own profile
CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Allow users to delete their own profile
CREATE POLICY "Users can delete their own profile"
ON profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Allow authenticated users to insert profiles (for registration)
-- This is more permissive to handle timing issues during signup
-- The function should handle most cases, but this is a fallback
CREATE POLICY "Allow authenticated users to insert profiles"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Verify the function was created correctly
-- You can run this query to check:
-- SELECT proname, prosecdef, proowner FROM pg_proc WHERE proname = 'create_user_profile';

-- Note: The create_user_profile function uses SECURITY DEFINER which bypasses RLS
-- So it should work even if the user session isn't fully established yet
-- The function runs with the privileges of the function owner (usually postgres)
