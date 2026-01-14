-- Allow any active organization member to view all teammates in the same organization
-- Adds a non-recursive policy on organization_members for SELECT

-- Note: The earlier version referenced organization_members inside the policy,
-- which triggered "infinite recursion detected". We avoid that by delegating to
-- a SECURITY DEFINER helper that bypasses RLS.

-- Drop old policy to remain idempotent
drop policy if exists om_member_org_select on organization_members;

-- Helper function that checks membership without RLS recursion
create or replace function public.is_active_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- Non-recursive policy using helper
create policy om_member_org_select
  on organization_members
  for select
  using ( public.is_active_org_member(organization_id) );
