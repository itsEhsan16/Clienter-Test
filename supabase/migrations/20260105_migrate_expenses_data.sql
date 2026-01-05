-- Data Migration: Migrate existing expenses to new enhanced system
-- Created: 2026-01-05
-- Purpose: Analyze existing expenses and categorize them as team or other expenses

-- =====================================================
-- STEP 1: Set organization_id for existing expenses
-- =====================================================

-- Update all existing expenses to have organization_id from the user's organization
UPDATE expenses e
SET organization_id = (
  SELECT om.organization_id 
  FROM organization_members om 
  WHERE om.user_id = e.user_id 
  LIMIT 1
)
WHERE organization_id IS NULL;

-- =====================================================
-- STEP 2: Analyze and categorize existing expenses
-- =====================================================

-- Common team-related keywords that indicate payment to team members
-- These will be classified as team expenses if they match
-- Pattern matching for team member payments (common names, roles, salary keywords)

-- First, let's identify potential team expenses based on description
-- This is a conservative approach - we'll mark as 'other' by default
-- and only mark as 'team' if description explicitly mentions team/salary/payment keywords

DO $$
DECLARE
  expense_record RECORD;
  team_keywords TEXT[] := ARRAY[
    'salary', 'payment to', 'paid to', 'designer payment', 'developer payment',
    'freelancer', 'contractor', 'team member', 'employee', 'staff',
    'advance payment', 'project payment', 'milestone payment'
  ];
  keyword TEXT;
  is_team_expense BOOLEAN;
BEGIN
  -- Loop through all existing expenses
  FOR expense_record IN 
    SELECT id, description, amount, user_id, organization_id
    FROM expenses 
    WHERE expense_type = 'other' -- Only process expenses that haven't been categorized
  LOOP
    is_team_expense := FALSE;
    
    -- Check if description contains team-related keywords
    FOREACH keyword IN ARRAY team_keywords
    LOOP
      IF LOWER(expense_record.description) LIKE '%' || keyword || '%' THEN
        is_team_expense := TRUE;
        EXIT;
      END IF;
    END LOOP;
    
    -- If it's a team expense, we'll leave it as 'other' for now
    -- The user will need to manually assign team members through the UI
    -- We'll just add a note in the description if it looks like a team expense
    IF is_team_expense THEN
      UPDATE expenses 
      SET 
        description = expense_record.description || ' [Potential team expense - please assign team member]',
        project_name = 'Legacy expense - please review'
      WHERE id = expense_record.id;
    END IF;
  END LOOP;
END $$;

-- =====================================================
-- STEP 3: Mark expenses as 'other' explicitly
-- =====================================================

-- For safety, ensure all expenses without a team_member_id are marked as 'other'
UPDATE expenses
SET expense_type = 'other'
WHERE team_member_id IS NULL AND expense_type != 'other';

-- =====================================================
-- STEP 4: Create helper function for manual migration
-- =====================================================

-- Function to help migrate a specific expense to team expense
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
  v_result JSON;
BEGIN
  -- Get the expense
  SELECT * INTO v_expense FROM expenses WHERE id = p_expense_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Expense not found'
    );
  END IF;
  
  -- Update expense to team type
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
    description = 'Migrated from legacy expense: ' || description
  WHERE id = p_expense_id;
  
  -- If there's an initial payment, create a payment record
  IF p_initial_payment_amount IS NOT NULL AND p_initial_payment_amount > 0 THEN
    INSERT INTO team_payment_records (
      expense_id,
      amount,
      payment_type,
      payment_date,
      notes,
      created_by
    ) VALUES (
      p_expense_id,
      p_initial_payment_amount,
      p_payment_type,
      v_expense.created_at::DATE,
      'Initial payment (migrated from legacy expense)',
      v_expense.user_id
    ) RETURNING id INTO v_payment_record_id;
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'expense_id', p_expense_id,
    'payment_record_id', v_payment_record_id
  );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 5: Statistics and Report
-- =====================================================

-- View to see migration statistics
CREATE OR REPLACE VIEW expense_migration_report AS
SELECT 
  expense_type,
  COUNT(*) as total_count,
  SUM(amount) as total_amount,
  CASE 
    WHEN team_member_id IS NOT NULL THEN 'Assigned'
    WHEN description LIKE '%[Potential team expense%' THEN 'Needs Review'
    ELSE 'Regular Expense'
  END as migration_status
FROM expenses
GROUP BY expense_type, migration_status;

-- Grant access
GRANT SELECT ON expense_migration_report TO authenticated;

-- =====================================================
-- MANUAL MIGRATION EXAMPLES (for reference)
-- =====================================================

-- Example 1: Migrate a simple expense to team expense with full payment
-- SELECT migrate_expense_to_team(
--   p_expense_id := 'expense-uuid-here',
--   p_team_member_id := 'team-member-uuid-here',
--   p_project_name := 'Website Design Project',
--   p_total_amount := 50000.00,
--   p_initial_payment_amount := 50000.00,
--   p_payment_type := 'final'
-- );

-- Example 2: Migrate an expense with advance payment
-- SELECT migrate_expense_to_team(
--   p_expense_id := 'expense-uuid-here',
--   p_team_member_id := 'team-member-uuid-here',
--   p_project_name := 'Mobile App Development',
--   p_total_amount := 100000.00,
--   p_initial_payment_amount := 30000.00,
--   p_payment_type := 'advance'
-- );

-- =====================================================
-- NOTES
-- =====================================================

-- This migration takes a conservative approach:
-- 1. Existing expenses remain as 'other' type by default
-- 2. Potential team expenses are flagged for manual review
-- 3. A helper function is provided to easily migrate expenses through the UI
-- 4. The user can assign team members and create payment records through the new UI

-- To complete the migration:
-- 1. Run this migration script
-- 2. Review expenses marked with '[Potential team expense'
-- 3. Use the UI to properly categorize and assign team members
-- 4. Create payment records as needed

COMMENT ON FUNCTION migrate_expense_to_team IS 'Helper function to migrate legacy expenses to team expenses with proper payment tracking';
