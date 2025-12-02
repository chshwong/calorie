-- Add DELETE policy for external_food_cache table
-- This allows only admin users (is_admin = true) to delete rows from the cache

-- Policy: Allow only admins to delete rows
-- This checks the profiles table to ensure the user has is_admin = true
CREATE POLICY "external_food_cache_delete_admin_only" ON external_food_cache
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Note: This policy ensures that only users with is_admin = true in their profile
-- can delete rows from external_food_cache. This adds server-side security
-- in addition to the client-side admin checks on the External Cache Food Promotion page.

