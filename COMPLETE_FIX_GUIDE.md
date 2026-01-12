# COMPLETE FIX FOR PROJECT CREATION

## Issue

1. Infinite recursion in RLS policies for projects table
2. Missing `created_by` field in project insert (FIXED in code)
3. Possible missing `start_date` and `deadline` columns

## SOLUTION - Run This SQL Script

### Step 1: Open Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in the left sidebar

### Step 2: Copy and Run the SQL Script

Copy the entire contents of **`FIX_RLS_RECURSION.sql`** and paste into SQL Editor, then click **Run**.

The script will:

- ✅ Add missing `start_date` and `deadline` columns if they don't exist
- ✅ Drop all conflicting RLS policies
- ✅ Create clean, non-recursive RLS policies
- ✅ Verify the setup

### Step 3: Restart Your Application

```bash
# Stop the dev server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 4: Test Project Creation

1. Go to http://localhost:3000/projects/new
2. Fill in:
   - Project Name
   - Description
   - Select a Client
   - Set Budget
   - (Optional) Set Start Date and Deadline
3. Click "Create Project"
4. Should work without errors!

## Code Changes Already Made

✅ Fixed team member fetching (removed incorrect array access)
✅ Changed currency from $ to ₹
✅ Removed `company_name` from clients query
✅ Updated statuses to only: "new", "ongoing", "completed"
✅ Added `created_by` field to project insert
✅ Added organization validation checks

## What the SQL Script Does

```sql
-- Adds missing columns
ALTER TABLE projects ADD COLUMN start_date DATE;
ALTER TABLE projects ADD COLUMN deadline DATE;

-- Drops all old conflicting policies
DROP POLICY IF EXISTS ... (all variations)

-- Creates clean policies
CREATE POLICY "view_org_projects" ...   -- Users can view org projects
CREATE POLICY "insert_org_projects" ... -- Users can create projects
CREATE POLICY "update_org_projects" ... -- Users can update projects
CREATE POLICY "delete_org_projects" ... -- Owners can delete projects
```

## After Running SQL

You should see output like:

```
NOTICE: start_date column already exists
NOTICE: deadline column already exists
NOTICE: Projects RLS policies have been reset successfully!
```

Then a table showing all 4 policies:

- view_org_projects
- insert_org_projects
- update_org_projects
- delete_org_projects

## If Still Having Issues

1. Check browser console for specific error
2. Verify your user is a member of an organization:
   ```sql
   SELECT * FROM organization_members WHERE user_id = auth.uid();
   ```
3. Check if policies are active:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'projects';
   ```
