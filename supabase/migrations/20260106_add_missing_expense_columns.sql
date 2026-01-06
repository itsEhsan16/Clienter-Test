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
