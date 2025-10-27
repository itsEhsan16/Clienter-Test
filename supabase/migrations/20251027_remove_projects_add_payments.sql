-- Migration: Remove projects table, add payment fields to clients, update statuses
-- Date: 2025-10-27

BEGIN;

-- Add payment fields to clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS advance_paid DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10,2);

-- Update status check constraint to three statuses
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_status_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_status_check CHECK (status IN ('prospect', 'active', 'completed'));

-- Update existing statuses to match new ones
UPDATE public.clients
SET status = CASE
  WHEN status = 'general' THEN 'prospect'
  WHEN status = 'important' THEN 'prospect'
  WHEN status = 'working' THEN 'active'
  WHEN status = 'finished' THEN 'completed'
  ELSE 'prospect'
END;

-- Remove project_id from meetings
ALTER TABLE public.meetings
  DROP COLUMN IF EXISTS project_id;

-- Drop projects table
DROP TABLE IF EXISTS public.projects CASCADE;

-- Update indexes: remove project-related indexes
DROP INDEX IF EXISTS projects_client_id_idx;
DROP INDEX IF EXISTS projects_user_id_idx;
DROP INDEX IF EXISTS meetings_project_id_idx;

-- Add index for clients status if not exists
CREATE INDEX IF NOT EXISTS clients_status_idx ON clients(status);

COMMIT;