-- Migration: Enhanced Expenses System with Team Member Payments
-- Created: 2026-01-05
-- Purpose: Add expense types, team member payments tracking, and payment records

-- =====================================================
-- ENUMS
-- =====================================================

-- Expense type enum
CREATE TYPE expense_type AS ENUM ('team', 'other');

-- Payment status for tracking
CREATE TYPE payment_status AS ENUM ('pending', 'partial', 'completed');

-- =====================================================
-- MODIFY EXPENSES TABLE
-- =====================================================

-- Add new columns to expenses table
ALTER TABLE expenses 
  ADD COLUMN IF NOT EXISTS expense_type expense_type NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS team_member_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_name TEXT,
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status payment_status DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add constraint: team expenses must have team_member_id
ALTER TABLE expenses 
  ADD CONSTRAINT check_team_expense_has_member 
  CHECK (
    (expense_type = 'team' AND team_member_id IS NOT NULL) OR
    (expense_type = 'other' AND team_member_id IS NULL)
  );

-- Add constraint: if team expense, total_amount should be set
ALTER TABLE expenses 
  ADD CONSTRAINT check_team_expense_has_total 
  CHECK (
    (expense_type = 'team' AND total_amount IS NOT NULL) OR
    (expense_type = 'other')
  );

-- Update existing expenses to have organization_id
-- This will be set in the data migration script

-- =====================================================
-- CREATE TEAM PAYMENT RECORDS TABLE
-- =====================================================

-- Detailed payment records for team member expenses
CREATE TABLE team_payment_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_type VARCHAR(50) DEFAULT 'regular', -- 'advance', 'milestone', 'final', 'regular'
  payment_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Expenses indexes
CREATE INDEX IF NOT EXISTS idx_expenses_expense_type ON expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_team_member ON expenses(team_member_id);
CREATE INDEX IF NOT EXISTS idx_expenses_organization ON expenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payment_status ON expenses(payment_status);
CREATE INDEX IF NOT EXISTS idx_expenses_team_member_status ON expenses(team_member_id, payment_status);

-- Team payment records indexes
CREATE INDEX idx_team_payment_records_expense ON team_payment_records(expense_id);
CREATE INDEX idx_team_payment_records_created_by ON team_payment_records(created_by);
CREATE INDEX idx_team_payment_records_payment_date ON team_payment_records(payment_date DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Update RLS policies for expenses to include organization_id
DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;

-- New RLS policies for expenses
CREATE POLICY "Users can view own expenses and org expenses" 
  ON expenses FOR SELECT 
  USING (
    user_id = auth.uid() OR
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

CREATE POLICY "Users can view payment records in their org" 
  ON team_payment_records FOR SELECT 
  USING (
    expense_id IN (
      SELECT id FROM expenses 
      WHERE user_id = auth.uid() OR 
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

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to automatically update paid_amount when payment records change
CREATE OR REPLACE FUNCTION update_expense_paid_amount()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the expense's paid_amount by summing all payment records
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

-- Trigger to update paid_amount automatically
DROP TRIGGER IF EXISTS trigger_update_expense_paid_amount ON team_payment_records;
CREATE TRIGGER trigger_update_expense_paid_amount
  AFTER INSERT OR UPDATE OR DELETE ON team_payment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_expense_paid_amount();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for team_payment_records updated_at
DROP TRIGGER IF EXISTS trigger_team_payment_records_updated_at ON team_payment_records;
CREATE TRIGGER trigger_team_payment_records_updated_at
  BEFORE UPDATE ON team_payment_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for expenses updated_at
DROP TRIGGER IF EXISTS trigger_expenses_updated_at ON expenses;
CREATE TRIGGER trigger_expenses_updated_at
  BEFORE UPDATE ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS FOR EASY QUERYING
-- =====================================================

-- View for team member earnings summary
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

-- View for expense details with team member info
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

-- Grant access to views
GRANT SELECT ON team_member_earnings TO authenticated;
GRANT SELECT ON expense_details TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE expenses IS 'Tracks all expenses including team payments and other business expenses';
COMMENT ON TABLE team_payment_records IS 'Detailed payment records for team member expenses';
COMMENT ON COLUMN expenses.expense_type IS 'Type of expense: team (payment to team member) or other (business expense)';
COMMENT ON COLUMN expenses.team_member_id IS 'Reference to team member for team expenses';
COMMENT ON COLUMN expenses.total_amount IS 'Total amount to be paid for team expenses';
COMMENT ON COLUMN expenses.paid_amount IS 'Amount already paid (auto-calculated from payment records)';
COMMENT ON COLUMN expenses.payment_status IS 'Payment status: pending, partial, or completed';
COMMENT ON COLUMN team_payment_records.payment_type IS 'Type of payment: advance, milestone, final, or regular';
