-- Diagnostic script to check why profile updates might be failing
-- Run this in Supabase SQL Editor to diagnose the issue

-- 1. Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
AND tablename = 'profiles';

-- 2. Check all RLS policies on profiles table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
AND tablename = 'profiles'
ORDER BY policyname;

-- 3. Check all check constraints on profiles table
SELECT
    tc.table_name,
    tc.constraint_name,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc 
    ON tc.constraint_name = cc.constraint_name
WHERE tc.constraint_type = 'CHECK'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'profiles'
ORDER BY tc.constraint_name;

-- 4. Check column data types and nullability
SELECT
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name IN ('first_name', 'date_of_birth', 'gender', 'height_cm', 'weight_lb', 'user_id')
ORDER BY ordinal_position;

-- 5. Test if UPDATE policy works (replace 'YOUR_USER_ID' with an actual user_id from auth.users)
-- This will help identify if it's an RLS issue
-- SELECT auth.uid() as current_user_id;

-- 6. Check if there are any triggers that might be blocking
SELECT
    trigger_name,
    event_manipulation,
    action_statement,
    action_timing,
    event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'public'
    AND event_object_table = 'profiles';

