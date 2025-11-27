-- ALTERNATIVE: If the above doesn't work, try this more permissive policy
-- (Only use this for development/testing, not production!)

-- Enable Row Level Security on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Allow all authenticated inserts" ON profiles;

-- More permissive policy for development
-- This allows any authenticated user to insert profiles
CREATE POLICY "Allow all authenticated inserts"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Keep the read/update/delete policies restrictive
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON profiles;

CREATE POLICY "Users can read their own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
ON profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

