-- Migration: Add missing columns to project_team_members
-- Added: role, allocated_budget

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_team_members' AND column_name = 'role'
  ) THEN
    ALTER TABLE project_team_members ADD COLUMN role VARCHAR(100);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_team_members' AND column_name = 'allocated_budget'
  ) THEN
    ALTER TABLE project_team_members ADD COLUMN allocated_budget DECIMAL(10, 2);
  END IF;
END $$;

-- Ensure total_paid exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_team_members' AND column_name = 'total_paid'
  ) THEN
    ALTER TABLE project_team_members ADD COLUMN total_paid DECIMAL(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Ensure status exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_team_members' AND column_name = 'status'
  ) THEN
    ALTER TABLE project_team_members ADD COLUMN status VARCHAR(50) DEFAULT 'active';
  END IF;
END $$;
