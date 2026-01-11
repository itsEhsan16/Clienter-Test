-- ====================================================================
-- PROJECT-BASED ARCHITECTURE MIGRATION
-- Date: 2026-01-07
-- Purpose: Transform from client-centric to project-centric financial tracking
-- ====================================================================

-- This migration:
-- 1. Removes client financial fields (budget, advance_paid, total_amount, payments, status, project_description)
-- 2. Recreates project_status enum with only 3 statuses (new, ongoing, completed)
-- 3. Adds order field to projects for Kanban sorting
-- 4. Creates project_payments table for payment tracking
-- 5. Migrates existing client data to projects (one project per client)
-- 6. Sets up triggers for auto-calculating total_paid
-- 7. Adds indexes and RLS policies

BEGIN;

-- =====================================================
-- STEP 1: DELETE ALL EXISTING PROJECTS (Fresh Start)
-- =====================================================

-- Delete related records only if tables exist
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_updates') THEN
    DELETE FROM project_updates WHERE project_id IN (SELECT id FROM projects);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_tasks') THEN
    DELETE FROM project_tasks WHERE project_id IN (SELECT id FROM projects);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'project_team_members') THEN
    DELETE FROM project_team_members WHERE project_id IN (SELECT id FROM projects);
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
    DELETE FROM expenses WHERE project_id IN (SELECT id FROM projects);
  END IF;
END $$;

DELETE FROM projects WHERE true;

-- =====================================================
-- STEP 2: RECREATE PROJECT STATUS ENUM (3 Statuses Only)
-- =====================================================

-- Drop ALL views that depend on projects.status column
DROP VIEW IF EXISTS my_assigned_projects CASCADE;
DROP VIEW IF EXISTS project_summary CASCADE;
DROP VIEW IF EXISTS team_member_projects CASCADE;
DROP VIEW IF EXISTS client_projects_summary CASCADE;

-- Drop existing enum and recreate with only 3 statuses
ALTER TABLE projects ALTER COLUMN status TYPE VARCHAR(50);
DROP TYPE IF EXISTS project_status CASCADE;
CREATE TYPE project_status AS ENUM ('new', 'ongoing', 'completed');
ALTER TABLE projects ALTER COLUMN status TYPE project_status USING 
  CASE 
    WHEN status IN ('planning') THEN 'new'::project_status
    WHEN status IN ('in_progress', 'on_hold') THEN 'ongoing'::project_status
    WHEN status IN ('completed', 'cancelled') THEN 'completed'::project_status
    ELSE 'new'::project_status
  END;

-- Update default status
ALTER TABLE projects ALTER COLUMN status SET DEFAULT 'new'::project_status;

-- Recreate views with new status enum
CREATE OR REPLACE VIEW my_assigned_projects AS
SELECT 
  p.*,
  c.name as client_name,
  c.phone as client_phone,
  ptm.allocated_budget as my_allocated_budget,
  ptm.total_paid as my_total_paid
FROM projects p
JOIN project_team_members ptm ON ptm.project_id = p.id
JOIN clients c ON c.id = p.client_id
WHERE ptm.team_member_id = auth.uid();

CREATE OR REPLACE VIEW project_summary AS
SELECT 
  p.id,
  p.name,
  p.description,
  p.status,
  p.budget,
  p.total_paid,
  p.organization_id,
  c.id as client_id,
  c.name as client_name,
  COUNT(DISTINCT ptm.id) as team_member_count,
  COALESCE(p.budget, 0) - p.total_paid as pending_amount
FROM projects p
LEFT JOIN clients c ON c.id = p.client_id
LEFT JOIN project_team_members ptm ON ptm.project_id = p.id
GROUP BY p.id, c.id;

-- =====================================================
-- STEP 3: ADD ORDER FIELD TO PROJECTS (For Kanban Sorting)
-- =====================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 0;

-- Set initial order based on created_at
UPDATE projects SET "order" = row_number FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY status ORDER BY created_at) - 1 as row_number
  FROM projects
) sub WHERE projects.id = sub.id;

-- =====================================================
-- STEP 4: CREATE PROJECT_PAYMENTS TABLE
-- =====================================================

-- Payment type enum
DO $$ BEGIN
  CREATE TYPE payment_type AS ENUM ('advance', 'milestone', 'regular', 'final');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Project payments table
CREATE TABLE IF NOT EXISTS project_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  
  -- Payment details
  amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_type payment_type NOT NULL DEFAULT 'regular',
  notes TEXT,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================
-- STEP 5: CREATE TRIGGER TO AUTO-UPDATE PROJECTS.TOTAL_PAID
-- =====================================================

-- Function to calculate total_paid from project_payments
CREATE OR REPLACE FUNCTION update_project_total_paid()
RETURNS TRIGGER AS $$
BEGIN
  -- Recalculate total_paid for the affected project
  UPDATE projects 
  SET total_paid = COALESCE((
    SELECT SUM(amount) 
    FROM project_payments 
    WHERE project_id = COALESCE(NEW.project_id, OLD.project_id)
  ), 0),
  updated_at = NOW()
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT, UPDATE, DELETE of project_payments
DROP TRIGGER IF EXISTS trigger_update_project_total_paid ON project_payments;
CREATE TRIGGER trigger_update_project_total_paid
  AFTER INSERT OR UPDATE OR DELETE ON project_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_project_total_paid();

