-- Run this in Supabase SQL Editor to check auth schema and triggers

-- 1. Check if auth schema exists
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name = 'auth';

-- 2. Check if auth.users table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'auth' AND table_name = 'users';

-- 3. Check if profiles table exists and has proper trigger
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name = 'profiles';

-- 4. Check if trigger exists for auto-creating profiles
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%profile%' OR action_statement LIKE '%profiles%';

-- 5. Check current user limit (if applicable)
SELECT count(*) as total_users FROM auth.users;

-- 6. Try to see recent errors in postgres logs (if accessible)
-- You may need to check Supabase logs directly in dashboard
