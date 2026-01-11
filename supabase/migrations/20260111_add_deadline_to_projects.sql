-- Add deadline column to projects if missing
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
      ADD COLUMN deadline date;
  END IF;
END $$;

-- Create index on deadline to help ordering/filtering
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON public.projects(deadline);
