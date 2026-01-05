-- ====================================================================
-- FRESH PROJECT MANAGEMENT MIGRATION
-- 100% Safe - Handles all existing columns/tables
-- ====================================================================

-- =====================================================
-- 1. CREATE PROJECT STATUS TYPE
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
    CREATE TYPE project_status AS ENUM ('planning', 'in_progress', 'completed', 'cancelled');
  END IF;
END $$;

-- =====================================================
-- 2. CREATE PROJECTS TABLE
-- =====================================================

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
-- 3. CREATE PROJECT TEAM MEMBERS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS project_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  allocated_budget DECIMAL(10, 2),
  total_paid DECIMAL(10, 2) DEFAULT 0,
  
  status VARCHAR(50) DEFAULT 'active',
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Add unique constraint safely
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'project_team_members_project_team_unique'
  ) THEN
    ALTER TABLE project_team_members 
    ADD CONSTRAINT project_team_members_project_team_unique 
    UNIQUE(project_id, team_member_id);
  END IF;
END $$;

-- =====================================================
-- 4. UPDATE EXPENSES TABLE - CHECK EACH COLUMN
-- =====================================================

-- Add project_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add project_team_member_id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'project_team_member_id'
  ) THEN
    ALTER TABLE expenses ADD COLUMN project_team_member_id UUID REFERENCES project_team_members(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add total_amount (only if doesn't exist)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'total_amount'
  ) THEN
    ALTER TABLE expenses ADD COLUMN total_amount DECIMAL(10, 2);
  END IF;
END $$;

-- Add paid_amount (only if doesn't exist)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'paid_amount'
  ) THEN
    ALTER TABLE expenses ADD COLUMN paid_amount DECIMAL(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add payment_status (only if doesn't exist)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'expenses' AND column_name = 'payment_status'
  ) THEN
    ALTER TABLE expenses ADD COLUMN payment_status VARCHAR(20);
  END IF;
END $$;

-- Add check constraint for payment_status
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'expenses_payment_status_check'
  ) THEN
    ALTER TABLE expenses 
    ADD CONSTRAINT expenses_payment_status_check 
    CHECK (payment_status IN ('pending', 'partial', 'completed'));
  END IF;
END $$;

-- =====================================================
-- 5. CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_organization ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_team_members_project ON project_team_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_team_members_team_member ON project_team_members(team_member_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project ON expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_project_team_member ON expenses(project_team_member_id);

-- =====================================================
-- 6. ROW LEVEL SECURITY
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
-- 7. AUTO-UPDATE TRIGGERS
-- =====================================================

-- Update project totals when expenses change
CREATE OR REPLACE FUNCTION update_project_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    IF OLD.project_id IS NOT NULL THEN
      UPDATE projects
      SET 
        total_paid = (
          SELECT COALESCE(SUM(COALESCE(paid_amount, amount)), 0) 
          FROM expenses 
          WHERE project_id = OLD.project_id
        ),
        updated_at = TIMEZONE('utc', NOW())
      WHERE id = OLD.project_id;
      
      IF OLD.project_team_member_id IS NOT NULL THEN
        UPDATE project_team_members
        SET total_paid = (
          SELECT COALESCE(SUM(COALESCE(paid_amount, amount)), 0) 
          FROM expenses 
          WHERE project_team_member_id = OLD.project_team_member_id
        )
        WHERE id = OLD.project_team_member_id;
      END IF;
    END IF;
    RETURN OLD;
  ELSE
    -- INSERT or UPDATE
    IF NEW.project_id IS NOT NULL THEN
      UPDATE projects
      SET 
        total_paid = (
          SELECT COALESCE(SUM(COALESCE(paid_amount, amount)), 0) 
          FROM expenses 
          WHERE project_id = NEW.project_id
        ),
        updated_at = TIMEZONE('utc', NOW())
      WHERE id = NEW.project_id;
      
      IF NEW.project_team_member_id IS NOT NULL THEN
        UPDATE project_team_members
        SET total_paid = (
          SELECT COALESCE(SUM(COALESCE(paid_amount, amount)), 0) 
          FROM expenses 
          WHERE project_team_member_id = NEW.project_team_member_id
        )
        WHERE id = NEW.project_team_member_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_totals ON expenses;
CREATE TRIGGER trigger_update_project_totals
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_project_totals();

-- =====================================================
-- 8. HELPFUL VIEWS
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

-- Grant access
DO $$ BEGIN
  GRANT SELECT ON my_assigned_projects TO authenticated;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

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

-- Grant access
DO $$ BEGIN
  GRANT SELECT ON project_summary TO authenticated;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- =====================================================
-- SUCCESS!
-- =====================================================

-- Test the setup
DO $$ 
DECLARE
  project_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO project_count FROM projects;
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '✅ Projects table ready (% existing projects)', project_count;
  RAISE NOTICE '✅ All columns added to expenses table';
  RAISE NOTICE '✅ Triggers and views created';
  RAISE NOTICE '✅ Ready to use!';
END $$;
