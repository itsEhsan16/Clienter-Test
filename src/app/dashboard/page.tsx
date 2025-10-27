'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/TopBar'
import { DashboardSkeleton } from '@/components/SkeletonLoaders'
import { createBrowserClient } from '@/lib/supabase'
import { Client, ReminderWithMeeting } from '@/types/database'
import { formatRelativeTime, formatTimeAgo } from '@/lib/date-utils'
import { Plus, Users, Calendar, Clock, TrendingUp, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const [recentClients, setRecentClients] = useState<Client[]>([])
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderWithMeeting[]>([])
  const [stats, setStats] = useState({
    clients: 0,
    meetings: 0,
    totalRevenue: 0,
    totalPaid: 0,
    totalDue: 0,
  })
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = useMemo(() => createBrowserClient(), [])

  useEffect(() => {
    console.log('[Dashboard] useEffect: authLoading', authLoading, 'user', user)
    // If auth is still initializing, show loader until it finishes.
    if (authLoading) {
      setIsLoading(true)
      return
    }

    // If auth finished but there's no user, stop loading (prevents infinite skeleton)
    if (!user) {
      console.log('[Dashboard] No user found, stopping loading.')
      setIsLoading(false)
      return
    }

    console.log('before fetchDashboardData')

    const fetchDashboardData = async () => {
      console.log('yooooh [Dashboard] Fetching dashboard data for user:', user.id)

      setIsLoading(true)
      setError(null)

      // Add timeout to prevent infinite hanging
      const timeout = setTimeout(() => {
        console.error('[Dashboard] Fetch timeout after 30 seconds')
        setError(
          'Dashboard fetch timed out after 30 seconds. This indicates a network or database issue.'
        )
        setIsLoading(false)
      }, 30000)

      try {
        console.log('inside try block of fetchDashboardData, before fetching data')

        // Log Supabase configuration for debugging
        console.log('[Dashboard] Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
        console.log('[Dashboard] Supabase Key exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

        console.log('[Dashboard] Starting individual queries...')

        // Test basic network connectivity to Supabase
        console.log('[Dashboard] Testing basic network connectivity to Supabase...')
        try {
          const response = await fetch('https://zviakkdqtmhqfkxjjqvn.supabase.co/rest/v1/', {
            method: 'HEAD',
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            },
          })
          console.log(
            '[Dashboard] Basic network test result:',
            response.status,
            response.statusText
          )
          if (!response.ok) {
            setError(`Network connectivity issue: ${response.status} ${response.statusText}`)
            return
          }
        } catch (networkError: any) {
          console.error('[Dashboard] Basic network test failed:', networkError)
          setError(
            'Network connectivity error: ' + (networkError?.message || 'Cannot reach Supabase')
          )
          return
        }

        // Test Supabase connection first
        console.log('[Dashboard] Testing Supabase connection...')
        try {
          const { data: testData, error: testError } = await supabase
            .from('profiles')
            .select('id')
            .limit(1)
          console.log('[Dashboard] Supabase connection test result:', {
            data: testData,
            error: testError,
          })
          if (testError) {
            console.error('[Dashboard] Supabase connection test failed:', testError)
            setError('Supabase connection failed: ' + testError.message)
            return
          }
        } catch (connError: any) {
          console.error('[Dashboard] Supabase connection test threw exception:', connError)
          setError('Supabase connection error: ' + (connError?.message || 'Unknown network error'))
          return
        }

        console.log('[Dashboard] Fetching clients...')
        const clientsResult = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)
        console.log('[Dashboard] Clients fetch result:', clientsResult)

        console.log('[Dashboard] Fetching reminders...')
        const remindersResult = await supabase
          .from('reminders')
          .select(`*,meeting:meetings (*,client:clients (*))`)
          .eq('user_id', user.id)
          .eq('is_dismissed', false)
          .gte('remind_at', new Date().toISOString())
          .order('remind_at', { ascending: true })
          .limit(5)
        console.log('[Dashboard] Reminders fetch result:', remindersResult)

        console.log('[Dashboard] Fetching clients count...')
        const clientsCountResult = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
        console.log('[Dashboard] Clients count fetch result:', clientsCountResult)

        console.log('[Dashboard] Fetching all clients for revenue calculation...')
        const allClientsResult = await supabase
          .from('clients')
          .select('total_amount, advance_paid')
          .eq('user_id', user.id)
        console.log('[Dashboard] All clients fetch result:', allClientsResult)

        console.log('[Dashboard] Fetching meetings count...')
        const meetingsCountResult = await supabase
          .from('meetings')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
        console.log('[Dashboard] Meetings count fetch result:', meetingsCountResult)

        console.log('[Dashboard] All queries completed, processing results...')

        // Clear timeout since we completed successfully
        clearTimeout(timeout)

        // Log fetch results for debugging
        console.log('[Dashboard] Clients fetch result:', clientsResult)
        console.log('[Dashboard] Reminders fetch result:', remindersResult)
        console.log('[Dashboard] Clients count fetch result:', clientsCountResult)
        console.log('[Dashboard] Meetings count fetch result:', meetingsCountResult)

        // Check for errors in any result
        if (clientsResult.error) {
          setError('Clients fetch error: ' + clientsResult.error.message)
          console.error('[Dashboard] Clients fetch error:', clientsResult.error)
          return
        }
        if (remindersResult.error) {
          setError('Reminders fetch error: ' + remindersResult.error.message)
          console.error('[Dashboard] Reminders fetch error:', remindersResult.error)
          return
        }
        if (clientsCountResult.error) {
          setError('Clients count fetch error: ' + clientsCountResult.error.message)
          console.error('[Dashboard] Clients count fetch error:', clientsCountResult.error)
          return
        }
        if (meetingsCountResult.error) {
          setError('Meetings count fetch error: ' + meetingsCountResult.error.message)
          console.error('[Dashboard] Meetings count fetch error:', meetingsCountResult.error)
          return
        }
        if (allClientsResult.error) {
          setError('All clients fetch error: ' + allClientsResult.error.message)
          console.error('[Dashboard] All clients fetch error:', allClientsResult.error)
          return
        }

        // Log if no data returned
        if (!clientsResult.data || clientsResult.data.length === 0) {
          console.warn('[Dashboard] No clients data fetched.')
        }
        if (!remindersResult.data || remindersResult.data.length === 0) {
          console.warn('[Dashboard] No reminders data fetched.')
        }
        if (!clientsCountResult.count) {
          console.warn('[Dashboard] No clients count fetched.')
        }
        if (!meetingsCountResult.count) {
          console.warn('[Dashboard] No meetings count fetched.')
        }

        // Calculate totals
        const allClients = allClientsResult.data || []
        const totalRevenue = allClients.reduce((sum, c) => sum + (c.total_amount || 0), 0)
        const totalPaid = allClients.reduce((sum, c) => sum + (c.advance_paid || 0), 0)
        const totalDue = totalRevenue - totalPaid

        setRecentClients(clientsResult.data || [])
        setUpcomingReminders(remindersResult.data || [])
        setStats({
          clients: clientsCountResult.count || 0,
          meetings: meetingsCountResult.count || 0,
          totalRevenue,
          totalPaid,
          totalDue,
        })

        if ((clientsResult.data || []).length === 0) {
          setShowOnboarding(true)
        }
      } catch (err: any) {
        clearTimeout(timeout)
        setError('Dashboard fetch error: ' + (err?.message || 'Unknown error'))
        console.error('[Dashboard] Error fetching dashboard data:', err)
      } finally {
        clearTimeout(timeout)
        setIsLoading(false)
      }
    }

    console.log('after fetchDashboardData')

    fetchDashboardData()
  }, [user, authLoading, supabase])

  // Show skeleton while loading
  if (authLoading || isLoading) {
    return <DashboardSkeleton />
  }

  // If no user after loading, show fallback UI
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-xl w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-orange-600 mb-4">You are not logged in</h1>
          <p className="text-gray-700 mb-6">
            Please{' '}
            <a href="/login" className="text-blue-600 underline">
              log in
            </a>{' '}
            to view your dashboard.
          </p>
          <a href="/login" className="btn-primary">
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <TopBar
        title={`Welcome back${profile?.full_name ? `, ${profile.full_name}` : ''}!`}
        description="Here's what's happening with your freelance business today."
      />

      <div className="p-6 lg:p-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-8 bg-red-50 border-l-4 border-red-500 rounded-xl p-6">
            <h2 className="text-lg font-bold text-red-900 mb-2">⚠️ Error Loading Dashboard</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <p className="text-gray-700">
              Check your Supabase configuration, RLS policies, and database setup. See console for
              details.
            </p>
          </div>
        )}
        {/* Onboarding Banner */}
        {showOnboarding && !error && (
          <div className="mb-8 bg-gradient-to-r from-orange-50 to-orange-100 border-l-4 border-orange-500 rounded-xl p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">🎉 Welcome to Clienter!</h2>
            <p className="text-gray-700 mb-4">
              Get started by adding your first client. You can schedule meetings and we'll remind
              you before they start.
            </p>
            <Link href="/clients/new" className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Client
            </Link>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="stat-card group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                <Users className="w-6 h-6 text-orange-600 group-hover:text-white transition-colors" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.clients}</span>
            </div>
            <p className="text-sm font-semibold text-gray-600">Total Clients</p>
          </div>

          <div className="stat-card group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                <Calendar className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.meetings}</span>
            </div>
            <p className="text-sm font-semibold text-gray-600">Upcoming Meetings</p>
          </div>

          <div className="stat-card group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-500 transition-colors">
                <TrendingUp className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
              </div>
              <span className="text-3xl font-bold text-gray-900">
                ${stats.totalRevenue.toFixed(0)}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-600">Total Revenue</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Upcoming Reminders */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-orange-500" />
                  Upcoming Reminders
                </h2>
                <Link
                  href="/meetings"
                  className="text-sm font-semibold text-orange-500 hover:text-orange-600 flex items-center group"
                >
                  View all
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
            <div className="p-6">
              {upcomingReminders.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No upcoming reminders</p>
                </div>
              ) : (
                <ul className="space-y-4">
                  {upcomingReminders.map((reminder) => (
                    <li
                      key={reminder.id}
                      className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-2 h-2 bg-orange-500 rounded-full mt-2" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">
                          {reminder.meeting.title}
                        </p>
                        {reminder.meeting.client && (
                          <p className="text-xs text-gray-500">{reminder.meeting.client.name}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatRelativeTime(reminder.meeting.meeting_time)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recent Clients */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <Users className="w-5 h-5 mr-2 text-orange-500" />
                  Recent Clients
                </h2>
                <Link
                  href="/clients"
                  className="text-sm font-semibold text-orange-500 hover:text-orange-600 flex items-center group"
                >
                  View all
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
            <div className="p-6">
              {recentClients.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">No clients yet</p>
                  <Link href="/clients/new" className="btn-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Client
                  </Link>
                </div>
              ) : (
                <ul className="space-y-3">
                  {recentClients.map((client) => (
                    <li key={client.id}>
                      <Link
                        href={`/clients/${client.id}`}
                        className="block p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 group-hover:text-orange-600 transition-colors">
                              {client.name}
                            </p>
                            {client.project_description && (
                              <p className="text-xs text-gray-500 truncate">
                                {client.project_description}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 ml-2">
                            {formatTimeAgo(client.created_at)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/clients/new"
            className="card p-6 hover:shadow-lg hover:border-orange-200 transition-all group"
          >
            <div className="flex items-center">
              <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <Plus className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Add Client</h3>
                <p className="text-sm text-gray-600">Create a new client profile</p>
              </div>
            </div>
          </Link>

          <Link
            href="/meetings"
            className="card p-6 hover:shadow-lg hover:border-orange-200 transition-all group"
          >
            <div className="flex items-center">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform">
                <Calendar className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Schedule Meeting</h3>
                <p className="text-sm text-gray-600">Plan your next client meeting</p>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
