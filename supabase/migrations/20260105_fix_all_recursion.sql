-- Fix infinite recursion in both organization_members AND organizations tables
-- The solution: Simple policies that don't create circular dependencies

-- =====================================================
-- FIX ORGANIZATIONS TABLE
-- =====================================================

-- Drop existing organization policies
DROP POLICY IF EXISTS "Members can view their organization" ON organizations;
DROP POLICY IF EXISTS "Owners can manage their organization" ON organizations;
DROP POLICY IF EXISTS "organization_members_can_view" ON organizations;

-- Simple policies for organizations table
CREATE POLICY "owners_view_own_org"
  ON organizations FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "owners_manage_own_org"
  ON organizations FOR ALL
  USING (owner_id = auth.uid());

CREATE POLICY "members_view_org"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- =====================================================
-- FIX ORGANIZATION_MEMBERS TABLE
-- =====================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Owners can manage all members" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Members can view own membership" ON organization_members;
DROP POLICY IF EXISTS "Users can view own membership" ON organization_members;
DROP POLICY IF EXISTS "Users can view org members" ON organization_members;
DROP POLICY IF EXISTS "Owners can manage members" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage non-owner members" ON organization_members;
DROP POLICY IF EXISTS "Users can create own membership" ON organization_members;
DROP POLICY IF EXISTS "own_membership_select" ON organization_members;
DROP POLICY IF EXISTS "owner_view_members" ON organization_members;
DROP POLICY IF EXISTS "admin_view_members" ON organization_members;
DROP POLICY IF EXISTS "owner_manage_members" ON organization_members;
DROP POLICY IF EXISTS "admin_manage_members" ON organization_members;
DROP POLICY IF EXISTS "admin_update_members" ON organization_members;
DROP POLICY IF EXISTS "admin_delete_members" ON organization_members;
DROP POLICY IF EXISTS "create_own_membership" ON organization_members;

-- Drop the helper function if it exists
DROP FUNCTION IF EXISTS public.get_user_org_role(uuid, uuid);

-- Simple non-recursive policies for organization_members

-- 1. Users can always view their own membership
CREATE POLICY "view_own_membership"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

-- 2. Users can view members in organizations they own
CREATE POLICY "owner_view_all_members"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- 3. Owners can manage all members
CREATE POLICY "owner_manage_all_members"
  ON organization_members FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- 4. Users can insert their own membership (for auto-creation)
CREATE POLICY "insert_own_membership"
  ON organization_members FOR INSERT
  WITH CHECK (user_id = auth.uid());
