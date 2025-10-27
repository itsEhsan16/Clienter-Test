'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createBrowserClient } from '@/lib/supabase'
import { getUserTimezone } from '@/lib/date-utils'
import { User, Globe, Clock, Save, Bell } from 'lucide-react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const { user, profile, refreshProfile, loading } = useAuth()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createBrowserClient()

  const [formData, setFormData] = useState({
    full_name: '',
    timezone: 'UTC',
    default_reminder_minutes: 15,
  })

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default')

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
    }
  }, [])

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        timezone: profile.timezone || getUserTimezone(),
        default_reminder_minutes: profile.default_reminder_minutes || 15,
      })
    }
  }, [profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        timezone: formData.timezone,
        default_reminder_minutes: formData.default_reminder_minutes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      await refreshProfile()
      setMessage('Settings saved successfully!')
    }

    setSaving(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value
    setFormData({
      ...formData,
      [e.target.name]: value,
    })
  }

  const handleRequestNotifications = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Dashboard
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

        {message && (
          <div
            className={`mb-6 px-4 py-3 rounded ${
              message.startsWith('Error')
                ? 'bg-red-50 border border-red-200 text-red-700'
                : 'bg-green-50 border border-green-200 text-green-700'
            }`}
          >
            {message}
          </div>
        )}

        <div className="card p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
            <User className="w-5 h-5 mr-2" />
            Profile Information
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="full_name" className="label">
                Full Name
              </label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="input"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="input bg-gray-100 cursor-not-allowed"
              />
              <p className="mt-1 text-sm text-gray-500">
                Email cannot be changed here. Contact support if needed.
              </p>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                <Globe className="w-5 h-5 mr-2" />
                Regional Settings
              </h3>

              <div>
                <label htmlFor="timezone" className="label">
                  Timezone
                </label>
                <select
                  id="timezone"
                  name="timezone"
                  value={formData.timezone}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Europe/Paris">Paris (CET)</option>
                  <option value="Asia/Tokyo">Tokyo (JST)</option>
                  <option value="Asia/Shanghai">Shanghai (CST)</option>
                  <option value="Australia/Sydney">Sydney (AEDT)</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Your current timezone: {getUserTimezone()}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Reminder Preferences
              </h3>

              <div>
                <label htmlFor="default_reminder_minutes" className="label">
                  Default Reminder Lead Time
                </label>
                <select
                  id="default_reminder_minutes"
                  name="default_reminder_minutes"
                  value={formData.default_reminder_minutes}
                  onChange={handleChange}
                  className="input"
                >
                  <option value={5}>5 minutes before</option>
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                  <option value={120}>2 hours before</option>
                  <option value={1440}>1 day before</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  This will be the default for new meetings (you can change it per meeting)
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Notifications
              </h3>

              <div>
                <label className="label">Desktop Notifications</label>
                <div className="flex items-center space-x-4">
                  <span
                    className={`text-sm ${
                      notificationPermission === 'granted'
                        ? 'text-green-600'
                        : notificationPermission === 'denied'
                        ? 'text-red-600'
                        : 'text-gray-600'
                    }`}
                  >
                    {notificationPermission === 'granted'
                      ? 'Enabled'
                      : notificationPermission === 'denied'
                      ? 'Blocked by browser'
                      : 'Not enabled'}
                  </span>
                  {notificationPermission !== 'granted' && (
                    <button
                      type="button"
                      onClick={handleRequestNotifications}
                      className="btn-secondary text-sm"
                    >
                      Enable Notifications
                    </button>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Get desktop notifications for meeting reminders even when the browser is not
                  focused.
                </p>
              </div>
            </div>
          </form>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">User ID:</span>
              <span className="text-gray-900 font-mono text-xs">{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Account created:</span>
              <span className="text-gray-900">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
