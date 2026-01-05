-- Migration: Convert existing users to organization owners
-- Created: 2026-01-04
-- Purpose: Migrate existing single-user data to multi-tenant structure

-- =====================================================
-- ADD ORGANIZATION_ID TO EXISTING TABLES
-- =====================================================

-- Add organization_id to clients table
ALTER TABLE clients 
ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to meetings table
ALTER TABLE meetings 
ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to expenses table
ALTER TABLE expenses 
ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Add organization_id to reminders table
ALTER TABLE reminders 
ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- =====================================================
-- MIGRATE EXISTING DATA
-- =====================================================

-- Step 1: Create organization for each existing user
-- Organization name will be "{user_email}'s Agency"
INSERT INTO organizations (id, name, owner_id, created_at, updated_at)
SELECT 
  uuid_generate_v4(),
  COALESCE(p.full_name, SPLIT_PART(p.email, '@', 1)) || '''s Agency',
  p.id,
  p.created_at,
  p.updated_at
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM organizations o WHERE o.owner_id = p.id
);

-- Step 2: Add each user as owner to their organization
INSERT INTO organization_members (organization_id, user_id, role, display_name, status, created_at, updated_at)
SELECT 
  o.id,
  o.owner_id,
  'owner'::member_role,
  p.full_name,
  'active',
  o.created_at,
  o.updated_at
FROM organizations o
JOIN profiles p ON o.owner_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM organization_members om 
  WHERE om.organization_id = o.id AND om.user_id = o.owner_id
);

-- Step 3: Update clients to link to organization
UPDATE clients c
SET organization_id = (
  SELECT o.id 
  FROM organizations o 
  WHERE o.owner_id = c.user_id
)
WHERE organization_id IS NULL;

-- Step 4: Update meetings to link to organization
UPDATE meetings m
SET organization_id = (
  SELECT o.id 
  FROM organizations o 
  WHERE o.owner_id = m.user_id
)
WHERE organization_id IS NULL;

-- Step 5: Update expenses to link to organization
UPDATE expenses e
SET organization_id = (
  SELECT o.id 
  FROM organizations o 
  WHERE o.owner_id = e.user_id
)
WHERE organization_id IS NULL;

-- Step 6: Update reminders to link to organization
UPDATE reminders r
SET organization_id = (
  SELECT o.id 
  FROM organizations o 
  WHERE o.owner_id = r.user_id
)
WHERE organization_id IS NULL;

-- =====================================================
-- ADD CONSTRAINTS AND INDEXES
-- =====================================================

-- Make organization_id NOT NULL after migration
ALTER TABLE clients ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE meetings ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE expenses ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE reminders ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for organization_id
CREATE INDEX idx_clients_org_id ON clients(organization_id);
CREATE INDEX idx_meetings_org_id ON meetings(organization_id);
CREATE INDEX idx_expenses_org_id ON expenses(organization_id);
CREATE INDEX idx_reminders_org_id ON reminders(organization_id);

-- =====================================================
-- UPDATE RLS POLICIES FOR EXISTING TABLES
-- =====================================================

-- Drop old user_id based policies and create org-based ones

-- CLIENTS POLICIES
DROP POLICY IF EXISTS "Users can view own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete own clients" ON clients;

CREATE POLICY "Members can view org clients"
  ON clients FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Members can insert org clients"
  ON clients FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Members can update org clients"
  ON clients FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Owners can delete org clients"
  ON clients FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      WHERE om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
    )
  );

-- MEETINGS POLICIES
DROP POLICY IF EXISTS "Users can view own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can insert own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can update own meetings" ON meetings;
DROP POLICY IF EXISTS "Users can delete own meetings" ON meetings;

CREATE POLICY "Members can view org meetings"
  ON meetings FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Members can insert org meetings"
  ON meetings FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Members can update org meetings"
  ON meetings FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Members can delete org meetings"
  ON meetings FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- EXPENSES POLICIES
DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON expenses;

CREATE POLICY "Owners can view org expenses"
  ON expenses FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      WHERE om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners can insert org expenses"
  ON expenses FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      WHERE om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners can update org expenses"
  ON expenses FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      WHERE om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners can delete org expenses"
  ON expenses FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      WHERE om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
    )
  );

-- REMINDERS POLICIES
DROP POLICY IF EXISTS "Users can view own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can insert own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can update own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can delete own reminders" ON reminders;

CREATE POLICY "Members can view org reminders"
  ON reminders FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Members can insert org reminders"
  ON reminders FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Members can update org reminders"
  ON reminders FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Members can delete org reminders"
  ON reminders FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- =====================================================
-- ADD TRIGGER FOR AUTO ORG CREATION ON SIGNUP
-- =====================================================

-- Function to create organization and membership for new users
CREATE OR REPLACE FUNCTION create_organization_for_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_org_id UUID;
  org_name VARCHAR(255);
BEGIN
  -- Generate organization name from user info
  org_name := COALESCE(NEW.full_name, SPLIT_PART(NEW.email, '@', 1)) || '''s Agency';
  
  -- Create organization
  INSERT INTO organizations (name, owner_id, created_at, updated_at)
  VALUES (org_name, NEW.id, NOW(), NOW())
  RETURNING id INTO new_org_id;
  
  -- Add user as owner member
  INSERT INTO organization_members (organization_id, user_id, role, display_name, status, created_at, updated_at)
  VALUES (new_org_id, NEW.id, 'owner'::member_role, NEW.full_name, 'active', NOW(), NOW());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create organization on new user signup
CREATE TRIGGER trigger_create_org_on_signup
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_organization_for_new_user();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE organizations IS 'Stores agency/organization information';
COMMENT ON TABLE organization_members IS 'Links users to organizations with their roles';
COMMENT ON TABLE tasks IS 'Tasks assigned to team members by owners/admins';
COMMENT ON TABLE payments IS 'Payment records for team members (project-based payments)';

COMMENT ON COLUMN clients.organization_id IS 'Organization this client belongs to';
COMMENT ON COLUMN meetings.organization_id IS 'Organization this meeting belongs to';
COMMENT ON COLUMN expenses.organization_id IS 'Organization this expense belongs to';
COMMENT ON COLUMN reminders.organization_id IS 'Organization this reminder belongs to';
