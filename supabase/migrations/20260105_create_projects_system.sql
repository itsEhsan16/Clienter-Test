-- =========================================
-- COMPLETE PROJECT MANAGEMENT SYSTEM
-- Migration: Client → Projects → Team Members → Expenses
-- =========================================

-- This creates a full project management system where:
-- 1. Clients have multiple Projects
-- 2. Projects are assigned to Team Members
-- 3. Expenses/Payments are tracked per Project
-- 4. Team members see only their assigned projects

-- =====================================================
-- PART 1: CREATE PROJECTS TABLE
-- =====================================================

-- Project status enum
DO $$ BEGIN
  CREATE TYPE project_status AS ENUM (
    'planning',
    'in_progress', 
    'on_hold',
    'completed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Project details
  name VARCHAR(500) NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'planning',
  
  -- Financial
  budget DECIMAL(10, 2),
  total_paid DECIMAL(10, 2) DEFAULT 0,
  
  -- Dates
  start_date DATE,
  deadline DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Project team assignments (which team members work on which projects)
CREATE TABLE IF NOT EXISTS project_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Team member's details for this project
  role VARCHAR(100), -- e.g., 'Lead Designer', 'Developer', 'Content Writer'
  allocated_budget DECIMAL(10, 2), -- How much this team member gets for this project
  total_paid DECIMAL(10, 2) DEFAULT 0, -- Auto-calculated from payment records
  
  -- Status
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'completed', 'removed'
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  UNIQUE(project_id, team_member_id)
);

-- Project tasks (for task management within projects)
CREATE TABLE IF NOT EXISTS project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  priority VARCHAR(50) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Project updates/notes (for tracking project progress)
CREATE TABLE IF NOT EXISTS project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  title VARCHAR(500),
  content TEXT NOT NULL,
  update_type VARCHAR(50) DEFAULT 'general', -- 'general', 'milestone', 'issue', 'client_feedback'
  
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================
-- PART 2: UPDATE EXPENSES TABLE TO LINK TO PROJECTS
-- =====================================================

-- Add project_id to expenses
ALTER TABLE expenses 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS project_team_member_id UUID REFERENCES project_team_members(id) ON DELETE CASCADE;

-- Update constraint: team expenses must have project
DO $$ BEGIN
  ALTER TABLE expenses DROP CONSTRAINT IF EXISTS check_team_expense_has_member;
  ALTER TABLE expenses 
    ADD CONSTRAINT check_team_expense_has_project 
    CHECK (
      (expense_type = 'team' AND project_id IS NOT NULL AND team_member_id IS NOT NULL) OR
      (expense_type = 'other')
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- PART 3: UPDATE CLIENTS TABLE
-- =====================================================

-- Remove project-specific fields from clients (they're now in projects table)
-- Keep these for backward compatibility but they won't be used for new data
-- ALTER TABLE clients DROP COLUMN IF EXISTS project_description;
-- Note: We'll keep existing fields for now to not break existing data

-- =====================================================
-- PART 4: INDEXES FOR PERFORMANCE
-- =====================================================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_organization ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(deadline);

-- Project team members indexes
CREATE INDEX IF NOT EXISTS idx_project_team_members_project ON project_team_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_members_team_member ON project_team_members(team_member_id);
CREATE INDEX IF NOT EXISTS idx_project_team_members_status ON project_team_members(status);

-- Project tasks indexes
CREATE INDEX IF NOT EXISTS idx_project_tasks_project ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_to ON project_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);

-- Project updates indexes
CREATE INDEX IF NOT EXISTS idx_project_updates_project ON project_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_created_by ON project_updates(created_by);

-- Update expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project_team_member ON expenses(project_team_member_id);

-- =====================================================
-- PART 5: ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Projects RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view org projects" ON projects;
CREATE POLICY "Users can view org projects"
  ON projects FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
    OR id IN (
      SELECT project_id 
      FROM project_team_members 
      WHERE team_member_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can manage projects" ON projects;
CREATE POLICY "Owners can manage projects"
  ON projects FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Project team members RLS
ALTER TABLE project_team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view project team" ON project_team_members;
CREATE POLICY "Users can view project team"
  ON project_team_members FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
    OR team_member_id = auth.uid()
  );

DROP POLICY IF EXISTS "Owners can manage project team" ON project_team_members;
CREATE POLICY "Owners can manage project team"
  ON project_team_members FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- Project tasks RLS
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view project tasks" ON project_tasks;
CREATE POLICY "Users can view project tasks"
  ON project_tasks FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_team_members WHERE team_member_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Team can manage assigned tasks" ON project_tasks;
CREATE POLICY "Team can manage assigned tasks"
  ON project_tasks FOR ALL
  USING (
    assigned_to = auth.uid()
    OR project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- Project updates RLS
ALTER TABLE project_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view project updates" ON project_updates;
CREATE POLICY "Users can view project updates"
  ON project_updates FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM project_team_members WHERE team_member_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can add project updates" ON project_updates;
CREATE POLICY "Users can add project updates"
  ON project_updates FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM project_team_members WHERE team_member_id = auth.uid()
    )
    OR project_id IN (
      SELECT id FROM projects WHERE organization_id IN (
        SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
      )
    )
  );

