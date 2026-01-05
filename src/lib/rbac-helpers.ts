/**
 * Role-Based Access Control (RBAC) Helpers
 *
 * Provides permission checking and organization membership utilities
 * for the multi-tenant agency management system.
 */

import { supabase } from '@/lib/supabase'
import type { OrganizationMember, MemberRole } from '@/types/database'

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface OrgMembership {
  organizationId: string
  organizationName: string
  role: MemberRole
  isOwner: boolean
  memberId: string
}

// =====================================================
// CORE MEMBERSHIP FUNCTIONS
// =====================================================

/**
 * Get the current user's organization membership and role
 * @param userId - The user's UUID
 * @returns Organization membership details or null
 */
export async function getOrgMembership(userId: string): Promise<OrgMembership | null> {
  try {
    // Get user's organization membership with org details
    const { data, error } = await supabase
      .from('organization_members')
      .select(
        `
        id,
        organization_id,
        role,
        status,
        organizations:organization_id (
          id,
          name,
          owner_id
        )
      `
      )
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (error || !data) {
      console.error('Error fetching org membership:', error)
      return null
    }

    const org = data.organizations as any

    return {
      organizationId: data.organization_id,
      organizationName: org.name,
      role: data.role as MemberRole,
      isOwner: org.owner_id === userId,
      memberId: data.id,
    }
  } catch (err) {
    console.error('Error in getOrgMembership:', err)
    return null
  }
}

/**
 * Get detailed organization member record
 * @param userId - The user's UUID
 * @returns Full organization member record or null
 */
export async function getOrgMemberRecord(userId: string): Promise<OrganizationMember | null> {
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single()

    if (error || !data) {
      return null
    }

    return data as OrganizationMember
  } catch (err) {
    console.error('Error in getOrgMemberRecord:', err)
    return null
  }
}

// =====================================================
// PERMISSION CHECKING FUNCTIONS
// =====================================================

/**
 * Check if user is the organization owner
 * @param userId - The user's UUID
 * @returns true if user is owner
 */
export async function isOwner(userId: string): Promise<boolean> {
  const membership = await getOrgMembership(userId)
  return membership?.isOwner ?? false
}

/**
 * Check if user is owner or admin
 * @param userId - The user's UUID
 * @returns true if user has admin privileges
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const membership = await getOrgMembership(userId)
  if (!membership) return false

  return membership.role === 'owner' || membership.role === 'admin'
}

/**
 * Check if user can view financial data (expenses, payments)
 * Only owners and admins can view finances
 * @param userId - The user's UUID
 * @returns true if user can view financial data
 */
export async function canViewFinances(userId: string): Promise<boolean> {
  return isAdmin(userId)
}

/**
 * Check if user can manage tasks (create, assign, delete)
 * Only owners and admins can manage tasks
 * @param userId - The user's UUID
 * @returns true if user can manage tasks
 */
export async function canManageTasks(userId: string): Promise<boolean> {
  return isAdmin(userId)
}

/**
 * Check if user can manage team members (add, edit, remove)
 * Only owners and admins can manage team
 * @param userId - The user's UUID
 * @returns true if user can manage team
 */
export async function canManageTeam(userId: string): Promise<boolean> {
  return isAdmin(userId)
}

/**
 * Check if user can manage clients
 * All team members can create/edit clients
 * @param userId - The user's UUID
 * @returns true if user can manage clients
 */
export async function canManageClients(userId: string): Promise<boolean> {
  const membership = await getOrgMembership(userId)
  return membership !== null
}

/**
 * Check if user can manage meetings
 * All team members can create/edit meetings
 * @param userId - The user's UUID
 * @returns true if user can manage meetings
 */
export async function canManageMeetings(userId: string): Promise<boolean> {
  const membership = await getOrgMembership(userId)
  return membership !== null
}

/**
 * Check if user can delete sensitive data (clients, meetings)
 * Only owners and admins can delete
 * @param userId - The user's UUID
 * @returns true if user can delete data
 */
export async function canDeleteData(userId: string): Promise<boolean> {
  return isAdmin(userId)
}

// =====================================================
// ROLE UTILITIES
// =====================================================

/**
 * Get human-readable role label
 * @param role - Member role enum value
 * @returns Formatted role name
 */
export function getRoleLabel(role: MemberRole): string {
  const labels: Record<MemberRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    designer: 'Designer',
    developer: 'Developer',
    editor: 'Editor',
    content_writer: 'Content Writer',
    project_manager: 'Project Manager',
    sales: 'Sales',
    marketing: 'Marketing',
    support: 'Support',
    other: 'Other',
  }
  return labels[role]
}

/**
 * Get role badge color for UI
 * @param role - Member role enum value
 * @returns Tailwind color class
 */
export function getRoleBadgeColor(role: MemberRole): string {
  const colors: Record<MemberRole, string> = {
    owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    designer: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    developer: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    editor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    content_writer: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    project_manager: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
    sales: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    marketing: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
    support: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
    other: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  }
  return colors[role]
}

/**
 * Get all available roles for team member selection
 * Excludes 'owner' as that's set automatically
 * @returns Array of role objects with value and label
 */
export function getAvailableRoles(): { value: MemberRole; label: string }[] {
  const roles: MemberRole[] = [
    'admin',
    'designer',
    'developer',
    'editor',
    'content_writer',
    'project_manager',
    'sales',
    'marketing',
    'support',
    'other',
  ]

  return roles.map((role) => ({
    value: role,
    label: getRoleLabel(role),
  }))
}

// =====================================================
// ORGANIZATION UTILITIES
// =====================================================

/**
 * Get all team members for the user's organization
 * @param userId - The user's UUID
 * @returns Array of organization members with profile data
 */
export async function getTeamMembers(userId: string) {
  const membership = await getOrgMembership(userId)

  if (!membership) {
    return []
  }

  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select(
        `
        *,
        profile:user_id (
          id,
          email,
          full_name,
          created_at
        )
      `
      )
      .eq('organization_id', membership.organizationId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching team members:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Error in getTeamMembers:', err)
    return []
  }
}

/**
 * Check if a user is a member of an organization
 * @param userId - The user's UUID
 * @param organizationId - The organization's UUID
 * @returns true if user is a member
 */
export async function isOrgMember(userId: string, organizationId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .single()

    return !error && data !== null
  } catch (err) {
    return false
  }
}
