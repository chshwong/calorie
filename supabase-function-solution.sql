-- SOLUTION: Use a database function with SECURITY DEFINER to bypass RLS
-- This function runs with elevated privileges and can insert profiles

-- Create a function that inserts the profile
CREATE OR REPLACE FUNCTION public.create_user_profile(
  p_user_id UUID,
  p_first_name TEXT,
  p_date_of_birth DATE,
  p_gender TEXT,
  p_height_cm NUMERIC,
  p_weight_lb NUMERIC
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
    is_active
  ) VALUES (
    p_user_id,
    p_first_name,
    p_date_of_birth,
    p_gender,
    p_height_cm,
    p_weight_lb,
    true
  )
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_user_profile TO authenticated;

-- Now set up RLS properly
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;

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

-- Note: We don't need an INSERT policy because we're using the function