-- =====================================================
-- PART 6: TRIGGERS AND FUNCTIONS
-- =====================================================

-- Update project total_paid when payments are made
CREATE OR REPLACE FUNCTION update_project_payments()
RETURNS TRIGGER AS $$
BEGIN
  -- Update project_team_member total_paid
  IF NEW.project_team_member_id IS NOT NULL THEN
    UPDATE project_team_members
    SET 
      total_paid = (
        SELECT COALESCE(SUM(paid_amount), 0)
        FROM expenses
        WHERE project_team_member_id = NEW.project_team_member_id
          AND expense_type = 'team'
      ),
      updated_at = TIMEZONE('utc', NOW())
    WHERE id = NEW.project_team_member_id;
  END IF;
  
  -- Update project total_paid
  IF NEW.project_id IS NOT NULL THEN
    UPDATE projects
    SET 
      total_paid = (
        SELECT COALESCE(SUM(e.paid_amount), 0)
        FROM expenses e
        WHERE e.project_id = NEW.project_id
          AND e.expense_type = 'team'
      ),
      updated_at = TIMEZONE('utc', NOW())
    WHERE id = NEW.project_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_payments ON expenses;
CREATE TRIGGER trigger_update_project_payments
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_project_payments();

-- Auto-update timestamps
DROP TRIGGER IF EXISTS trigger_projects_updated_at ON projects;
CREATE TRIGGER trigger_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_project_team_members_updated_at ON project_team_members;
CREATE TRIGGER trigger_project_team_members_updated_at
  BEFORE UPDATE ON project_team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_project_tasks_updated_at ON project_tasks;
CREATE TRIGGER trigger_project_tasks_updated_at
  BEFORE UPDATE ON project_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- PART 7: HELPFUL VIEWS
-- =====================================================

-- Project summary with team and finances
CREATE OR REPLACE VIEW project_summary AS
SELECT 
  p.*,
  c.name as client_name,
  c.phone as client_phone,
  COUNT(DISTINCT ptm.id) as team_member_count,
  COUNT(DISTINCT pt.id) as task_count,
  COUNT(DISTINCT pt.id) FILTER (WHERE pt.status = 'completed') as completed_tasks,
  (p.budget - p.total_paid) as pending_amount
FROM projects p
JOIN clients c ON p.client_id = c.id
LEFT JOIN project_team_members ptm ON p.id = ptm.project_id AND ptm.status = 'active'
LEFT JOIN project_tasks pt ON p.id = pt.project_id
GROUP BY p.id, c.name, c.phone;

