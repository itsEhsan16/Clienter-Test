# Fix Project Creation Issue

## Problem

The database schema is missing or has issues with `start_date` and `deadline` columns in the `projects` table.

## Solution Options

### Option 1: Run SQL Script (RECOMMENDED)

1. Go to your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Open the file `FIX_PROJECTS_SCHEMA.sql`
4. Copy and paste its contents into the SQL Editor
5. Click **Run**
6. This will add the missing columns if they don't exist
7. Refresh your application

### Option 2: Remove Date Fields from Form (If you can't access Supabase)

If you cannot access Supabase SQL Editor, I can modify the code to remove the start_date and deadline fields from the project creation form.

## After Running the SQL

1. Restart your Next.js dev server:
   ```bash
   npm run dev
   ```
2. Try creating a project again
3. The error should be resolved

## Verification

After running the SQL script, you should see output like:

```
NOTICE: start_date column already exists in projects table
NOTICE: deadline column already exists in projects table
```

And then a table showing:

```
column_name | data_type | is_nullable
deadline    | date      | YES
start_date  | date      | YES
```
