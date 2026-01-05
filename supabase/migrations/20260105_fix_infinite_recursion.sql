-- Fix infinite recursion in organization_members RLS policies
-- The solution: Use SECURITY DEFINER function to bypass RLS when checking roles

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Owners can manage all members" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Members can view own membership" ON organization_members;
DROP POLICY IF EXISTS "Users can view own membership" ON organization_members;
DROP POLICY IF EXISTS "Users can view org members" ON organization_members;
DROP POLICY IF EXISTS "Owners can manage members" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage non-owner members" ON organization_members;
DROP POLICY IF EXISTS "Users can create own membership" ON organization_members;

-- Create a security definer function to check user role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_org_role(p_user_id uuid, p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM organization_members
  WHERE user_id = p_user_id 
    AND organization_id = p_org_id
    AND status = 'active'
  LIMIT 1;
  
  RETURN v_role;
END;
$$;

-- Create simple policies using the security definer function

-- 1. Users can view their own membership
CREATE POLICY "own_membership_select"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

-- 2. Organization owners can view all members
CREATE POLICY "owner_view_members"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- 3. Admins and managers can view members
CREATE POLICY "admin_view_members"
  ON organization_members FOR SELECT
  USING (
    public.get_user_org_role(auth.uid(), organization_id) IN ('admin', 'manager')
  );

-- 4. Owners can manage all members
CREATE POLICY "owner_manage_members"
  ON organization_members FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- 5. Admins can manage non-owner members
CREATE POLICY "admin_manage_members"
  ON organization_members FOR INSERT
  WITH CHECK (
    public.get_user_org_role(auth.uid(), organization_id) = 'admin'
    AND role != 'owner'
  );

CREATE POLICY "admin_update_members"
  ON organization_members FOR UPDATE
  USING (
    public.get_user_org_role(auth.uid(), organization_id) = 'admin'
    AND role != 'owner'
  );

CREATE POLICY "admin_delete_members"
  ON organization_members FOR DELETE
  USING (
    public.get_user_org_role(auth.uid(), organization_id) = 'admin'
    AND role != 'owner'
  );

-- 6. Users can create their own membership
CREATE POLICY "create_own_membership"
  ON organization_members FOR INSERT
  WITH CHECK (user_id = auth.uid());
