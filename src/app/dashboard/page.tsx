'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/TopBar'
import { DashboardSkeleton } from '@/components/SkeletonLoaders'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Client, ReminderWithMeeting } from '@/types/database'
import { formatRelativeTime, formatTimeAgo } from '@/lib/date-utils'
import { Plus, Users, Calendar, Clock, TrendingUp, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const [recentClients, setRecentClients] = useState<Client[]>([])
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderWithMeeting[]>([])
  const [stats, setStats] = useState({ clients: 0, meetings: 0, projects: 0 })
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createClientComponentClient(), [])

  useEffect(() => {
    if (!user || authLoading) return

    const fetchDashboardData = async () => {
      setIsLoading(true)
      try {
        // Parallel data fetching for better performance
        const [clientsResult, remindersResult, clientCount, meetingCount, projectCount] =
          await Promise.all([
            // Fetch recent clients
            supabase
              .from('clients')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(5),

            // Fetch upcoming reminders
            supabase
              .from('reminders')
              .select(
                `
                *,
                meeting:meetings (
                  *,
                  client:clients (*),
                  project:projects (*)
                )
              `
              )
              .eq('user_id', user.id)
              .eq('is_dismissed', false)
              .gte('remind_at', new Date().toISOString())
              .order('remind_at', { ascending: true })
              .limit(5),

            // Fetch stats in parallel
            supabase
              .from('clients')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id),

            supabase
              .from('meetings')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .gte('meeting_time', new Date().toISOString()),

            supabase
              .from('projects')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', 'active'),
          ])

        // Process clients
        if (clientsResult.data) {
          setRecentClients(clientsResult.data)
          if (clientsResult.data.length === 0) {
            setShowOnboarding(true)
          }
        }

        // Process reminders
        if (remindersResult.data) {
          setUpcomingReminders(remindersResult.data as ReminderWithMeeting[])
        }

        // Set stats
        setStats({
          clients: clientCount.count || 0,
          meetings: meetingCount.count || 0,
          projects: projectCount.count || 0,
        })
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        setShowOnboarding(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [user, authLoading, supabase])

  // Show skeleton while loading
  if (authLoading || isLoading) {
    return <DashboardSkeleton />
  }

  if (!user) return null

  return (
    <div className="min-h-screen">
      <TopBar
        title={`Welcome back${profile?.full_name ? `, ${profile.full_name}` : ''}!`}
        description="Here's what's happening with your freelance business today."
      />

      <div className="p-6 lg:p-8">
        {/* Onboarding Banner */}
        {showOnboarding && (
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
              <span className="text-3xl font-bold text-gray-900">{stats.projects}</span>
            </div>
            <p className="text-sm font-semibold text-gray-600">Active Projects</p>
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
                            {client.company && (
                              <p className="text-xs text-gray-500">{client.company}</p>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 ml-2">
                            {formatTimeAgo(client.created_at)}
                          </p>
                        </div>
                        {Array.isArray(client.tags) && client.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {client.tags.slice(0, 3).map((tag) => (
                              <span key={tag} className="badge-gray">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
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
