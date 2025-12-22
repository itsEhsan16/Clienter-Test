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

export interface Client {
  id: string
  user_id: string
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

export interface Meeting {
  id: string
  user_id: string
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

export interface Reminder {
  id: string
  user_id: string
  meeting_id: string
  remind_at: string
  is_dismissed: boolean
  dismissed_at: string | null
  created_at: string
}

export interface ClientWithMeetings extends Client {
  meetings?: Meeting[]
}

export interface MeetingWithDetails extends Meeting {
  client?: Client
}

export interface ReminderWithMeeting extends Reminder {
  meeting: MeetingWithDetails
}

export interface Expense {
  id: string
  user_id: string
  description: string
  amount: number
  created_at: string
  updated_at: string
}
