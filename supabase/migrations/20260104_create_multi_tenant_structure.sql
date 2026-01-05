-- Migration: Multi-tenant agency management structure
-- Created: 2026-01-04
-- Purpose: Add organizations, team members, tasks, and payments system

-- =====================================================
-- ENUMS
-- =====================================================

-- Role types for organization members
CREATE TYPE member_role AS ENUM (
  'owner',
  'admin',
  'designer',
  'developer',
  'editor',
  'content_writer',
  'project_manager',
  'sales',
  'marketing',
  'support',
  'other'
);

-- Task status types
CREATE TYPE task_status AS ENUM (
  'assigned',
  'in_progress',
  'completed',
  'cancelled'
);

-- =====================================================
-- TABLES
-- =====================================================

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization members (team members)
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'other',
  display_name VARCHAR(255),
  hire_date DATE DEFAULT CURRENT_DATE,
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status task_status NOT NULL DEFAULT 'assigned',
  deadline TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table (for team member payments)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  payment_date DATE DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Organizations indexes
CREATE INDEX idx_organizations_owner ON organizations(owner_id);
CREATE INDEX idx_organizations_created_at ON organizations(created_at DESC);

-- Organization members indexes
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(role);
CREATE INDEX idx_org_members_status ON organization_members(status);

-- Tasks indexes
CREATE INDEX idx_tasks_org_id ON tasks(organization_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_assigned_by ON tasks(assigned_by);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_deadline ON tasks(deadline);
CREATE INDEX idx_tasks_org_status ON tasks(organization_id, status);

-- Payments indexes
CREATE INDEX idx_payments_org_id ON payments(organization_id);
CREATE INDEX idx_payments_team_member ON payments(team_member_id);
CREATE INDEX idx_payments_payment_date ON payments(payment_date DESC);
CREATE INDEX idx_payments_team_member_date ON payments(team_member_id, payment_date DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Organizations policies
-- Users can view organizations they belong to
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Only owners can update their organizations
CREATE POLICY "Owners can update their organizations"
  ON organizations FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Users can insert organizations (when creating new account)
CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Only owners can delete their organizations
CREATE POLICY "Owners can delete their organizations"
  ON organizations FOR DELETE
  USING (owner_id = auth.uid());

-- Organization members policies
-- Members can view other members in their organization
CREATE POLICY "Members can view org members"
  ON organization_members FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Only owners can insert new members
CREATE POLICY "Owners can add members"
  ON organization_members FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT id 
      FROM organizations 
      WHERE owner_id = auth.uid()
    )
  );

-- Only owners can update members
CREATE POLICY "Owners can update members"
  ON organization_members FOR UPDATE
  USING (
    organization_id IN (
      SELECT id 
      FROM organizations 
      WHERE owner_id = auth.uid()
    )
  );

-- Only owners can delete members
CREATE POLICY "Owners can delete members"
  ON organization_members FOR DELETE
  USING (
    organization_id IN (
      SELECT id 
      FROM organizations 
      WHERE owner_id = auth.uid()
    )
  );

-- Tasks policies
-- Members can view tasks in their organization
CREATE POLICY "Members can view org tasks"
  ON tasks FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Owners and admins can create tasks
CREATE POLICY "Owners can create tasks"
  ON tasks FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      WHERE om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
    )
  );

-- Assigned users can update their tasks (status)
CREATE POLICY "Users can update assigned tasks"
  ON tasks FOR UPDATE
  USING (
    assigned_to = auth.uid() 
    OR organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      WHERE om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
    )
  );

-- Only owners can delete tasks
CREATE POLICY "Owners can delete tasks"
  ON tasks FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      WHERE om.user_id = auth.uid() 
        AND om.role = 'owner'
    )
  );

-- Payments policies
-- Members can view their own payments, owners can view all
CREATE POLICY "Members can view payments"
  ON payments FOR SELECT
  USING (
    team_member_id = auth.uid()
    OR organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      WHERE om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
    )
  );

-- Only owners can create payments
CREATE POLICY "Owners can create payments"
  ON payments FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      WHERE om.user_id = auth.uid() 
        AND om.role IN ('owner', 'admin')
    )
  );

-- Only owners can update payments
CREATE POLICY "Owners can update payments"
  ON payments FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      WHERE om.user_id = auth.uid() 
        AND om.role = 'owner'
    )
  );

-- Only owners can delete payments
CREATE POLICY "Owners can delete payments"
  ON payments FOR DELETE
  USING (
    organization_id IN (
      SELECT om.organization_id 
      FROM organization_members om
      WHERE om.user_id = auth.uid() 
        AND om.role = 'owner'
    )
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update updated_at timestamp for organizations
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organizations_updated_at();

-- Update updated_at timestamp for organization_members
CREATE OR REPLACE FUNCTION update_org_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_org_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_org_members_updated_at();

-- Update updated_at timestamp for tasks
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- Update updated_at timestamp for payments
CREATE OR REPLACE FUNCTION update_payments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION update_payments_updated_at();

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to get user's organization membership
CREATE OR REPLACE FUNCTION get_user_org_membership(user_uuid UUID)
RETURNS TABLE (
  organization_id UUID,
  organization_name VARCHAR,
  user_role member_role,
  is_owner BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    om.organization_id,
    o.name,
    om.role,
    (o.owner_id = user_uuid) as is_owner
  FROM organization_members om
  JOIN organizations o ON om.organization_id = o.id
  WHERE om.user_id = user_uuid AND om.status = 'active'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team member monthly earnings
CREATE OR REPLACE FUNCTION get_member_monthly_earnings(
  member_uuid UUID,
  target_month INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  target_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  total_earnings DECIMAL(10, 2);
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO total_earnings
  FROM payments
  WHERE team_member_id = member_uuid
    AND EXTRACT(MONTH FROM payment_date) = target_month
    AND EXTRACT(YEAR FROM payment_date) = target_year;
  
  RETURN total_earnings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all-time earnings for a team member
CREATE OR REPLACE FUNCTION get_member_total_earnings(member_uuid UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  total_earnings DECIMAL(10, 2);
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO total_earnings
  FROM payments
  WHERE team_member_id = member_uuid;
  
  RETURN total_earnings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
