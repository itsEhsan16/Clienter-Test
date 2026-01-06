-- COMPLETE FIX: Apply All Account Type Migrations
-- Run this in Supabase SQL Editor to apply all changes at once
-- This ensures proper separation between agency owners and team members

-- =============================================================================
-- STEP 1: Add account_type enum and column to profiles
-- =============================================================================

-- Create account_type enum if it doesn't exist
DO $$ BEGIN
  CREATE TYPE account_type AS ENUM ('owner', 'team_member');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add account_type column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE profiles ADD COLUMN account_type account_type DEFAULT 'owner' NOT NULL;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON profiles(account_type);

-- =============================================================================
-- STEP 2: Update existing profiles with correct account_type
-- =============================================================================

-- First, set everyone to 'owner' by default
UPDATE profiles
SET account_type = 'owner'
WHERE account_type IS NULL OR account_type = 'owner';

-- Then, identify and mark team members
-- Team members are users who:
-- 1. Are in organization_members table
-- 2. Are NOT the owner of any organization
UPDATE profiles
SET account_type = 'team_member'
WHERE id IN (
  SELECT DISTINCT om.user_id
  FROM organization_members om
  LEFT JOIN organizations o ON om.user_id = o.owner_id
  WHERE o.id IS NULL  -- Not an owner of any organization
);

-- =============================================================================
-- STEP 3: Update the handle_new_user trigger
-- =============================================================================

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Recreate function with account_type='owner' for all signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- All signups through Supabase auth are agency owners
  -- Team members are created via API with account_type='team_member'
  INSERT INTO public.profiles (id, email, full_name, currency, account_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    'INR',
    'owner'  -- All signups are agency owners by default
  )
  ON CONFLICT (id) DO UPDATE 
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- STEP 4: Add comments for documentation
-- =============================================================================

COMMENT ON TYPE account_type IS 'Account type: owner (signs up independently) or team_member (created by owner)';
COMMENT ON COLUMN profiles.account_type IS 'Determines login access: owners use /login, team_members use /team-login';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Run these to verify the migration worked correctly:

-- 1. Check account_type distribution
-- SELECT account_type, COUNT(*) as count FROM profiles GROUP BY account_type;

-- 2. Verify team members are marked correctly
-- SELECT p.email, p.account_type, om.role 
-- FROM profiles p 
-- LEFT JOIN organization_members om ON p.id = om.user_id
-- ORDER BY p.account_type, p.email;

-- 3. Check for any profiles without account_type (should be 0)
-- SELECT COUNT(*) as profiles_without_account_type FROM profiles WHERE account_type IS NULL;

-- Migration completed successfully!
-- Uncomment and run the verification queries above to confirm everything is correct.
