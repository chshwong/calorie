-- Create a database function to get all user profiles for admin/User 360 page
-- This function uses SECURITY DEFINER to bypass RLS policies
-- It checks that the calling user has is_admin = true before returning profiles

-- Drop the function first if it exists (required when changing return type)
DROP FUNCTION IF EXISTS public.get_all_user_profiles();

CREATE OR REPLACE FUNCTION public.get_all_user_profiles()
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  height_cm NUMERIC,
  weight_lb NUMERIC,
  height_unit TEXT,
  weight_unit TEXT,
  devnote TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID;
  is_user_admin BOOLEAN;
BEGIN
  -- Get the current user's ID
  current_user_id := auth.uid();
  
  -- Check if the current user is an admin
  -- Default to false if profile doesn't exist or is_admin is NULL
  SELECT COALESCE(profiles.is_admin, false) INTO is_user_admin
  FROM profiles
  WHERE profiles.user_id = current_user_id;
  
  -- If no profile found, default to false
  IF is_user_admin IS NULL THEN
    is_user_admin := false;
  END IF;
  
  -- Only return profiles if the user is an admin
  IF is_user_admin = true THEN
    RETURN QUERY
    SELECT 
      profiles.user_id,
      profiles.first_name,
      profiles.date_of_birth,
      profiles.gender,
      profiles.height_cm,
      profiles.weight_lb,
      profiles.height_unit,
      profiles.weight_unit,
      profiles.devnote,
      profiles.created_at,
      profiles.updated_at,
      profiles.is_active
    FROM profiles
    ORDER BY profiles.first_name ASC NULLS LAST, profiles.user_id;
  ELSE
    -- Return empty result if user is not admin
    RETURN;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_all_user_profiles() TO authenticated;

-- Note: This function bypasses RLS because it uses SECURITY DEFINER
-- But it checks is_admin status to ensure only admins can see all profiles
-- Non-admins will get an empty result set

