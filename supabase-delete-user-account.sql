-- Function to delete all user account data
-- This function deletes all records associated with a user ID in the correct order
-- to respect foreign key constraints
-- Security: Users can only delete their own account (p_user_id must match auth.uid())

CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security check: Users can only delete their own account
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to delete account';
  END IF;
  
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Users can only delete their own account';
  END IF;
  
  -- Delete in order to respect foreign key constraints:
  
  -- 1. Delete calorie entries (if they reference user_id directly)
  DELETE FROM calorie_entries WHERE user_id = p_user_id;
  
  -- 2. Delete bundles (this will cascade to bundle_items due to ON DELETE CASCADE)
  DELETE FROM bundles WHERE user_id = p_user_id;
  
  -- 3. Delete custom foods owned by the user (this has ON DELETE CASCADE from profiles, but we'll delete explicitly)
  DELETE FROM food_master WHERE owner_user_id = p_user_id;
  
  -- 4. Finally, delete the profile (this should be last as other tables may reference it)
  DELETE FROM profiles WHERE user_id = p_user_id;
  
  -- Note: The auth.users record should be deleted separately via Supabase Admin API
  -- or through the Supabase dashboard, as it requires admin privileges
  -- However, deleting the profile and all related data effectively removes the user's presence
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.delete_user_account(UUID) IS 'Deletes all user account data including calorie entries, bundles, custom foods, and profile. Requires the user to be authenticated and can only delete their own data.';

