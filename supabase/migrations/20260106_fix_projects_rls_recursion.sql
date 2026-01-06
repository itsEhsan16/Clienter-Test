-- Migration: Fix Projects RLS Infinite Recursion
-- Created: 2026-01-06
-- Purpose: Fix circular dependencies in RLS policies for projects and related tables

-- =====================================================
-- PART 1: FIX PROJECTS POLICIES (Remove Recursion)
-- =====================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view org projects" ON projects;
DROP POLICY IF EXISTS "Owners can manage projects" ON projects;

-- Simple, non-recursive policy: Users can view projects in their organization
CREATE POLICY "view_org_projects"
  ON projects FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Owners can insert projects in their organization
CREATE POLICY "insert_org_projects"
  ON projects FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Owners can update projects in their organization
CREATE POLICY "update_org_projects"
  ON projects FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Owners can delete projects in their organization
CREATE POLICY "delete_org_projects"
  ON projects FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- PART 2: FIX PROJECT_TEAM_MEMBERS POLICIES
-- =====================================================

ALTER TABLE project_team_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view project team" ON project_team_members;
DROP POLICY IF EXISTS "Owners can manage project team" ON project_team_members;

-- Team members can view their own assignments
CREATE POLICY "view_own_assignments"
  ON project_team_members FOR SELECT
  USING (
    team_member_id = auth.uid()
  );

-- Organization members can view team assignments in their org
CREATE POLICY "view_org_team_assignments"
  ON project_team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_team_members.project_id
        AND p.organization_id IN (
          SELECT organization_id 
          FROM organization_members 
          WHERE user_id = auth.uid()
        )
    )
  );

-- Owners can insert team members
CREATE POLICY "insert_team_members"
  ON project_team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_team_members.project_id
        AND p.organization_id IN (
          SELECT organization_id 
          FROM organization_members 
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    )
  );

-- Owners can update team members
CREATE POLICY "update_team_members"
  ON project_team_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_team_members.project_id
        AND p.organization_id IN (
          SELECT organization_id 
          FROM organization_members 
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    )
  );

-- Owners can delete team members
CREATE POLICY "delete_team_members"
  ON project_team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_team_members.project_id
        AND p.organization_id IN (
          SELECT organization_id 
          FROM organization_members 
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    )
  );

-- =====================================================
-- PART 3: FIX PROJECT_TASKS POLICIES
-- =====================================================

ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view project tasks" ON project_tasks;
DROP POLICY IF EXISTS "Team can manage assigned tasks" ON project_tasks;

-- View tasks for projects in user's organization
CREATE POLICY "view_org_tasks"
  ON project_tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id
        AND p.organization_id IN (
          SELECT organization_id 
          FROM organization_members 
          WHERE user_id = auth.uid()
        )
    )
  );

-- Insert tasks for projects in user's organization (owners only)
CREATE POLICY "insert_org_tasks"
  ON project_tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id
        AND p.organization_id IN (
          SELECT organization_id 
          FROM organization_members 
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    )
  );

-- Update tasks (owners or assigned user)
CREATE POLICY "update_tasks"
  ON project_tasks FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id
        AND p.organization_id IN (
          SELECT organization_id 
          FROM organization_members 
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    )
  );

-- Delete tasks (owners only)
CREATE POLICY "delete_tasks"
  ON project_tasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_tasks.project_id
        AND p.organization_id IN (
          SELECT organization_id 
          FROM organization_members 
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    )
  );

-- =====================================================
-- PART 4: FIX PROJECT_UPDATES POLICIES
-- =====================================================

ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view project updates" ON project_updates;
DROP POLICY IF EXISTS "Users can add project updates" ON project_updates;

-- View updates for projects in user's organization
CREATE POLICY "view_org_updates"
  ON project_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_updates.project_id
        AND p.organization_id IN (
          SELECT organization_id 
          FROM organization_members 
          WHERE user_id = auth.uid()
        )
    )
  );

-- Insert updates for projects in user's organization
CREATE POLICY "insert_org_updates"
  ON project_updates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_updates.project_id
        AND p.organization_id IN (
          SELECT organization_id 
          FROM organization_members 
          WHERE user_id = auth.uid()
        )
    )
  );

-- =====================================================
-- VERIFICATION COMMENTS
-- =====================================================

COMMENT ON POLICY "view_org_projects" ON projects IS 
  'Users can view projects in their organization - no recursion';
COMMENT ON POLICY "view_org_team_assignments" ON project_team_members IS 
  'Separated policies to avoid recursion with projects table';
COMMENT ON POLICY "view_org_tasks" ON project_tasks IS 
  'Direct organization check via projects - no recursion through team members';
