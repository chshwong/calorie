-- QUICK FIX: Temporarily disable RLS to test (DEVELOPMENT ONLY)
-- This will allow inserts to work immediately

-- Disable RLS temporarily
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- After testing, re-enable RLS with proper policies:
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- Then run the policies from supabase-setup.sql

