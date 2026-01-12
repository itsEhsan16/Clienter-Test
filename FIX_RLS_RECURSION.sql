-- ====================================================================
-- FIX INFINITE RECURSION IN PROJECTS RLS POLICIES
-- Run this in Supabase SQL Editor
-- ====================================================================

-- PART A: Ensure columns exist first
-- Add start_date column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'projects'
      AND column_name  = 'start_date'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN start_date DATE;
    RAISE NOTICE 'Added start_date column to projects table';
  ELSE
    RAISE NOTICE 'start_date column already exists';
  END IF;
END $$;

-- Add deadline column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'projects'
      AND column_name  = 'deadline'
  ) THEN
    ALTER TABLE public.projects ADD COLUMN deadline DATE;
    RAISE NOTICE 'Added deadline column to projects table';
  ELSE
    RAISE NOTICE 'deadline column already exists';
  END IF;
END $$;

-- PART B: Fix RLS Policies
-- Step 1: Drop ALL existing policies on projects table
DROP POLICY IF EXISTS "view_org_projects" ON projects;
DROP POLICY IF EXISTS "insert_org_projects" ON projects;
DROP POLICY IF EXISTS "update_org_projects" ON projects;
DROP POLICY IF EXISTS "delete_org_projects" ON projects;
DROP POLICY IF EXISTS "Users can view org projects" ON projects;
DROP POLICY IF EXISTS "Owners can manage projects" ON projects;
DROP POLICY IF EXISTS "Users can view their projects" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can update their projects" ON projects;
DROP POLICY IF EXISTS "Users can delete their projects" ON projects;

-- Step 2: Ensure RLS is enabled
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Step 3: Create simple, non-recursive policies
-- SELECT: Users can view projects in their organization
CREATE POLICY "view_org_projects"
  ON projects FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Members can create projects in their organization
CREATE POLICY "insert_org_projects"
  ON projects FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- UPDATE: Members can update projects in their organization
CREATE POLICY "update_org_projects"
  ON projects FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- DELETE: Owners/admins can delete projects
CREATE POLICY "delete_org_projects"
  ON projects FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Step 4: Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'projects'
ORDER BY policyname;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Projects RLS policies have been reset successfully!';
END $$;
