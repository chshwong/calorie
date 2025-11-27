-- Add is_admin column to profiles table
-- This column determines if a user has admin privileges

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Optional: Add comment to document the column
COMMENT ON COLUMN profiles.is_admin IS 'Marks users with admin privileges. Admins can access admin pages and view all user profiles.';

-- Grant update permission (users can't change their own is_admin status, but admins can via admin functions)
-- The RLS policies will control who can actually update this field

