-- Final fix to remove RLS recursion on organizations and organization_members
-- Strategy: avoid cross-table checks in policies; keep rules simple and one-way

-- ===============================
-- ORGANIZATIONS
-- ===============================

-- Drop existing policies
DROP POLICY IF EXISTS "Members can view their organization" ON organizations;
DROP POLICY IF EXISTS "Owners can manage their organization" ON organizations;
DROP POLICY IF EXISTS "organization_members_can_view" ON organizations;
DROP POLICY IF EXISTS "owners_view_own_org" ON organizations;
DROP POLICY IF EXISTS "owners_manage_own_org" ON organizations;
DROP POLICY IF EXISTS "members_view_org" ON organizations;

-- New minimal policies (no cross-table references)
CREATE POLICY "org_select_authenticated"
  ON organizations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "org_owner_all"
  ON organizations FOR ALL
  USING (owner_id = auth.uid());

-- ===============================
-- ORGANIZATION_MEMBERS
-- ===============================

-- Drop existing policies
DROP POLICY IF EXISTS "Members can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Owners can manage all members" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Members can view own membership" ON organization_members;
DROP POLICY IF EXISTS "Users can view own membership" ON organization_members;
DROP POLICY IF EXISTS "Users can view org members" ON organization_members;
DROP POLICY IF EXISTS "Owners can manage members" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage non-owner members" ON organization_members;
DROP POLICY IF EXISTS "Users can create own membership" ON organization_members;
DROP POLICY IF EXISTS "view_own_membership" ON organization_members;
DROP POLICY IF EXISTS "owner_view_all_members" ON organization_members;
DROP POLICY IF EXISTS "owner_manage_all_members" ON organization_members;
DROP POLICY IF EXISTS "insert_own_membership" ON organization_members;
DROP POLICY IF EXISTS "admin_view_members" ON organization_members;
DROP POLICY IF EXISTS "owner_view_members" ON organization_members;
DROP POLICY IF EXISTS "own_membership_select" ON organization_members;
DROP POLICY IF EXISTS "admin_manage_members" ON organization_members;
DROP POLICY IF EXISTS "admin_update_members" ON organization_members;
DROP POLICY IF EXISTS "admin_delete_members" ON organization_members;
DROP POLICY IF EXISTS "create_own_membership" ON organization_members;

-- Drop helper function if still present
DROP FUNCTION IF EXISTS public.get_user_org_role(uuid, uuid);

-- New minimal policies

-- 1) Users can read their own membership row
CREATE POLICY "om_self_select"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

-- 2) Organization owners can read all membership rows in their org
CREATE POLICY "om_owner_select"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- 3) Organization owners can insert/update/delete membership rows in their org
CREATE POLICY "om_owner_modify"
  ON organization_members FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- 4) Users can insert their own membership (for initial auto-create flows)
CREATE POLICY "om_self_insert"
  ON organization_members FOR INSERT
  WITH CHECK (user_id = auth.uid());
