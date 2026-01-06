# Fix Expenses Page - Missing Database Columns

## Problem

The expenses page is failing because the frontend code expects columns that don't exist in the database:

- `title` (only `description` exists)
- `date` (only `created_at` exists)
- `category` (doesn't exist)

Also, the code was trying to access `company_name` from clients table which doesn't exist.

## Solutions Applied

### 1. Fixed Client Company Name References

✅ Removed references to `clients.company_name` from queries and UI
✅ Updated TypeScript interfaces to match actual database schema
✅ Now displays only `clients.name`

### 2. Created Migration for Missing Columns

Created migration file: `supabase/migrations/20260106_add_missing_expense_columns.sql`

## How to Apply the Fix

### Step 1: Apply Database Migration

Go to your Supabase SQL Editor:
https://supabase.com/dashboard/project/zviakkdqtmhqfkxjjqvn/sql/new

Copy and paste the following SQL:

\`\`\`sql
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
\`\`\`

### Step 2: Refresh the Page

After applying the migration:

1. Close the browser devtools errors
2. Refresh the expenses page (http://localhost:3001/expenses)
3. The errors should be resolved

## What Was Changed

### Files Modified:

1. **src/app/expenses/page.tsx**
   - Removed `company_name` from TypeScript interfaces
   - Updated `fetchAssignedProjects()` query to remove `company_name`
   - Updated `fetchExpenses()` query to remove `company_name`
   - Updated UI to display only `clients.name`

### Files Created:

1. **supabase/migrations/20260106_add_missing_expense_columns.sql**
   - Adds `title`, `date`, and `category` columns to expenses table
   - Migrates existing data (copies `description` to `title`)
   - Adds appropriate indexes

## Database Schema After Fix

The expenses table will have:

- `id` UUID PRIMARY KEY
- `user_id` UUID
- `organization_id` UUID
- `title` TEXT NOT NULL ← **NEW**
- `description` TEXT
- `amount` DECIMAL
- `date` DATE ← **NEW**
- `category` TEXT ← **NEW**
- `expense_type` (team/other)
- `team_member_id` UUID
- `project_id` UUID
- `project_team_member_id` UUID
- `total_amount` DECIMAL
- `paid_amount` DECIMAL
- `payment_status` (pending/partial/completed)
- `created_at` TIMESTAMP
- `updated_at` TIMESTAMP

## Next Steps

Once the migration is applied, the expenses page should load without errors and you'll be able to:

- View existing expenses
- Add new team payments
- Track payment status
- Manage project expenses
