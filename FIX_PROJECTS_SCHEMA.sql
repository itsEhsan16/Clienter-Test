-- ====================================================================
-- FIX PROJECTS TABLE SCHEMA - Add Missing Columns
-- Run this in Supabase SQL Editor
-- ====================================================================

-- Add start_date column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'projects'
      AND column_name  = 'start_date'
  ) THEN
    ALTER TABLE public.projects
      ADD COLUMN start_date DATE;
    RAISE NOTICE 'Added start_date column to projects table';
  ELSE
    RAISE NOTICE 'start_date column already exists in projects table';
  END IF;
END $$;

-- Add deadline column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'projects'
      AND column_name  = 'deadline'
  ) THEN
    ALTER TABLE public.projects
      ADD COLUMN deadline DATE;
    RAISE NOTICE 'Added deadline column to projects table';
  ELSE
    RAISE NOTICE 'deadline column already exists in projects table';
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_start_date ON public.projects(start_date);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON public.projects(deadline);

-- Verify the columns exist
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'projects'
  AND column_name IN ('start_date', 'deadline')
ORDER BY column_name;
