'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getUserTimezone } from '@/lib/date-utils'
import { User, Globe, Clock, Save, Bell, LogOut, Trash2 } from 'lucide-react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function SettingsPage() {
  const { user, profile, refreshProfile, loading, signOut, supabase } = useAuth()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const [formData, setFormData] = useState({
    full_name: '',
    timezone: 'UTC',
    default_reminder_minutes: 15,
    currency: 'INR',
  })

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showSignOutDialog, setShowSignOutDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)

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
        currency: profile.currency || 'INR',
      })
    }
  }, [profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setSaving(true)
    setMessage('')

    // Try updating including `currency` first. If the DB/schema doesn't have
    // the `currency` column (older DBs), retry without it and inform the user.
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name,
        timezone: formData.timezone,
        default_reminder_minutes: formData.default_reminder_minutes,
        currency: formData.currency,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (error) {
      const msg = error.message || ''
      if (msg.includes("Could not find the 'currency' column")) {
        // Retry without currency column to avoid blocking the user.
        const { error: err2 } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name,
            timezone: formData.timezone,
            default_reminder_minutes: formData.default_reminder_minutes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)

        if (err2) {
          setMessage(`Error: ${err2.message}`)
        } else {
          await refreshProfile()
          setMessage(
            'Settings saved (currency column missing in DB). Run the migration to add `currency` to `profiles`.'
          )
        }
      } else {
        setMessage(`Error: ${error.message}`)
      }
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

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'delete' || !user) return

    setDeleting(true)
    try {
      // Delete profile data
      const { error: profileError } = await supabase.from('profiles').delete().eq('id', user.id)

      if (profileError) {
        setMessage(`Error deleting profile: ${profileError.message}`)
        setDeleting(false)
        return
      }

      // Note: In a real app, you'd need server-side admin API to delete the auth user
      // For now, we'll sign them out after deleting their profile
      await signOut()
      window.location.href = '/login'
    } catch (error) {
      setMessage('Error deleting account. Please contact support.')
      setDeleting(false)
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
                  <option value="America/New_York">Eastern Time (ET) - New York</option>
                  <option value="America/Chicago">Central Time (CT) - Chicago</option>
                  <option value="America/Denver">Mountain Time (MT) - Denver</option>
                  <option value="America/Los_Angeles">Pacific Time (PT) - Los Angeles</option>
                  <option value="America/Toronto">Eastern Time (ET) - Toronto</option>
                  <option value="America/Vancouver">Pacific Time (PT) - Vancouver</option>
                  <option value="Europe/London">Greenwich Mean Time (GMT) - London</option>
                  <option value="Europe/Paris">Central European Time (CET) - Paris</option>
                  <option value="Europe/Berlin">Central European Time (CET) - Berlin</option>
                  <option value="Europe/Rome">Central European Time (CET) - Rome</option>
                  <option value="Europe/Moscow">Moscow Standard Time (MSK) - Moscow</option>
                  <option value="Asia/Dubai">Gulf Standard Time (GST) - Dubai</option>
                  <option value="Asia/Kolkata">India Standard Time (IST) - Kolkata</option>
                  <option value="Asia/Mumbai">India Standard Time (IST) - Mumbai</option>
                  <option value="Asia/Tokyo">Japan Standard Time (JST) - Tokyo</option>
                  <option value="Asia/Shanghai">China Standard Time (CST) - Shanghai</option>
                  <option value="Asia/Hong_Kong">Hong Kong Time (HKT) - Hong Kong</option>
                  <option value="Asia/Singapore">Singapore Time (SGT) - Singapore</option>
                  <option value="Australia/Sydney">Australian Eastern Time (AEDT) - Sydney</option>
                  <option value="Australia/Melbourne">
                    Australian Eastern Time (AEDT) - Melbourne
                  </option>
                  <option value="Australia/Perth">Australian Western Time (AWST) - Perth</option>
                  <option value="Australia/Brisbane">
                    Australian Eastern Time (AEST) - Brisbane
                  </option>
                  <option value="Pacific/Auckland">New Zealand Time (NZDT) - Auckland</option>
                  <option value="Africa/Cairo">Eastern European Time (EET) - Cairo</option>
                  <option value="Africa/Johannesburg">
                    South Africa Standard Time (SAST) - Johannesburg
                  </option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Your current timezone: {getUserTimezone()}
                </p>
              </div>

              <div>
                <label htmlFor="currency" className="label">
                  Currency
                </label>
                <select
                  id="currency"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="input"
                >
                  <option value="INR">Indian Rupee (INR)</option>
                  <option value="USD">US Dollar (USD)</option>
                  <option value="EUR">Euro (EUR)</option>
                  <option value="GBP">British Pound (GBP)</option>
                  <option value="AUD">Australian Dollar (AUD)</option>
                  <option value="CAD">Canadian Dollar (CAD)</option>
                  <option value="JPY">Japanese Yen (JPY)</option>
                  <option value="CNY">Chinese Yuan (CNY)</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Default currency for budgets and payments.
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

            <div className="flex justify-end pt-6">
              <button type="submit" disabled={saving} className="btn-primary flex items-center">
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
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

        <div className="card p-6 border-red-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Actions</h2>
          <div className="space-y-4">
            <div>
              {!showSignOutDialog ? (
                <button
                  onClick={() => setShowSignOutDialog(true)}
                  className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </button>
              ) : (
                <div className="space-y-4 p-4 border border-gray-300 rounded-lg bg-gray-50">
                  <p className="text-sm text-gray-700 font-medium">
                    Are you sure you want to sign out?
                  </p>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowSignOutDialog(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSignOut}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-md font-semibold text-red-600 mb-2">Danger Zone</h3>
              <p className="text-sm text-gray-600 mb-4">
                Once you delete your account, there is no going back. Please be certain.
              </p>

              {!showDeleteDialog ? (
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </button>
              ) : (
                <div className="space-y-4 p-4 border border-red-300 rounded-lg bg-red-50">
                  <p className="text-sm text-red-700 font-medium">
                    This action cannot be undone. This will permanently delete your account and
                    remove your data from our servers.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type "delete" to confirm:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmation}
                      onChange={(e) => setDeleteConfirmation(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="delete"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setShowDeleteDialog(false)
                        setDeleteConfirmation('')
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={deleteConfirmation !== 'delete' || deleting}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {deleting ? 'Deleting...' : 'Delete Account'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