-- =====================================================
-- STEP 6: MIGRATE EXISTING CLIENT DATA TO PROJECTS
-- =====================================================

-- Create one project per client with their payment data
INSERT INTO projects (
  client_id, 
  organization_id, 
  name, 
  description, 
  status, 
  budget, 
  total_paid,
  created_by,
  created_at,
  "order"
)
SELECT 
  c.id as client_id,
  c.organization_id,
  c.name || '-project' as name,
  NULL as description,
  'new'::project_status as status,
  0 as budget,
  0 as total_paid,
  c.user_id as created_by,
  c.created_at,
  0 as "order"
FROM clients c
WHERE NOT EXISTS (
  SELECT 1 FROM projects p WHERE p.client_id = c.id
);

-- Migrate payments from clients.payments JSONB to project_payments table
INSERT INTO project_payments (
  project_id,
  amount,
  payment_date,
  payment_type,
  notes,
  created_by,
  created_at
)
SELECT 
  p.id as project_id,
  (payment->>'amount')::DECIMAL(10, 2) as amount,
  COALESCE(
    (payment->>'created_at')::TIMESTAMP WITH TIME ZONE,
    c.created_at
  )::DATE as payment_date,
  CASE 
    WHEN payment_index = 0 THEN 'advance'::payment_type
    ELSE 'regular'::payment_type
  END as payment_type,
  payment->>'name' as notes,
  c.user_id as created_by,
  COALESCE(
    (payment->>'created_at')::TIMESTAMP WITH TIME ZONE,
    c.created_at
  ) as created_at
FROM clients c
JOIN projects p ON p.client_id = c.id AND p.name = c.name || '-project'
CROSS JOIN LATERAL jsonb_array_elements(
  COALESCE(
    CASE 
      WHEN jsonb_typeof(c.payments) = 'array' THEN c.payments
      ELSE '[]'::jsonb
    END,
    '[]'::jsonb
  )
) WITH ORDINALITY AS t(payment, payment_index)
WHERE EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'clients' AND column_name = 'payments'
)
AND c.payments IS NOT NULL 
AND jsonb_typeof(c.payments) = 'array'
AND jsonb_array_length(c.payments) > 0;

-- Update project order within each status
UPDATE projects SET "order" = row_number FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY status ORDER BY created_at) - 1 as row_number
  FROM projects
) sub WHERE projects.id = sub.id;

-- =====================================================
-- STEP 7: REMOVE CLIENT FINANCIAL FIELDS
-- =====================================================

-- Drop financial columns from clients (we're now project-based)
ALTER TABLE clients DROP COLUMN IF EXISTS budget CASCADE;
ALTER TABLE clients DROP COLUMN IF EXISTS advance_paid CASCADE;
ALTER TABLE clients DROP COLUMN IF EXISTS total_amount CASCADE;
ALTER TABLE clients DROP COLUMN IF EXISTS payments CASCADE;
ALTER TABLE clients DROP COLUMN IF EXISTS project_description CASCADE;
ALTER TABLE clients DROP COLUMN IF EXISTS status CASCADE;

-- Drop the old status check constraint if exists
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;

-- =====================================================
-- STEP 8: ADD INDEXES FOR PERFORMANCE
-- =====================================================

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_status_order ON projects(status, "order");
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- Project payments indexes
CREATE INDEX IF NOT EXISTS idx_project_payments_project_id ON project_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_payments_created_by ON project_payments(created_by);
CREATE INDEX IF NOT EXISTS idx_project_payments_payment_date ON project_payments(payment_date);

-- =====================================================
-- STEP 9: SET UP ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on project_payments
ALTER TABLE project_payments ENABLE ROW LEVEL SECURITY;

-- Project Payments Policies (Organization-based access)
CREATE POLICY "project_payments_select_policy" ON project_payments
  FOR SELECT USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "project_payments_insert_policy" ON project_payments
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY "project_payments_update_policy" ON project_payments
  FOR UPDATE USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY "project_payments_delete_policy" ON project_payments
  FOR DELETE USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() 
        AND role IN ('owner', 'admin')
      )
    )
  );

-- =====================================================
-- STEP 10: UPDATE UPDATED_AT TRIGGER FOR PROJECT_PAYMENTS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON project_payments;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON project_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ====================================================================
-- MIGRATION COMPLETE
-- ====================================================================
-- Summary:
-- ✅ Project status enum now has 3 statuses: new, ongoing, completed
-- ✅ Projects have order field for Kanban sorting
-- ✅ Created project_payments table with auto-calculation triggers
-- ✅ Migrated all client payment data to project-level
-- ✅ Removed client financial fields (budget, payments, status, etc.)
-- ✅ Added indexes for performance
-- ✅ Set up RLS policies for multi-tenant security
-- ====================================================================
