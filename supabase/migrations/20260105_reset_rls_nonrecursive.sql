-- Reset RLS policies on organizations and organization_members to break recursion
-- Approach: drop all existing policies, then add minimal non-recursive rules

-- ===== Drop all policies on target tables =====
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('organizations','organization_members')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Drop helper function if exists
DROP FUNCTION IF EXISTS public.get_user_org_role(uuid, uuid);

-- ===== Recreate minimal policies (no cross-table recursion) =====

-- Organizations: allow authenticated users to read; only owner can mutate
CREATE POLICY org_select_any_authenticated
  ON organizations FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY org_owner_all
  ON organizations FOR ALL
  USING (owner_id = auth.uid());

-- Organization members: allow self read; owner can read/manage via direct owner_id check
CREATE POLICY om_self_select
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY om_owner_select
  ON organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY om_owner_all
  ON organization_members FOR ALL
  USING (
    organization_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

-- Allow users to insert their own membership row (used by onboarding trigger)
CREATE POLICY om_self_insert
  ON organization_members FOR INSERT
  WITH CHECK (user_id = auth.uid());
