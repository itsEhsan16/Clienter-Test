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

export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type ProjectUpdateType = 'general' | 'milestone' | 'issue' | 'client_feedback'

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

export type AccountType = 'owner' | 'team_member'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  timezone: string
  default_reminder_minutes: number
  currency: string
  account_type: AccountType
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
// PROJECTS (NEW)
// =====================================================

export interface Project {
  id: string
  client_id: string
  organization_id: string
  name: string
  description: string | null
  status: ProjectStatus
  budget: number | null
  total_paid: number
  start_date: string | null
  deadline: string | null
  completed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProjectTeamMember {
  id: string
  project_id: string
  team_member_id: string
  role: string | null
  allocated_budget: number | null
  total_paid: number
  status: string
  assigned_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ProjectTeamMemberWithProfile extends ProjectTeamMember {
  profile: Profile
}

export interface ProjectTask {
  id: string
  project_id: string
  assigned_to: string | null
  title: string
  description: string | null
  status: string
  priority: TaskPriority
  due_date: string | null
  completed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProjectTaskWithProfile extends ProjectTask {
  assigned_to_profile?: Profile
  created_by_profile: Profile
}

export interface ProjectUpdate {
  id: string
  project_id: string
  title: string | null
  content: string
  update_type: ProjectUpdateType
  created_by: string
  created_at: string
}

export interface ProjectUpdateWithProfile extends ProjectUpdate {
  created_by_profile: Profile
}

export interface ProjectWithDetails extends Project {
  client: Client
  team_members?: ProjectTeamMemberWithProfile[]
  tasks?: ProjectTask[]
  updates?: ProjectUpdate[]
  team_member_count?: number
  task_count?: number
  completed_tasks?: number
  pending_amount?: number
}

export interface ProjectSummary {
  id: string
  client_id: string
  client_name: string
  client_phone: string | null
  organization_id: string
  name: string
  description: string | null
  status: ProjectStatus
  budget: number | null
  total_paid: number
  start_date: string | null
  deadline: string | null
  team_member_count: number
  task_count: number
  completed_tasks: number
  pending_amount: number
  created_at: string
  updated_at: string
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

export type ExpenseType = 'team' | 'other'
export type PaymentStatus = 'pending' | 'partial' | 'completed'
export type PaymentType = 'advance' | 'milestone' | 'final' | 'regular'

export interface Expense {
  id: string
  user_id: string
  organization_id: string | null
  description: string
  amount: number
  expense_type: ExpenseType
  team_member_id: string | null
  project_id: string | null
  project_team_member_id: string | null
  project_name: string | null
  total_amount: number | null
  paid_amount: number
  payment_status: PaymentStatus
  created_at: string
  updated_at: string
}

export interface TeamPaymentRecord {
  id: string
  expense_id: string
  amount: number
  payment_type: PaymentType
  payment_date: string
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface ExpenseWithDetails extends Expense {
  team_member?: Profile
  project?: Project
  payment_records?: TeamPaymentRecord[]
  pending_amount?: number
  payment_count?: number
}

export interface TeamMemberEarnings {
  team_member_id: string
  email: string
  full_name: string | null
  total_projects: number
  total_earned: number
  total_received: number
  total_pending: number
  organization_id: string
}

export interface TeamMemberProjectEarnings {
  team_member_id: string
  project_id: string
  project_name: string
  client_id: string
  client_name: string
  project_role: string | null
  allocated_budget: number | null
  total_paid: number
  pending_amount: number
  status: string
  project_status: ProjectStatus
  team_member_email: string
  team_member_name: string | null
}

export interface TeamMemberMonthlyEarnings {
  team_member_id: string
  email: string
  full_name: string | null
  month: string
  monthly_earnings: number
  projects_count: number
}
