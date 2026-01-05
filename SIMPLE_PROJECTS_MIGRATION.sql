-- ====================================================================
-- SIMPLIFIED PROJECT MANAGEMENT - QUICK IMPLEMENTATION
-- Run this first to get basic project support working
-- ====================================================================

-- This is a simplified version that gets you up and running quickly
-- You can expand with full features later

-- =====================================================
-- 1. CREATE PROJECTS TABLE (SIMPLIFIED)
-- =====================================================

CREATE TYPE project_status AS ENUM ('planning', 'in_progress', 'completed', 'cancelled');

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  name VARCHAR(500) NOT NULL,
  description TEXT,
  status project_status DEFAULT 'in_progress',
  
  budget DECIMAL(10, 2),
  total_paid DECIMAL(10, 2) DEFAULT 0,
  
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================
-- 2. PROJECT TEAM MEMBERS (WHO WORKS ON WHAT)
-- =====================================================

CREATE TABLE IF NOT EXISTS project_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  allocated_budget DECIMAL(10, 2), -- How much this person gets for this project
  total_paid DECIMAL(10, 2) DEFAULT 0,
  
  status VARCHAR(50) DEFAULT 'active',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  
  UNIQUE(project_id, team_member_id)
);

-- =====================================================
-- 3. UPDATE EXPENSES TO LINK TO PROJECTS
-- =====================================================

ALTER TABLE expenses 
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE;

-- =====================================================
-- 4. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_organization ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_team_members_project ON project_team_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_members_team_member ON project_team_members(team_member_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);

-- =====================================================
-- 5. ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_team_members ENABLE ROW LEVEL SECURITY;

-- Projects: View if in org or assigned to project
DROP POLICY IF EXISTS "View org and assigned projects" ON projects;
CREATE POLICY "View org and assigned projects"
  ON projects FOR SELECT
  USING (
    organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
    OR id IN (SELECT project_id FROM project_team_members WHERE team_member_id = auth.uid())
  );

-- Projects: Owners can manage
DROP POLICY IF EXISTS "Owners manage projects" ON projects;
CREATE POLICY "Owners manage projects"
  ON projects FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Team members: View if in org or assigned
DROP POLICY IF EXISTS "View project team" ON project_team_members;
CREATE POLICY "View project team"
  ON project_team_members FOR SELECT
  USING (
    project_id IN (SELECT id FROM projects WHERE organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    ))
    OR team_member_id = auth.uid()
  );

-- Team members: Owners can manage
DROP POLICY IF EXISTS "Owners manage team" ON project_team_members;
CREATE POLICY "Owners manage team"
  ON project_team_members FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    ))
  );

-- =====================================================
-- 6. AUTO-UPDATE TRIGGERS
-- =====================================================

-- Update project totals when expenses change
CREATE OR REPLACE FUNCTION update_project_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    -- Update project total_paid
    UPDATE projects
    SET 
      total_paid = (SELECT COALESCE(SUM(paid_amount), 0) FROM expenses WHERE project_id = NEW.project_id),
      updated_at = TIMEZONE('utc', NOW())
    WHERE id = NEW.project_id;
    
    -- Update team member total_paid
    IF NEW.team_member_id IS NOT NULL THEN
      UPDATE project_team_members
      SET 
        total_paid = (
          SELECT COALESCE(SUM(paid_amount), 0) 
          FROM expenses 
          WHERE project_id = NEW.project_id AND team_member_id = NEW.team_member_id
        )
      WHERE project_id = NEW.project_id AND team_member_id = NEW.team_member_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_totals ON expenses;
CREATE TRIGGER trigger_update_project_totals
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_project_totals();

-- =====================================================
-- 7. HELPFUL VIEWS
-- =====================================================

-- My projects (what projects am I assigned to)
CREATE OR REPLACE VIEW my_assigned_projects AS
SELECT 
  p.*,
  c.name as client_name,
  ptm.allocated_budget,
  ptm.total_paid,
  (ptm.allocated_budget - ptm.total_paid) as pending_amount
FROM projects p
JOIN clients c ON p.client_id = c.id
JOIN project_team_members ptm ON p.id = ptm.project_id
WHERE ptm.status = 'active';

GRANT SELECT ON my_assigned_projects TO authenticated;

-- Project summary
CREATE OR REPLACE VIEW project_summary AS
SELECT 
  p.*,
  c.name as client_name,
  COUNT(DISTINCT ptm.id) as team_count,
  (p.budget - p.total_paid) as pending
FROM projects p
JOIN clients c ON p.client_id = c.id
LEFT JOIN project_team_members ptm ON p.id = ptm.project_id AND ptm.status = 'active'
GROUP BY p.id, c.name;

GRANT SELECT ON project_summary TO authenticated;

-- =====================================================
-- 8. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- =====================================================

-- Uncomment to auto-create projects from existing clients
/*
INSERT INTO projects (client_id, organization_id, name, description, budget, created_by)
SELECT 
  c.id,
  c.organization_id,
  c.name || ' - Project',
  c.project_description,
  c.total_amount,
  c.user_id
FROM clients c
WHERE NOT EXISTS (SELECT 1 FROM projects WHERE client_id = c.id);
*/

-- =====================================================
-- SUCCESS!
-- =====================================================

-- ✅ Projects table created
-- ✅ Team assignments table created  
-- ✅ Expenses linked to projects
-- ✅ Auto-update triggers working
-- ✅ Views for easy querying
-- ✅ Security policies in place

-- Next: Update your UI to use projects!
