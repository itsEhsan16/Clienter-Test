'use client'

import { useEffect } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import { useReminderStore } from '@/store/reminderStore'
import { createBrowserClient } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { ReminderWithMeeting } from '@/types/database'
import { formatRelativeTime } from '@/lib/date-utils'
import { Bell } from 'lucide-react'

export function ReminderEngine() {
  const { user } = useAuth()
  const { reminders, activeReminders, setReminders, checkReminders, dismissReminder } =
    useReminderStore()
  const supabase = createBrowserClient()

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  // Fetch reminders on mount and set up polling
  useEffect(() => {
    if (!user) return

    const fetchReminders = async () => {
      const { data } = await supabase
        .from('reminders')
        .select(
          `
          *,
          meeting:meetings (
            *,
            client:clients (*)
          )
        `
        )
        .eq('user_id', user.id)
        .eq('is_dismissed', false)
        .gte('remind_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())

      if (data) {
        setReminders(data as ReminderWithMeeting[])
      }
    }

    fetchReminders()
    const interval = setInterval(fetchReminders, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [user])

  // Check for active reminders every 10 seconds
  useEffect(() => {
    checkReminders()
    const interval = setInterval(checkReminders, 10000)
    return () => clearInterval(interval)
  }, [reminders, checkReminders])

  // Show toast notifications for new active reminders
  useEffect(() => {
    activeReminders.forEach((reminder) => {
      const meeting = reminder.meeting

      // Show desktop notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification('Meeting Reminder', {
          body: `${meeting.title}${
            meeting.client ? ` with ${meeting.client.name}` : ''
          }\n${formatRelativeTime(meeting.meeting_time)}`,
          tag: reminder.id, // Prevents duplicate notifications
        })

        // Handle notification click
        notification.onclick = () => {
          if (meeting.meeting_link) {
            window.open(meeting.meeting_link, '_blank')
          } else {
            window.focus()
          }
          notification.close()
        }

        // Auto-close after 10 seconds
        setTimeout(() => notification.close(), 10000)
      }

      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 pt-0.5">
                  <Bell className="h-10 w-10 text-primary-500" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-gray-900">Meeting Reminder</p>
                  <p className="mt-1 text-sm text-gray-500">{meeting.title}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {formatRelativeTime(meeting.meeting_time)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-gray-200">
              <button
                onClick={async () => {
                  await supabase
                    .from('reminders')
                    .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
                    .eq('id', reminder.id)

                  dismissReminder(reminder.id)
                  toast.dismiss(t.id)
                }}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-primary-600 hover:text-primary-500 focus:outline-none"
              >
                Dismiss
              </button>
            </div>
          </div>
        ),
        {
          id: reminder.id,
          duration: 60000,
        }
      )
    })
  }, [activeReminders])

  return <Toaster position="top-right" />
}
