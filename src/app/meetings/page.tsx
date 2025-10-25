'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { MeetingsListSkeleton } from '@/components/SkeletonLoaders'
import { createBrowserClient } from '@/lib/supabase'
import { MeetingWithDetails, Client } from '@/types/database'
import { formatRelativeTime, formatDateForInput } from '@/lib/date-utils'
import { Plus, Calendar, ExternalLink, Video, X } from 'lucide-react'
import Link from 'next/link'
import { TopBar } from '@/components/TopBar'

export default function MeetingsPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const [meetings, setMeetings] = useState<MeetingWithDetails[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    client_id: '',
    meeting_time: '',
    duration_minutes: 30,
    meeting_link: '',
    reminder_minutes: 15,
  })

  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Add your logic to save the meeting here
      // Example: await supabase.from('meetings').insert([{ ...formData, user_id: user.id }])
      setShowModal(false)
      setFormData({
        title: '',
        description: '',
        client_id: '',
        meeting_time: '',
        duration_minutes: 30,
        meeting_link: '',
        reminder_minutes: 15,
      })
    } catch (err: any) {
      setError('Failed to schedule meeting.')
      console.error('[MeetingsPage] handleSubmit error:', err)
    } finally {
      setSaving(false)
    }
  }

  // Top-level log for debugging
  console.log('[MeetingsPage] Rendered. user:', user, 'authLoading:', authLoading)

  const [supabaseConfigError, setSupabaseConfigError] = useState<string | null>(null)
  const [supabase, setSupabase] = useState<any>(null)

  useEffect(() => {
    try {
      const client = createBrowserClient()
      setSupabase(client)
      setSupabaseConfigError(null)
    } catch (err: any) {
      setSupabaseConfigError(err?.message || 'Supabase configuration error.')
      console.error('[MeetingsPage] Supabase config error:', err)
    }
  }, [])

  if (supabaseConfigError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="mb-8 bg-red-50 border-l-4 border-red-500 rounded-xl p-6 max-w-xl w-full">
          <h2 className="text-lg font-bold text-red-900 mb-2">⚠️ Supabase Configuration Error</h2>
          <p className="text-red-700 mb-4">{supabaseConfigError}</p>
          <p className="text-gray-700 text-sm">Check your deployment settings and .env files. See console for details.</p>
        </div>
      </div>
    )
  }

  if (authLoading || isLoading) {
    return <MeetingsListSkeleton />
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="mb-8 bg-red-50 border-l-4 border-red-500 rounded-xl p-6 max-w-xl w-full">
          <h2 className="text-lg font-bold text-red-900 mb-2">⚠️ Error Loading Meetings</h2>
          <p className="text-red-700 mb-4">{error}</p>
          <p className="text-gray-700 text-sm">Check your Supabase configuration, RLS policies, and database setup. See console for details.</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen">
      <TopBar
        title="Meetings"
        description="Schedule and manage your client meetings"
        actions={
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Schedule Meeting
          </button>
        }
      />

      <div className="p-6 lg:p-8">
        {/* Filters and Search */}
        <div className="card p-6 mb-6">
          <div className="relative">
            {/* Filters and Search UI goes here */}
          </div>
        </div>
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
                {/* ...existing code... */}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
