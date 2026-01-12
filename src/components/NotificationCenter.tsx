'use client'

import { useEffect, useState } from 'react'
import { X, Bell, ExternalLink } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ReminderWithMeeting } from '@/types/database'
import { formatRelativeTime } from '@/lib/date-utils'

interface NotificationCenterProps {
  isOpen: boolean
  onClose: () => void
}

export function NotificationCenter({ isOpen, onClose }: NotificationCenterProps) {
  const { user, supabase, organization } = useAuth()
  const [reminders, setReminders] = useState<ReminderWithMeeting[]>([])

  useEffect(() => {
    if (!isOpen || !user) return

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
        .eq('organization_id', organization?.organizationId)
        .eq('is_dismissed', false)
        .order('remind_at', { ascending: true })
        .limit(20)

      if (data) {
        setReminders(data as ReminderWithMeeting[])
      }
    }

    fetchReminders()
  }, [isOpen, user])

  const handleDismiss = async (reminderId: string) => {
    await supabase
      .from('reminders')
      .update({ is_dismissed: true, dismissed_at: new Date().toISOString() })
      .eq('id', reminderId)

    setReminders(reminders.filter((r) => r.id !== reminderId))
  }

  // Keep the element mounted so we can animate in/out with CSS.
  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
      {/* Overlay: fade in/out */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black bg-opacity-25 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0'
        }`}
      />

      {/* Panel: slide in/out from the right. Slightly narrower (max-w-sm instead of max-w-md). */}
      <div
        className={`fixed inset-y-0 right-0 max-w-sm w-full bg-white shadow-xl transform transition-transform duration-300 ease-out pointer-events-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="px-4 py-6 bg-primary-600 sm:px-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-white flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Notifications
              </h2>
              <button onClick={onClose} className="text-primary-200 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {reminders.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No active reminders</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {reminders.map((reminder) => {
                  const meeting = reminder.meeting
                  const isPast = new Date(reminder.remind_at) < new Date()

                  return (
                    <li key={reminder.id} className="px-4 py-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {meeting.title}
                          </p>
                          {meeting.client && (
                            <p className="text-xs text-gray-500 mt-1">
                              Client: {meeting.client.name}
                            </p>
                          )}
                          <p
                            className={`text-xs mt-1 ${
                              isPast ? 'text-red-500 font-medium' : 'text-gray-500'
                            }`}
                          >
                            {formatRelativeTime(meeting.meeting_time)}
                          </p>
                          {meeting.meeting_link && (
                            <a
                              href={meeting.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-xs text-primary-600 hover:text-primary-700 mt-2"
                            >
                              Join Meeting
                              <ExternalLink className="w-3 h-3 ml-1" />
                            </a>
                          )}
                        </div>
                        <button
                          onClick={() => handleDismiss(reminder.id)}
                          className="ml-4 text-xs text-gray-500 hover:text-gray-700"
                        >
                          Dismiss
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
