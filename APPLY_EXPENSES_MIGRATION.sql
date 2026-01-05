-- =========================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- Migration: Enhanced Expenses System with Team Payments
-- =========================================

-- This combines both migration files for easy execution
-- Copy and paste this entire file into Supabase SQL Editor and run

-- =====================================================
-- PART 1: ENHANCE EXPENSES SCHEMA
-- =====================================================

-- Expense type enum
DO $$ BEGIN
  CREATE TYPE expense_type AS ENUM ('team', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Payment status for tracking
DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'completed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to expenses table
ALTER TABLE expenses 
  ADD COLUMN IF NOT EXISTS expense_type expense_type NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add constraints
DO $$ BEGIN
  ALTER TABLE expenses 
    ADD CONSTRAINT check_team_expense_has_member 
    CHECK (
      (expense_type = 'team' AND team_member_id IS NOT NULL) OR
      (expense_type = 'other' AND team_member_id IS NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE expenses 
    ADD CONSTRAINT check_team_expense_has_total 
    CHECK (
      (expense_type = 'team' AND total_amount IS NOT NULL) OR
      (expense_type = 'other')
    );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create team payment records table
CREATE TABLE IF NOT EXISTS team_payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_type VARCHAR(50) DEFAULT 'regular',
  payment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_expenses_expense_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_team_member ON expenses(team_member_id);
CREATE INDEX IF NOT EXISTS idx_expenses_organization ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_status ON expenses(payment_status);
CREATE INDEX IF NOT EXISTS idx_expenses_team_member_status ON expenses(team_member_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_team_payment_records_expense ON team_payment_records(expense_id);
CREATE INDEX IF NOT EXISTS idx_team_payment_records_created_by ON team_payment_records(created_by);
CREATE INDEX IF NOT EXISTS idx_team_payment_records_payment_date ON team_payment_records(payment_date DESC);

-- Update RLS policies for expenses
DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view own expenses and org expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert expenses in their org" ON expenses;

CREATE POLICY "Users can view own expenses and org expenses" 
  ON expenses FOR SELECT 
  USING (
    user_id = auth.uid() OR
    team_member_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert expenses in their org" 
  ON expenses FOR INSERT 
  WITH CHECK (
    user_id = auth.uid() AND
    (organization_id IS NULL OR organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can update own expenses" 
  ON expenses FOR UPDATE 
  USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can delete own expenses" 
  ON expenses FOR DELETE 
  USING (
    user_id = auth.uid() OR
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- RLS policies for team_payment_records
ALTER TABLE team_payment_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view payment records in their org" ON team_payment_records;
DROP POLICY IF EXISTS "Users can insert payment records for their org expenses" ON team_payment_records;
DROP POLICY IF EXISTS "Users can update payment records in their org" ON team_payment_records;
DROP POLICY IF EXISTS "Users can delete payment records in their org" ON team_payment_records;

CREATE POLICY "Users can view payment records in their org" 
  ON team_payment_records FOR SELECT 
  USING (
    expense_id IN (
      SELECT id FROM expenses 
      WHERE user_id = auth.uid() OR 
      team_member_id = auth.uid() OR
      organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert payment records for their org expenses" 
  ON team_payment_records FOR INSERT 
  WITH CHECK (
    created_by = auth.uid() AND
    expense_id IN (
      SELECT id FROM expenses 
      WHERE user_id = auth.uid() OR 
      organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY "Users can update payment records in their org" 
  ON team_payment_records FOR UPDATE 
  USING (
    expense_id IN (
      SELECT id FROM expenses 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

CREATE POLICY "Users can delete payment records in their org" 
  ON team_payment_records FOR DELETE 
  USING (
    expense_id IN (
      SELECT id FROM expenses 
      WHERE organization_id IN (
        SELECT organization_id 
        FROM organization_members 
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- Function to automatically update paid_amount
CREATE OR REPLACE FUNCTION update_expense_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE expenses
  SET 
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM team_payment_records
      WHERE expense_id = COALESCE(NEW.expense_id, OLD.expense_id)
    ),
    payment_status = CASE
      WHEN (
        SELECT COALESCE(SUM(amount), 0)
        FROM team_payment_records
        WHERE expense_id = COALESCE(NEW.expense_id, OLD.expense_id)
      ) = 0 THEN 'pending'
      WHEN (
        SELECT COALESCE(SUM(amount), 0)
        FROM team_payment_records
        WHERE expense_id = COALESCE(NEW.expense_id, OLD.expense_id)
      ) >= total_amount THEN 'completed'
      ELSE 'partial'
    END,
    updated_at = TIMEZONE('utc', NOW())
  WHERE id = COALESCE(NEW.expense_id, OLD.expense_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_expense_paid_amount ON team_payment_records;
CREATE TRIGGER trigger_update_expense_paid_amount
  AFTER INSERT OR UPDATE OR DELETE ON team_payment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_expense_paid_amount();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_team_payment_records_updated_at ON team_payment_records;
CREATE TRIGGER trigger_team_payment_records_updated_at
  BEFORE UPDATE ON team_payment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_expenses_updated_at ON expenses;
CREATE TRIGGER trigger_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create views
CREATE OR REPLACE VIEW team_member_earnings AS
SELECT 
  e.team_member_id,
  p.email,
  p.full_name,
  COUNT(e.id) as total_projects,
  SUM(e.total_amount) as total_earned,
  SUM(e.paid_amount) as total_received,
  SUM(e.total_amount - e.paid_amount) as total_pending,
  e.organization_id
FROM expenses e
JOIN profiles p ON e.team_member_id = p.id
WHERE e.expense_type = 'team'
GROUP BY e.team_member_id, p.email, p.full_name, e.organization_id;

CREATE OR REPLACE VIEW expense_details AS
SELECT 
  e.*,
  p.email as team_member_email,
  p.full_name as team_member_name,
  (e.total_amount - e.paid_amount) as pending_amount,
  CASE 
    WHEN e.expense_type = 'team' THEN (
      SELECT COUNT(*) 
      FROM team_payment_records 
      WHERE expense_id = e.id
    )
    ELSE 0
  END as payment_count
FROM expenses e
LEFT JOIN profiles p ON e.team_member_id = p.id;

GRANT SELECT ON team_member_earnings TO authenticated;
GRANT SELECT ON expense_details TO authenticated;

-- =====================================================
-- PART 2: MIGRATE EXISTING DATA
-- =====================================================

-- Update organization_id for existing expenses
UPDATE expenses e
SET organization_id = (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = e.user_id 
  LIMIT 1
)
WHERE organization_id IS NULL;

-- Mark all existing expenses as 'other' type (safe default)
UPDATE expenses
SET expense_type = 'other'
WHERE expense_type IS NULL;

-- Helper function for manual migration
CREATE OR REPLACE FUNCTION migrate_expense_to_team(
  p_expense_id UUID,
  p_team_member_id UUID,
  p_project_name TEXT DEFAULT NULL,
  p_total_amount DECIMAL DEFAULT NULL,
  p_initial_payment_amount DECIMAL DEFAULT NULL,
  p_payment_type VARCHAR DEFAULT 'advance'
)
RETURNS JSON AS $$
DECLARE
  v_expense RECORD;
  v_payment_record_id UUID;
BEGIN
  SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Expense not found');
  END IF;
  
  UPDATE expenses
  SET 
    expense_type = 'team',
    team_member_id = p_team_member_id,
    project_name = COALESCE(p_project_name, description),
    total_amount = COALESCE(p_total_amount, amount),
    paid_amount = COALESCE(p_initial_payment_amount, 0),
    payment_status = CASE 
      WHEN COALESCE(p_initial_payment_amount, 0) = 0 THEN 'pending'
      WHEN COALESCE(p_initial_payment_amount, 0) >= COALESCE(p_total_amount, amount) THEN 'completed'
      ELSE 'partial'
    END,
    description = 'Migrated: ' || description
  WHERE id = p_expense_id;
  
  IF p_initial_payment_amount IS NOT NULL AND p_initial_payment_amount > 0 THEN
    INSERT INTO team_payment_records (expense_id, amount, payment_type, payment_date, notes, created_by)
    VALUES (p_expense_id, p_initial_payment_amount, p_payment_type, v_expense.created_at::DATE, 
            'Initial payment (migrated)', v_expense.user_id)
    RETURNING id INTO v_payment_record_id;
  END IF;
  
  RETURN json_build_object('success', true, 'expense_id', p_expense_id, 'payment_record_id', v_payment_record_id);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these to verify the migration worked:

-- Check expense types
-- SELECT expense_type, COUNT(*) FROM expenses GROUP BY expense_type;

-- Check team member earnings view
-- SELECT * FROM team_member_earnings;

-- Check expense details
-- SELECT * FROM expense_details WHERE expense_type = 'team';

-- =====================================================
-- SUCCESS!
-- =====================================================

-- Migration completed successfully!
-- You can now:
-- 1. Go to /expenses page
-- 2. Add team member payments
-- 3. Record multiple payments per project
-- 4. Team members will see their earnings in dashboard
