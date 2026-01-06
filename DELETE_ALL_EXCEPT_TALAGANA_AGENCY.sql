-- =====================================================
-- DELETE ALL AGENCIES EXCEPT TALAGANA RAJESH'S AGENCY
-- =====================================================
-- This script will:
-- 1. Keep only Talagana Rajesh's agency (organization)
-- 2. Delete all other agencies/organizations
-- 3. Delete all users not associated with Talagana Rajesh's agency
-- 4. Clean up all related data (clients, projects, tasks, expenses, etc.)
-- 5. Delete from Supabase auth.users table as well
-- 
-- WARNING: THIS IS A DESTRUCTIVE OPERATION - CANNOT BE UNDONE
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: Store Talagana Rajesh's organization ID
-- =====================================================
DO $$
DECLARE
  talagana_org_id UUID;
  talagana_user_id UUID;
BEGIN
  -- Get Talagana Rajesh's user ID
  SELECT id INTO talagana_user_id 
  FROM profiles 
  WHERE email = 'talaganarajesh@gmail.com';
  
  IF talagana_user_id IS NULL THEN
    RAISE EXCEPTION 'Talagana Rajesh user not found! Email: talaganarajesh@gmail.com';
  END IF;
  
  -- Get Talagana Rajesh's organization ID
  SELECT id INTO talagana_org_id 
  FROM organizations 
  WHERE owner_id = talagana_user_id;
  
  IF talagana_org_id IS NULL THEN
    RAISE EXCEPTION 'Talagana Rajesh organization not found!';
  END IF;
  
  -- Store these IDs in temporary table for use in deletions
  CREATE TEMP TABLE keep_data AS
  SELECT 
    talagana_user_id as owner_id,
    talagana_org_id as org_id;
    
  RAISE NOTICE 'Found Talagana Rajesh User ID: %', talagana_user_id;
  RAISE NOTICE 'Found Talagana Rajesh Organization ID: %', talagana_org_id;
  
END $$;

-- =====================================================
-- STEP 2: Get all user IDs that belong to Talagana's organization
-- (These users will be kept)
-- =====================================================
CREATE TEMP TABLE users_to_keep AS
SELECT DISTINCT user_id 
FROM organization_members 
WHERE organization_id = (SELECT org_id FROM keep_data)
UNION
SELECT owner_id FROM keep_data;

-- Display users being kept
DO $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM users_to_keep;
  RAISE NOTICE 'Total users to keep in Talagana organization: %', user_count;
END $$;

-- =====================================================
-- STEP 3: Delete data from OTHER organizations
-- =====================================================

-- Delete team payment records for other organizations (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'team_payment_records') THEN
    DELETE FROM team_payment_records
    WHERE expense_id IN (
      SELECT id FROM expenses 
      WHERE organization_id IS NOT NULL 
      AND organization_id != (SELECT org_id FROM keep_data)
    );
    RAISE NOTICE 'Deleted team payment records from other organizations';
  ELSE
    RAISE NOTICE 'Table team_payment_records does not exist, skipping';
  END IF;
END $$;

-- Delete project updates for other organizations (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'project_updates') THEN
    DELETE FROM project_updates
    WHERE project_id IN (
      SELECT id FROM projects 
      WHERE organization_id != (SELECT org_id FROM keep_data)
    );
    RAISE NOTICE 'Deleted project updates from other organizations';
  ELSE
    RAISE NOTICE 'Table project_updates does not exist, skipping';
  END IF;
END $$;

-- Delete project tasks for other organizations (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'project_tasks') THEN
    DELETE FROM project_tasks
    WHERE project_id IN (
      SELECT id FROM projects 
      WHERE organization_id != (SELECT org_id FROM keep_data)
    );
    RAISE NOTICE 'Deleted project tasks from other organizations';
  ELSE
    RAISE NOTICE 'Table project_tasks does not exist, skipping';
  END IF;
END $$;

-- Delete project team members for other organizations (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'project_team_members') THEN
    DELETE FROM project_team_members
    WHERE project_id IN (
      SELECT id FROM projects 
      WHERE organization_id != (SELECT org_id FROM keep_data)
    );
    RAISE NOTICE 'Deleted project team members from other organizations';
  ELSE
    RAISE NOTICE 'Table project_team_members does not exist, skipping';
  END IF;
END $$;

-- Delete projects for other organizations (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'projects') THEN
    DELETE FROM projects
    WHERE organization_id != (SELECT org_id FROM keep_data);
    RAISE NOTICE 'Deleted projects from other organizations';
  ELSE
    RAISE NOTICE 'Table projects does not exist, skipping';
  END IF;
END $$;