-- Team member project earnings
CREATE OR REPLACE VIEW team_member_project_earnings AS
SELECT 
  ptm.team_member_id,
  ptm.project_id,
  p.name as project_name,
  p.client_id,
  c.name as client_name,
  ptm.role as project_role,
  ptm.allocated_budget,
  ptm.total_paid,
  (ptm.allocated_budget - ptm.total_paid) as pending_amount,
  ptm.status,
  p.status as project_status,
  prof.email as team_member_email,
  prof.full_name as team_member_name
FROM project_team_members ptm
JOIN projects p ON ptm.project_id = p.id
JOIN clients c ON p.client_id = c.id
JOIN profiles prof ON ptm.team_member_id = prof.id;

-- Monthly earnings per team member
CREATE OR REPLACE VIEW team_member_monthly_earnings AS
SELECT 
  e.team_member_id,
  prof.email,
  prof.full_name,
  DATE_TRUNC('month', tpr.payment_date) as month,
  SUM(tpr.amount) as monthly_earnings,
  COUNT(DISTINCT e.project_id) as projects_count
FROM team_payment_records tpr
JOIN expenses e ON tpr.expense_id = e.id
JOIN profiles prof ON e.team_member_id = prof.id
WHERE e.expense_type = 'team'
GROUP BY e.team_member_id, prof.email, prof.full_name, DATE_TRUNC('month', tpr.payment_date);

GRANT SELECT ON project_summary TO authenticated;
GRANT SELECT ON team_member_project_earnings TO authenticated;
GRANT SELECT ON team_member_monthly_earnings TO authenticated;

-- Update existing team_member_earnings view to use projects
DROP VIEW IF EXISTS team_member_earnings CASCADE;
CREATE OR REPLACE VIEW team_member_earnings AS
SELECT 
  ptm.team_member_id,
  prof.email,
  prof.full_name,
  COUNT(DISTINCT ptm.project_id) as total_projects,
  SUM(ptm.allocated_budget) as total_earned,
  SUM(ptm.total_paid) as total_received,
  SUM(ptm.allocated_budget - ptm.total_paid) as total_pending,
  p.organization_id
FROM project_team_members ptm
JOIN profiles prof ON ptm.team_member_id = prof.id
JOIN projects p ON ptm.project_id = p.id
WHERE ptm.status = 'active'
GROUP BY ptm.team_member_id, prof.email, prof.full_name, p.organization_id;

GRANT SELECT ON team_member_earnings TO authenticated;

-- =====================================================
-- PART 8: DATA MIGRATION
-- =====================================================

-- This is a helper to migrate existing client data to projects
-- Run this after the schema is created

-- Optionally: Create projects from existing clients
-- Uncomment and run this if you want to auto-migrate existing clients to have one project each

/*
INSERT INTO projects (client_id, organization_id, name, description, status, budget, created_by, created_at)
SELECT 
  c.id,
  c.organization_id,
  COALESCE(c.project_description, c.name || ' - Project'),
  c.project_description,
  CASE 
    WHEN c.status = 'completed' THEN 'completed'::project_status
    WHEN c.status = 'ongoing' THEN 'in_progress'::project_status
    ELSE 'planning'::project_status
  END,
  c.total_amount,
  c.user_id,
  c.created_at
FROM clients c
WHERE c.id NOT IN (SELECT DISTINCT client_id FROM projects WHERE client_id IS NOT NULL);
*/

-- =====================================================
-- SUCCESS!
-- =====================================================

-- Schema created successfully!
-- You now have:
-- ✅ Projects table linked to clients
-- ✅ Project team member assignments
-- ✅ Project tasks management
-- ✅ Project updates/notes
-- ✅ Expenses linked to projects
-- ✅ Automatic payment tracking per project
-- ✅ Comprehensive views for reporting

-- Next steps:
-- 1. Update your UI to use projects
-- 2. Create project management pages
-- 3. Update expenses to link to projects
-- 4. Update team dashboard to show project earnings
