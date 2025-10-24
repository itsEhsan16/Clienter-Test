export interface Profile {
  id: string
  email: string
  full_name: string | null
  timezone: string
  default_reminder_minutes: number
  created_at: string
  updated_at: string
}

export interface Client {
  id: string
  user_id: string
  name: string
  phone: string | null
  company?: string | null
  tags?: string[]
  project_description: string | null
  budget: number | null
  status: 'general' | 'important' | 'working' | 'finished'
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  client_id: string
  user_id: string
  title: string
  description: string | null
  budget: number | null
  status: 'prospect' | 'active' | 'completed'
  created_at: string
  updated_at: string
}

export interface Meeting {
  id: string
  user_id: string
  client_id: string | null
  project_id: string | null
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

export interface ClientWithProjects extends Client {
  projects?: Project[]
}

export interface MeetingWithDetails extends Meeting {
  client?: Client
  project?: Project
}

export interface ReminderWithMeeting extends Reminder {
  meeting: MeetingWithDetails
}
