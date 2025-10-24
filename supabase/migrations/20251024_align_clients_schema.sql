-- Migration: Align clients table to app schema
-- Adds new app fields (if missing) and removes legacy fields
-- Safe / idempotent: uses IF EXISTS / IF NOT EXISTS

BEGIN;

-- Add new columns used by the app
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS project_description TEXT,
  ADD COLUMN IF NOT EXISTS budget DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'important',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now());

-- Drop legacy columns that are no longer used by the app
-- (These are dropped only if they exist; this is destructive for those columns)
ALTER TABLE public.clients
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS company,
  DROP COLUMN IF EXISTS tags,
  DROP COLUMN IF EXISTS notes;

-- Recreate/ensure the status check constraint matches the app
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_status_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_status_check CHECK (status IN ('general', 'important', 'working', 'finished'));

-- Ensure existing rows have a non-null status
UPDATE public.clients
SET status = 'important'
WHERE status IS NULL;

-- Set updated_at for existing rows if null
UPDATE public.clients
SET updated_at = timezone('utc', now())
WHERE updated_at IS NULL;

COMMIT;

-- Verification queries (for convenience; run separately if desired):
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'clients' ORDER BY ordinal_position;
-- SELECT id, user_id, name, phone, project_description, budget, status, created_at, updated_at FROM public.clients LIMIT 5;
