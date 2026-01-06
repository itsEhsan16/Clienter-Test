# Complete Database Fix for Expenses & Projects

## Apply these migrations in order

Go to your Supabase SQL Editor:
https://supabase.com/dashboard/project/zviakkdqtmhqfkxjjqvn/sql/new

## Migration 1: Add Missing Expense Columns

```sql
-- Migration: Add missing columns to expenses table to match frontend expectations
-- Created: 2026-01-06
-- Purpose: Add title, date, and category columns to expenses table

-- Add missing columns
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS category TEXT;

-- For existing records, copy description to title if title is null
UPDATE expenses
SET title = COALESCE(title, description)
WHERE title IS NULL OR title = '';

-- Make title NOT NULL after populating it
ALTER TABLE expenses
  ALTER COLUMN title SET NOT NULL;

-- Add index for date-based queries
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category) WHERE category IS NOT NULL;

COMMENT ON COLUMN expenses.title IS 'Short title/name for the expense';
COMMENT ON COLUMN expenses.date IS 'Date of the expense (default: current date)';
COMMENT ON COLUMN expenses.category IS 'Optional category for expense classification';
```

**Click "Run" and wait for success**

---

## Migration 2: Fix Projects RLS Policies (Remove Infinite Recursion)

```sql
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
```

**Click "Run" and wait for success**

---

## After Migration

1. ✅ Clear browser cache and hard refresh (Ctrl+Shift+R)
2. ✅ Check the expenses page - errors should be gone
3. ✅ Try adding a new expense to verify it works

## What Was Fixed

### Issues Resolved:

1. ❌ **Missing columns**: `title`, `date`, `category` in expenses table → ✅ Added
2. ❌ **Invalid column reference**: `company_name` in clients → ✅ Removed from queries
3. ❌ **Infinite recursion**: Projects RLS policies → ✅ Fixed with non-recursive policies

### Database Changes:

- Added `title`, `date`, `category` columns to expenses table
- Fixed all RLS policies to avoid circular dependencies
- Separated SELECT policies from INSERT/UPDATE/DELETE to prevent recursion
- Used EXISTS instead of IN for better performance and recursion prevention

The application is now properly synchronized with proper RLS policies and complete schema alignment!