-- Delete expenses for other organizations (if table exists and has organization_id column)
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'organization_id'
  ) THEN
    DELETE FROM expenses
    WHERE organization_id IS NOT NULL 
    AND organization_id != (SELECT org_id FROM keep_data);
    RAISE NOTICE 'Deleted expenses from other organizations';
  ELSE
    RAISE NOTICE 'Expenses table does not have organization_id column, skipping organization-based deletion';
  END IF;
END $$;

-- Delete payments for other organizations (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payments') THEN
    DELETE FROM payments
    WHERE organization_id != (SELECT org_id FROM keep_data);
    RAISE NOTICE 'Deleted payments from other organizations';
  ELSE
    RAISE NOTICE 'Table payments does not exist, skipping';
  END IF;
END $$;

-- Delete tasks for other organizations (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tasks') THEN
    DELETE FROM tasks
    WHERE organization_id != (SELECT org_id FROM keep_data);
    RAISE NOTICE 'Deleted tasks from other organizations';
  ELSE
    RAISE NOTICE 'Table tasks does not exist, skipping';
  END IF;
END $$;

-- Delete organization members from other organizations
DELETE FROM organization_members
WHERE organization_id != (SELECT org_id FROM keep_data);

-- Delete all other organizations
DELETE FROM organizations
WHERE id != (SELECT org_id FROM keep_data);

-- =====================================================
-- STEP 4: Delete data for users NOT in Talagana's organization
-- =====================================================

-- Delete reminders for users not in kept list
DELETE FROM reminders
WHERE user_id NOT IN (SELECT user_id FROM users_to_keep);

-- Delete meetings for users not in kept list
DELETE FROM meetings
WHERE user_id NOT IN (SELECT user_id FROM users_to_keep);

-- Delete clients for users not in kept list
DELETE FROM clients
WHERE user_id NOT IN (SELECT user_id FROM users_to_keep);

-- Delete profiles for users not in kept list
DELETE FROM profiles
WHERE id NOT IN (SELECT user_id FROM users_to_keep);

-- =====================================================
-- STEP 5: Delete from Supabase auth.users table
-- (This removes users from authentication system)
-- =====================================================

-- Delete auth users that are not in the keep list
DELETE FROM auth.users
WHERE id NOT IN (SELECT user_id FROM users_to_keep);

-- =====================================================
-- STEP 6: Display summary of cleanup
-- =====================================================
DO $$
DECLARE
  remaining_orgs INTEGER;
  remaining_users INTEGER;
  remaining_members INTEGER;
  remaining_clients INTEGER;
  remaining_projects INTEGER := 0;
  remaining_tasks INTEGER := 0;
  remaining_expenses INTEGER;
  remaining_meetings INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_orgs FROM organizations;
  SELECT COUNT(*) INTO remaining_users FROM profiles;
  SELECT COUNT(*) INTO remaining_members FROM organization_members;
  SELECT COUNT(*) INTO remaining_clients FROM clients;
  SELECT COUNT(*) INTO remaining_expenses FROM expenses;
  SELECT COUNT(*) INTO remaining_meetings FROM meetings;
  
  -- Check if projects table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'projects') THEN
    SELECT COUNT(*) INTO remaining_projects FROM projects;
  END IF;
  
  -- Check if tasks table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tasks') THEN
    SELECT COUNT(*) INTO remaining_tasks FROM tasks;
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CLEANUP COMPLETED SUCCESSFULLY';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Remaining Organizations: %', remaining_orgs;
  RAISE NOTICE 'Remaining Users: %', remaining_users;
  RAISE NOTICE 'Remaining Organization Members: %', remaining_members;
  RAISE NOTICE 'Remaining Clients: %', remaining_clients;
  RAISE NOTICE 'Remaining Meetings: %', remaining_meetings;
  RAISE NOTICE 'Remaining Projects: %', remaining_projects;
  RAISE NOTICE 'Remaining Tasks: %', remaining_tasks;
  RAISE NOTICE 'Remaining Expenses: %', remaining_expenses;
  RAISE NOTICE '========================================';
END $$;

-- Clean up temp tables
DROP TABLE IF EXISTS users_to_keep;
DROP TABLE IF EXISTS keep_data;

COMMIT;

-- =====================================================
-- VERIFICATION QUERIES (Run these after the cleanup)
-- =====================================================

-- Check remaining organization
-- SELECT * FROM organizations;

-- Check remaining users
-- SELECT id, email, full_name FROM profiles;

-- Check remaining organization members
-- SELECT * FROM organization_members;

-- Check remaining clients
-- SELECT id, name, user_id FROM clients;

-- Check remaining projects
-- SELECT id, name, organization_id FROM projects;
