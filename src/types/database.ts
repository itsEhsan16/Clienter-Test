// =====================================================
// ENUMS
// =====================================================

export type MemberRole =
  | 'owner'
  | 'admin'
  | 'designer'
  | 'developer'
  | 'editor'
  | 'content_writer'
  | 'project_manager'
  | 'sales'
  | 'marketing'
  | 'support'
  | 'other'

export type TaskStatus = 'assigned' | 'in_progress' | 'completed' | 'cancelled'

// =====================================================
// ORGANIZATION & TEAM
// =====================================================

export interface Organization {
  id: string
  name: string
  owner_id: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  role: MemberRole
  display_name: string | null
  hire_date: string
  status: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OrganizationMemberWithProfile extends OrganizationMember {
  profile: Profile
}

// =====================================================
// USER PROFILE
// =====================================================

export interface Profile {
  id: string
  email: string
  full_name: string | null
  timezone: string
  default_reminder_minutes: number
  currency: string
  created_at: string
  updated_at: string
}

// =====================================================
// TASKS
// =====================================================

export interface Task {
  id: string
  organization_id: string
  assigned_to: string
  assigned_by: string
  title: string
  description: string | null
  status: TaskStatus
  deadline: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface TaskWithDetails extends Task {
  assigned_to_profile: Profile
  assigned_by_profile: Profile
}

// =====================================================
// PAYMENTS (for team members)
// =====================================================

export interface Payment {
  id: string
  organization_id: string
  team_member_id: string
  amount: number
  description: string | null
  payment_date: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface PaymentWithMember extends Payment {
  team_member: Profile
}

// =====================================================
// CLIENTS
// =====================================================

export interface Client {
  id: string
  user_id: string
  organization_id: string
  name: string
  phone: string | null
  project_description: string | null
  budget: number | null
  // legacy single-value field (kept for compatibility)
  advance_paid: number | null
  // ordered list of payments made by the client
  payments?: { name: string; amount: number; created_at?: string }[]
  total_amount: number | null
  status: 'new' | 'ongoing' | 'completed'
  order: number
  created_at: string
  updated_at: string
}

export interface ClientWithMeetings extends Client {
  meetings?: Meeting[]
}

// =====================================================
// MEETINGS
// =====================================================

export interface Meeting {
  id: string
  user_id: string
  organization_id: string
  client_id: string | null
  title: string
  description: string | null
  meeting_time: string
  duration_minutes: number
  meeting_link: string | null
  reminder_minutes: number
  created_at: string
  updated_at: string
}

export interface MeetingWithDetails extends Meeting {
  client?: Client
}

// =====================================================
// REMINDERS
// =====================================================

export interface Reminder {
  id: string
  user_id: string
  organization_id: string
  meeting_id: string
  remind_at: string
  is_dismissed: boolean
  dismissed_at: string | null
  created_at: string
}

export interface ReminderWithMeeting extends Reminder {
  meeting: MeetingWithDetails
}

// =====================================================
// EXPENSES
// =====================================================

export interface Expense {
  id: string
  user_id: string
  organization_id: string
  description: string
  amount: number
  created_at: string
  updated_at: string
}
