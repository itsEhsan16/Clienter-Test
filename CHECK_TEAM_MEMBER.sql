-- Check if the team member exists in the database
-- Run this in Supabase SQL Editor

-- 1. Check if user exists in auth
SELECT id, email, created_at 
FROM auth.users 
WHERE email = 'itskkc2737@gmail.com';

-- 2. Check if profile exists
SELECT id, email, full_name, created_at 
FROM profiles 
WHERE email = 'itskkc2737@gmail.com';

-- 3. Check if organization_members record exists
SELECT 
    om.id,
    om.user_id,
    om.organization_id,
    om.role,
    om.display_name,
    om.status,
    om.created_at,
    o.name as organization_name
FROM organization_members om
LEFT JOIN organizations o ON om.organization_id = o.id
WHERE om.user_id = (SELECT id FROM profiles WHERE email = 'itskkc2737@gmail.com');

-- 4. If organization_members record is missing, let's check your organization
SELECT id, name, owner_id 
FROM organizations 
WHERE owner_id = (SELECT id FROM profiles WHERE email = 'talaganarajesh@gmail.com');

-- 5. If the record is missing, we'll need to create it
-- First, get the user_id and organization_id from queries above, then insert:
-- INSERT INTO organization_members (
--   organization_id,
--   user_id,
--   role,
--   display_name,
--   status,
--   password_for_sharing
-- ) VALUES (
--   'YOUR_ORG_ID',
--   'USER_ID_FROM_QUERY_2',
--   'designer',
--   'Ehsan',
--   'active',
--   'the_password_you_set'
-- );
