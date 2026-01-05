-- Migration: Add credentials storage for team members
-- Created: 2026-01-05
-- Purpose: Store password plainly for team members so owners can share credentials

-- Add password field to organization_members table
ALTER TABLE organization_members
ADD COLUMN IF NOT EXISTS password_for_sharing TEXT;

-- Add comment explaining this field
COMMENT ON COLUMN organization_members.password_for_sharing IS 'Plain text password for sharing with team members - not used for auth, just for reference';

-- No need to encrypt since owner will share these credentials anyway
-- The actual authentication still uses Supabase Auth securely
