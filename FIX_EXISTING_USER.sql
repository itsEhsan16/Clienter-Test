-- Fix: Add existing Supabase Auth user to organization_members
-- Run this in Supabase SQL Editor if you have an existing user that needs to be added as a team member

-- STEP 1: Find your organization ID (replace 'your-owner-email@example.com' with your actual owner email)
SELECT o.id as organization_id, o.name as organization_name
FROM organizations o
JOIN profiles p ON o.owner_id = p.id
WHERE p.email = 'your-owner-email@example.com';

-- STEP 2: Find the user ID of the team member (replace with their email)
SELECT id, email FROM profiles WHERE email = 'itskkc2737@gmail.com';

-- STEP 3: Insert the user into organization_members
-- Replace the UUIDs below with the actual values from STEP 1 and STEP 2
INSERT INTO organization_members (
  organization_id,
  user_id,
  role,
  display_name,
  status,
  hire_date
) VALUES (
  'YOUR_ORGANIZATION_ID_HERE',  -- From STEP 1
  'USER_ID_HERE',               -- From STEP 2
  'developer',                  -- Change role as needed: developer, designer, editor, etc.
  'Ehsan',                      -- Display name
  'active',
  CURRENT_DATE
);

-- STEP 4: Verify the record was created
SELECT 
  om.*,
  p.email,
  o.name as organization_name
FROM organization_members om
JOIN profiles p ON om.user_id = p.id
JOIN organizations o ON om.organization_id = o.id
WHERE p.email = 'itskkc2737@gmail.com';
