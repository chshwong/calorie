-- Admin functions to fetch user data for admin users
-- These functions bypass RLS using SECURITY DEFINER

-- Function to get calorie_entries for a specific user (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_user_calorie_entries(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  entry_date DATE,
  eaten_at TIMESTAMPTZ,
  meal_type TEXT,
  item_name TEXT,
  quantity NUMERIC,
  unit TEXT,
  calories_kcal NUMERIC,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  fiber_g NUMERIC,
  saturated_fat_g NUMERIC,
  sugar_g NUMERIC,
  sodium_mg NUMERIC,
  notes TEXT,
  food_id UUID,
  serving_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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
  SELECT COALESCE(profiles.is_admin, false) INTO is_user_admin
  FROM profiles
  WHERE profiles.user_id = current_user_id;
  
  -- If no profile found, default to false
  IF is_user_admin IS NULL THEN
    is_user_admin := false;
  END IF;
  
  -- Only return data if the user is an admin
  IF is_user_admin = true THEN
    RETURN QUERY
    SELECT 
      calorie_entries.id,
      calorie_entries.user_id,
      calorie_entries.entry_date,
      calorie_entries.eaten_at,
      calorie_entries.meal_type,
      calorie_entries.item_name,
      calorie_entries.quantity,
      calorie_entries.unit,
      calorie_entries.calories_kcal,
      calorie_entries.protein_g,
      calorie_entries.carbs_g,
      calorie_entries.fat_g,
      calorie_entries.fiber_g,
      calorie_entries.saturated_fat_g,
      calorie_entries.sugar_g,
      calorie_entries.sodium_mg,
      calorie_entries.notes,
      calorie_entries.food_id,
      calorie_entries.serving_id,
      calorie_entries.created_at,
      calorie_entries.updated_at
    FROM calorie_entries
    WHERE calorie_entries.user_id = p_user_id
    ORDER BY calorie_entries.entry_date DESC, calorie_entries.created_at DESC;
  ELSE
    -- Return empty result if user is not admin
    RETURN;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_get_user_calorie_entries(UUID) TO authenticated;

-- Function to get custom foods for a specific user (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_user_custom_foods(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  brand TEXT,
  serving_size NUMERIC,
  serving_unit TEXT,
  calories_kcal NUMERIC,
  protein_g NUMERIC,
  carbs_g NUMERIC,
  fat_g NUMERIC,
  fiber_g NUMERIC,
  saturated_fat_g NUMERIC,
  sugar_g NUMERIC,
  sodium_mg NUMERIC,
  owner_user_id UUID,
  order_index INTEGER,
  is_custom BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
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
  SELECT COALESCE(profiles.is_admin, false) INTO is_user_admin
  FROM profiles
  WHERE profiles.user_id = current_user_id;
  
  -- If no profile found, default to false
  IF is_user_admin IS NULL THEN
    is_user_admin := false;
  END IF;
  
  -- Only return data if the user is an admin
  IF is_user_admin = true THEN
    RETURN QUERY
    SELECT 
      food_master.id,
      food_master.name,
      food_master.brand,
      food_master.serving_size,
      food_master.serving_unit,
      food_master.calories_kcal,
      food_master.protein_g,
      food_master.carbs_g,
      food_master.fat_g,
      food_master.fiber_g,
      food_master.saturated_fat_g,
      food_master.sugar_g,
      food_master.sodium_mg,
      food_master.owner_user_id,
      food_master.order_index,
      food_master.is_custom,
      food_master.created_at,
      food_master.updated_at
    FROM food_master
    WHERE food_master.owner_user_id = p_user_id
      AND food_master.is_custom = true
    ORDER BY food_master.name ASC;
  ELSE
    -- Return empty result if user is not admin
    RETURN;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_get_user_custom_foods(UUID) TO authenticated;

-- Function to get bundles for a specific user (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_user_bundles(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  order_index INTEGER
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
  SELECT COALESCE(profiles.is_admin, false) INTO is_user_admin
  FROM profiles
  WHERE profiles.user_id = current_user_id;
  
  -- If no profile found, default to false
  IF is_user_admin IS NULL THEN
    is_user_admin := false;
  END IF;
  
  -- Only return data if the user is an admin
  IF is_user_admin = true THEN
    RETURN QUERY
    SELECT 
      bundles.id,
      bundles.user_id,
      bundles.name,
      bundles.created_at,
      bundles.updated_at,
      NULL::INTEGER as order_index  -- Return NULL since column doesn't exist in bundles table
    FROM bundles
    WHERE bundles.user_id = p_user_id
    ORDER BY bundles.created_at DESC;
  ELSE
    -- Return empty result if user is not admin
    RETURN;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_get_user_bundles(UUID) TO authenticated;

-- Function to get bundle_items for given bundle IDs (admin only)
CREATE OR REPLACE FUNCTION public.admin_get_bundle_items(p_bundle_ids UUID[])
RETURNS TABLE (
  id UUID,
  bundle_id UUID,
  food_id UUID,
  item_name TEXT,
  serving_id UUID,
  quantity NUMERIC,
  unit TEXT,
  order_index INTEGER
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
  SELECT COALESCE(profiles.is_admin, false) INTO is_user_admin
  FROM profiles
  WHERE profiles.user_id = current_user_id;
  
  -- If no profile found, default to false
  IF is_user_admin IS NULL THEN
    is_user_admin := false;
  END IF;
  
  -- Only return data if the user is an admin
  IF is_user_admin = true THEN
    RETURN QUERY
    SELECT 
      bundle_items.id,
      bundle_items.bundle_id,
      bundle_items.food_id,
      bundle_items.item_name,
      bundle_items.serving_id,
      bundle_items.quantity,
      bundle_items.unit,
      bundle_items.order_index
    FROM bundle_items
    WHERE bundle_items.bundle_id = ANY(p_bundle_ids)
    ORDER BY bundle_items.order_index ASC;
  ELSE
    -- Return empty result if user is not admin
    RETURN;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_get_bundle_items(UUID[]) TO authenticated;

-- Function to get a single user profile by user_id (admin only)
-- Drop the function first if it exists (required when changing return type)
DROP FUNCTION IF EXISTS public.admin_get_user_profile(UUID);

CREATE OR REPLACE FUNCTION public.admin_get_user_profile(p_user_id UUID)
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
  is_admin BOOLEAN,
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
  current_user_id := auth.uid();
  
  SELECT COALESCE(profiles.is_admin, false) INTO is_user_admin
  FROM profiles
  WHERE profiles.user_id = current_user_id;
  
  IF is_user_admin IS NULL THEN
    is_user_admin := false;
  END IF;
  
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
      profiles.is_admin,
      profiles.is_active
    FROM profiles
    WHERE profiles.user_id = p_user_id
    LIMIT 1;
  ELSE
    RETURN;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.admin_get_user_profile(UUID) TO authenticated;

