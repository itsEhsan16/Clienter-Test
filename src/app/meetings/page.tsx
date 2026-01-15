'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { MeetingsListSkeleton } from '@/components/SkeletonLoaders'
import { ProfileErrorBanner } from '@/components/ProfileErrorBanner'
import { MeetingWithDetails, Client } from '@/types/database'
import { formatRelativeTime, formatDateForInput } from '@/lib/date-utils'
import { Plus, Calendar, ExternalLink, Video, X } from 'lucide-react'
import Link from 'next/link'

export default function MeetingsPage() {
  const {
    user,
    profile,
    loading: authLoading,
    profileLoading,
    profileError,
    supabase,
    organization,
  } = useAuth()
  const [meetings, setMeetings] = useState<MeetingWithDetails[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    meeting_time: '',
    duration_minutes: 60,
    meeting_link: '',
    reminder_minutes: 15,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    // Wait for auth and profile loading to complete
    if (authLoading || profileLoading) return

    // If there's a profile error but user is logged in, show the page with error banner
    // This allows users to see the retry option
    if (!user || !supabase) return

    // Only fetch data if we have organization context
    if (!organization?.organizationId) {
      // If profile error exists, don't wait indefinitely
      if (profileError) {
        setIsLoading(false)
        return
      }
      console.log('[Meetings] Waiting for organization data...')
      return
    }

    const fetchData = async () => {
      setIsLoading(true)

      try {
        // Ensure we have organization context
        if (!organization?.organizationId) {
          console.error('[Meetings] No organization ID available')
          setIsLoading(false)
          return
        }

        // Verify session first
        const {
          data: { session },
        } = await supabase.auth.getSession()
        console.log('[Meetings] Session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          accessToken: session?.access_token ? 'present' : 'missing',
        })

        if (!session || !session.access_token) {
          console.error('[Meetings] No valid session found')
          setIsLoading(false)
          return
        }

        // Add timeout protection
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Fetch meetings timed out after 10 seconds')), 10000)
        )

        // Parallel data fetching
        const fetchPromise = Promise.all([
          // Fetch meetings for the organization
          supabase
            .from('meetings')
            .select(
              `
              *,
              client:clients (*)
            `
            )
            .eq('organization_id', organization.organizationId)
            .order('meeting_time', { ascending: true }),

          // Fetch clients for the form (organization scoped)
          supabase
            .from('clients')
            .select('*')
            .eq('organization_id', organization.organizationId)
            .order('name'),
        ])

        const [meetingsResult, clientsResult] = await Promise.race([fetchPromise, timeoutPromise])

        console.log('[Meetings] Query results:', {
          meetingsError: meetingsResult.error,
          meetingsCount: meetingsResult.data?.length || 0,
          clientsError: clientsResult.error,
          clientsCount: clientsResult.data?.length || 0,
        })

        if (meetingsResult.data) {
          setMeetings(meetingsResult.data as MeetingWithDetails[])
        } else if (meetingsResult.error) {
          console.error('[Meetings] Error fetching meetings:', meetingsResult.error)
        }

        if (clientsResult.data) {
          setClients(clientsResult.data)
        } else if (clientsResult.error) {
          console.error('[Meetings] Error fetching clients:', clientsResult.error)
        }
      } catch (err: any) {
        console.error('[Meetings] Fetch error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [user, authLoading, profileLoading, supabase, organization?.organizationId, profileError])

  // Callback for when profile retry succeeds
  const handleProfileRetrySuccess = useCallback(() => {
    console.log('[Meetings] Profile retry succeeded, will refetch data')
    // Data will be refetched automatically due to useEffect dependencies
  }, [])

  useEffect(() => {
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        reminder_minutes: profile.default_reminder_minutes,
      }))
    }
  }, [profile])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !organization?.organizationId) return

    setSaving(true)

    const meetingTime = new Date(formData.meeting_time).toISOString()
    const reminderMinutes = formData.reminder_minutes
    const remindAt = new Date(
      new Date(meetingTime).getTime() - reminderMinutes * 60000
    ).toISOString()

    // Insert meeting (include organization_id)
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert([
        {
          user_id: user.id,
          organization_id: organization.organizationId,
          client_id: formData.client_id || null,
          title: formData.title,
          description: formData.description || null,
          meeting_time: meetingTime,
          duration_minutes: formData.duration_minutes,
          meeting_link: formData.meeting_link || null,
          reminder_minutes: reminderMinutes,
        },
      ])
      .select()
      .single()

    if (meetingError) {
      alert('Error creating meeting: ' + meetingError.message)
      setSaving(false)
      return
    }

    // Create reminder
    if (meeting) {
      await supabase.from('reminders').insert([
        {
          user_id: user.id,
          meeting_id: meeting.id,
          remind_at: remindAt,
        },
      ])
    }

    setSaving(false)
    setShowModal(false)
    setFormData({
      title: '',
      description: '',
      client_id: '',
      meeting_time: '',
      duration_minutes: 60,
      meeting_link: '',
      reminder_minutes: profile?.default_reminder_minutes || 15,
    })

    // Refresh meetings
    const { data } = await supabase
      .from('meetings')
      .select(
        `
        *,
        client:clients (*),
        project:projects (*)
      `
      )
      .eq('user_id', user.id)
      .order('meeting_time', { ascending: true })

    if (data) {
      setMeetings(data as MeetingWithDetails[])
    }
  }

  const handleOpenMeet = (link?: string) => {
    const url = link || 'https://meet.google.com'
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return

    await supabase.from('meetings').delete().eq('id', meetingId)

    setMeetings(meetings.filter((m) => m.id !== meetingId))
  }

  const upcomingMeetings = meetings.filter((m) => new Date(m.meeting_time) > new Date())
  const pastMeetings = meetings.filter((m) => new Date(m.meeting_time) <= new Date())

  // Show skeleton while loading
  if (authLoading || profileLoading || isLoading) {
    return <MeetingsListSkeleton />
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Profile Error Banner */}
        <ProfileErrorBanner onRetrySuccess={handleProfileRetrySuccess} showSignOut={true} />

        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meetings</h1>
              <p className="mt-2 text-gray-600">Schedule and manage your client meetings</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <button onClick={() => setShowModal(true)} className="btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Meeting
              </button>
            </div>
          </div>
        </div>

        {/* Upcoming Meetings */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upcoming</h2>
          {upcomingMeetings.length === 0 ? (
            <div className="card p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-600">No upcoming meetings</p>
            </div>
          ) : (
            <div className="space-y-4">
              {upcomingMeetings.map((meeting) => (
                <div key={meeting.id} className="card p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{meeting.title}</h3>
                      {meeting.client && (
                        <p className="text-sm text-gray-600 mt-1">
                          Client:{' '}
                          <Link
                            href={`/clients/${meeting.client.id}`}
                            className="text-primary-600 hover:text-primary-700"
                          >
                            {meeting.client.name}
                          </Link>
                        </p>
                      )}
                      {meeting.description && (
                        <p className="text-sm text-gray-600 mt-2">{meeting.description}</p>
                      )}
                      <p className="text-sm text-gray-500 mt-2">
                        {formatRelativeTime(meeting.meeting_time)} · {meeting.duration_minutes}{' '}
                        minutes
                      </p>
                    </div>
                    <div className="ml-4 flex space-x-2">
                      <button
                        onClick={() => handleOpenMeet(meeting.meeting_link || undefined)}
                        className="btn-primary text-sm"
                      >
                        <Video className="w-4 h-4 mr-1" />
                        {meeting.meeting_link ? 'Join' : 'Create'} Meeting
                      </button>
                      <button
                        onClick={() => handleDeleteMeeting(meeting.id)}
                        className="btn-secondary text-sm text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Meetings */}
        {pastMeetings.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Past</h2>
            <div className="space-y-4">
              {pastMeetings.map((meeting) => (
                <div key={meeting.id} className="card p-6 opacity-75">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">{meeting.title}</h3>
                      {meeting.client && (
                        <p className="text-sm text-gray-600 mt-1">Client: {meeting.client.name}</p>
                      )}
                      <p className="text-sm text-gray-500 mt-2">
                        {formatRelativeTime(meeting.meeting_time)}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteMeeting(meeting.id)}
                      className="text-sm text-gray-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* New Meeting Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-30"
              onClick={() => setShowModal(false)}
            />

            <div className="relative bg-white rounded-lg max-w-2xl w-full p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Schedule Meeting</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="title" className="label">
                    Meeting Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="input"
                    placeholder="Project kickoff meeting"
                  />
                </div>

                <div>
                  <label htmlFor="client_id" className="label">
                    Client
                  </label>
                  <select
                    id="client_id"
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                    className="input"
                  >
                    <option value="">No client (personal meeting)</option>
                    {clients.length > 0 ? (
                      clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))
                    ) : (
                      <option disabled>No clients available</option>
                    )}
                  </select>
                  {clients.length === 0 && (
                    <p className="mt-1 text-sm text-gray-500">
                      <Link href="/clients/new" className="text-primary-600 hover:text-primary-700">
                        Add a client
                      </Link>{' '}
                      to associate meetings
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="description" className="label">
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input"
                    placeholder="Agenda and notes..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="meeting_time" className="label">
                      Date & Time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      id="meeting_time"
                      required
                      value={formData.meeting_time}
                      onChange={(e) => setFormData({ ...formData, meeting_time: e.target.value })}
                      className="input"
                    />
                  </div>

                  <div>
                    <label htmlFor="duration_minutes" className="label">
                      Duration
                    </label>
                    <select
                      id="duration_minutes"
                      value={formData.duration_minutes}
                      onChange={(e) =>
                        setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })
                      }
                      className="input"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={90}>1.5 hours</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="meeting_link" className="label">
                    Google Meet Link (optional)
                  </label>
                  <input
                    type="url"
                    id="meeting_link"
                    value={formData.meeting_link}
                    onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                    className="input"
                    placeholder="https://meet.google.com/abc-defg-hij"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Leave blank to create the meeting link later
                  </p>
                </div>

                <div>
                  <label htmlFor="reminder_minutes" className="label">
                    Remind Me
                  </label>
                  <select
                    id="reminder_minutes"
                    value={formData.reminder_minutes}
                    onChange={(e) =>
                      setFormData({ ...formData, reminder_minutes: parseInt(e.target.value) })
                    }
                    className="input"
                  >
                    <option value={5}>5 minutes before</option>
                    <option value={10}>10 minutes before</option>
                    <option value={15}>15 minutes before</option>
                    <option value={30}>30 minutes before</option>
                    <option value={60}>1 hour before</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="btn-primary">
                    {saving ? 'Scheduling...' : 'Schedule Meeting'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
