-- Migration: Add account_type to profiles table
-- Purpose: Distinguish between agency owners and team members at the profile level
-- This prevents team members from logging in as owners

-- Add account_type enum
CREATE TYPE account_type AS ENUM ('owner', 'team_member');

-- Add account_type column to profiles table
ALTER TABLE profiles
ADD COLUMN account_type account_type DEFAULT 'owner' NOT NULL;

-- Create index for faster lookups
CREATE INDEX idx_profiles_account_type ON profiles(account_type);

-- Update existing profiles to be 'owner' (all current users are owners)
UPDATE profiles
SET account_type = 'owner';

-- Set team members to 'team_member' based on organization_members table
-- Anyone who is in organization_members but is not the owner of an organization is a team member
UPDATE profiles
SET account_type = 'team_member'
WHERE id IN (
  SELECT DISTINCT om.user_id
  FROM organization_members om
  LEFT JOIN organizations o ON om.user_id = o.owner_id
  WHERE o.id IS NULL  -- Not an owner of any organization
);

-- Add comment to table
COMMENT ON COLUMN profiles.account_type IS 'Determines whether this is an agency owner or team member account. Owners sign up independently, team members are created by owners.';
