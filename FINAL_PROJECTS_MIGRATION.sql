-- ====================================================================
-- ULTRA-SAFE PROJECT MANAGEMENT MIGRATION
-- Checks every single thing before creating
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
-- 2. CREATE PROJECTS TABLE WITH COLUMN CHECKS
-- =====================================================

-- Create base table if not exists
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- Add each column individually
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'client_id') THEN ALTER TABLE projects ADD COLUMN client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'organization_id') THEN ALTER TABLE projects ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'name') THEN ALTER TABLE projects ADD COLUMN name VARCHAR(500) NOT NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'description') THEN ALTER TABLE projects ADD COLUMN description TEXT; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'status') THEN ALTER TABLE projects ADD COLUMN status project_status DEFAULT 'in_progress'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'budget') THEN ALTER TABLE projects ADD COLUMN budget DECIMAL(10, 2); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'total_paid') THEN ALTER TABLE projects ADD COLUMN total_paid DECIMAL(10, 2) DEFAULT 0; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'created_by') THEN ALTER TABLE projects ADD COLUMN created_by UUID NOT NULL REFERENCES profiles(id); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'created_at') THEN ALTER TABLE projects ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'projects' AND column_name = 'updated_at') THEN ALTER TABLE projects ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()); END IF; END $$;

-- =====================================================
-- 3. CREATE PROJECT TEAM MEMBERS TABLE WITH CHECKS
-- =====================================================

-- Create base table if not exists
CREATE TABLE IF NOT EXISTS project_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid()
);

-- Add each column individually
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_team_members' AND column_name = 'project_id') THEN ALTER TABLE project_team_members ADD COLUMN project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_team_members' AND column_name = 'team_member_id') THEN ALTER TABLE project_team_members ADD COLUMN team_member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_team_members' AND column_name = 'allocated_budget') THEN ALTER TABLE project_team_members ADD COLUMN allocated_budget DECIMAL(10, 2); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_team_members' AND column_name = 'total_paid') THEN ALTER TABLE project_team_members ADD COLUMN total_paid DECIMAL(10, 2) DEFAULT 0; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_team_members' AND column_name = 'status') THEN ALTER TABLE project_team_members ADD COLUMN status VARCHAR(50) DEFAULT 'active'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'project_team_members' AND column_name = 'assigned_at') THEN ALTER TABLE project_team_members ADD COLUMN assigned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()); END IF; END $$;

-- Add unique constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_team_members_project_team_unique') THEN
    ALTER TABLE project_team_members ADD CONSTRAINT project_team_members_project_team_unique UNIQUE(project_id, team_member_id);
  END IF;
END $$;

-- =====================================================
-- 4. UPDATE EXPENSES TABLE
-- =====================================================

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'project_id') THEN ALTER TABLE expenses ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'project_team_member_id') THEN ALTER TABLE expenses ADD COLUMN project_team_member_id UUID REFERENCES project_team_members(id) ON DELETE SET NULL; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'total_amount') THEN ALTER TABLE expenses ADD COLUMN total_amount DECIMAL(10, 2); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'paid_amount') THEN ALTER TABLE expenses ADD COLUMN paid_amount DECIMAL(10, 2) DEFAULT 0; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'expenses' AND column_name = 'payment_status') THEN ALTER TABLE expenses ADD COLUMN payment_status VARCHAR(20); END IF; END $$;

-- Add check constraint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'expenses_payment_status_check') THEN
    ALTER TABLE expenses ADD CONSTRAINT expenses_payment_status_check CHECK (payment_status IN ('pending', 'partial', 'completed'));
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

DROP POLICY IF EXISTS "View org and assigned projects" ON projects;
CREATE POLICY "View org and assigned projects" ON projects FOR SELECT USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())
  OR id IN (SELECT project_id FROM project_team_members WHERE team_member_id = auth.uid())
);

DROP POLICY IF EXISTS "Owners manage projects" ON projects;
CREATE POLICY "Owners manage projects" ON projects FOR ALL USING (
  organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
);

DROP POLICY IF EXISTS "View project team" ON project_team_members;
CREATE POLICY "View project team" ON project_team_members FOR SELECT USING (
  project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()))
  OR team_member_id = auth.uid()
);

DROP POLICY IF EXISTS "Owners manage team" ON project_team_members;
CREATE POLICY "Owners manage team" ON project_team_members FOR ALL USING (
  project_id IN (SELECT id FROM projects WHERE organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin')))
);

-- =====================================================
-- 7. AUTO-UPDATE TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_project_totals()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.project_id IS NOT NULL THEN
      UPDATE projects SET total_paid = (SELECT COALESCE(SUM(COALESCE(paid_amount, amount)), 0) FROM expenses WHERE project_id = OLD.project_id), updated_at = TIMEZONE('utc', NOW()) WHERE id = OLD.project_id;
      IF OLD.project_team_member_id IS NOT NULL THEN
        UPDATE project_team_members SET total_paid = (SELECT COALESCE(SUM(COALESCE(paid_amount, amount)), 0) FROM expenses WHERE project_team_member_id = OLD.project_team_member_id) WHERE id = OLD.project_team_member_id;
      END IF;
    END IF;
    RETURN OLD;
  ELSE
    IF NEW.project_id IS NOT NULL THEN
      UPDATE projects SET total_paid = (SELECT COALESCE(SUM(COALESCE(paid_amount, amount)), 0) FROM expenses WHERE project_id = NEW.project_id), updated_at = TIMEZONE('utc', NOW()) WHERE id = NEW.project_id;
      IF NEW.project_team_member_id IS NOT NULL THEN
        UPDATE project_team_members SET total_paid = (SELECT COALESCE(SUM(COALESCE(paid_amount, amount)), 0) FROM expenses WHERE project_team_member_id = NEW.project_team_member_id) WHERE id = NEW.project_team_member_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_totals ON expenses;
CREATE TRIGGER trigger_update_project_totals AFTER INSERT OR UPDATE OR DELETE ON expenses FOR EACH ROW EXECUTE FUNCTION update_project_totals();

-- =====================================================
-- 8. HELPFUL VIEWS
-- =====================================================

CREATE OR REPLACE VIEW my_assigned_projects AS
SELECT 
  p.*,
  c.name AS client_name,
  ptm.allocated_budget,
  ptm.total_paid AS team_member_total_paid,
  (ptm.allocated_budget - ptm.total_paid) AS team_member_pending
FROM projects p
JOIN clients c ON p.client_id = c.id
JOIN project_team_members ptm ON p.id = ptm.project_id
WHERE ptm.status = 'active';

CREATE OR REPLACE VIEW project_summary AS
SELECT p.*, c.name as client_name, COUNT(DISTINCT ptm.id) as team_count, (p.budget - p.total_paid) as pending
FROM projects p
JOIN clients c ON p.client_id = c.id
LEFT JOIN project_team_members ptm ON p.id = ptm.project_id AND ptm.status = 'active'
GROUP BY p.id, c.name;

DO $$ BEGIN GRANT SELECT ON my_assigned_projects TO authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN GRANT SELECT ON project_summary TO authenticated; EXCEPTION WHEN undefined_object THEN NULL; END $$;

-- =====================================================
-- SUCCESS!
-- =====================================================

DO $$ BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '✅ Run this query to test: SELECT * FROM projects LIMIT 1;';
END $$;
