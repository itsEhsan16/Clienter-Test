'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/TopBar'
import { DashboardSkeleton } from '@/components/SkeletonLoaders'
import { Client, ReminderWithMeeting } from '@/types/database'
import { formatRelativeTime, formatTimeAgo } from '@/lib/date-utils'
import { formatCurrency, getClientStatusColor, getClientStatusLabel } from '@/lib/utils'
import { format } from 'date-fns'
import {
  Plus,
  Users,
  Calendar,
  Clock,
  TrendingUp,
  ArrowRight,
  AlertCircle,
  CheckCircle,
  Briefcase,
  TrendingDown,
} from 'lucide-react'
import Rupee from '@/components/Rupee'
import Link from 'next/link'

interface MonthlyStats {
  month: string
  revenue: number
  paid: number
  pending: number
  clientCount: number
}

export default function DashboardPage() {
  const { user, profile, loading: authLoading, supabase, organization } = useAuth()
  const [recentClients, setRecentClients] = useState<Client[]>([])
  const [upcomingReminders, setUpcomingReminders] = useState<ReminderWithMeeting[]>([])
  const [stats, setStats] = useState({
    newClients: 0,
    ongoingClients: 0,
    completedClients: 0,
    totalClients: 0,
    meetings: 0,
    totalRevenue: 0,
    totalPaid: 0,
    totalPending: 0,
    monthlyRevenue: 0,
    monthlyPaid: 0,
    monthlyPending: 0,
    monthlyNewClients: 0,
    totalExpenses: 0,
    profit: 0,
  })
  const [monthlyData, setMonthlyData] = useState<MonthlyStats[]>([])
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasFetched, setHasFetched] = useState(false)
  const [teamEarnings, setTeamEarnings] = useState({
    totalProjects: 0,
    totalEarned: 0,
    totalReceived: 0,
    totalPending: 0,
    recentPayments: [] as any[],
  })

  useEffect(() => {
    console.log(
      '[Dashboard] useEffect: authLoading',
      authLoading,
      'user',
      user,
      'hasFetched',
      hasFetched
    )

    // If auth is still initializing, show loader
    if (authLoading) {
      setIsLoading(true)
      return
    }

    // If auth finished but there's no user, clear loading
    if (!user || !supabase) {
      console.log('[Dashboard] No user or supabase found after auth loading completed')
      setIsLoading(false)
      return
    }

    // Skip if we've already fetched data
    if (hasFetched) {
      console.log('[Dashboard] Data already fetched, skipping refetch')
      setIsLoading(false)
      return
    }

    const fetchDashboardData = async () => {
      console.log('[Dashboard] Fetching dashboard data for user:', user.id)

      // Verify we have a valid supabase client with auth
      if (!supabase) {
        setError('Supabase client not initialized')
        setIsLoading(false)
        return
      }

      // Check if we have a valid session
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()
        console.log('[Dashboard] Current session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          userIdMatch: session?.user?.id === user.id,
          error: sessionError,
          accessToken: session?.access_token ? 'present' : 'missing',
        })

        if (!session) {
          console.error('[Dashboard] No session found!')
          setError('No active session found. Please try logging out and back in.')
          setIsLoading(false)
          return
        }

        if (session.user.id !== user.id) {
          console.error('[Dashboard] Session user mismatch:', {
            contextUserId: user.id,
            sessionUserId: session.user.id,
          })
          setError('Session user mismatch. Please refresh the page.')
          setIsLoading(false)
          return
        }

        // Verify access token is present
        if (!session.access_token) {
          console.error('[Dashboard] No access token in session!')
          setError('Authentication token missing. Please log out and log in again.')
          setIsLoading(false)
          return
        }
      } catch (sessionCheckError) {
        console.error('[Dashboard] Session check failed:', sessionCheckError)
        setError('Failed to verify session. Please try refreshing the page.')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      // Add timeout to prevent infinite hanging
      const timeoutId = setTimeout(() => {
        console.error('[Dashboard] Fetch timeout after 15 seconds')
        setError(
          'Dashboard is taking too long to load. Please check your internet connection and try refreshing the page.'
        )
        setIsLoading(false)
      }, 15000)

      try {
        console.log('[Dashboard] Starting data queries for user:', user.id)

        // Helper function to add timeout to any promise
        const withTimeout = <T,>(
          promise: Promise<T>,
          timeoutMs: number,
          operation: string
        ): Promise<T> => {
          return Promise.race([
            promise,
            new Promise<T>((_, reject) =>
              setTimeout(
                () => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)),
                timeoutMs
              )
            ),
          ])
        }

        // Fetch all data with proper error handling and timeout
        const [
          clientsResult,
          remindersResult,
          clientsCountResult,
          allClientsResult,
          meetingsCountResult,
          expensesResult,
        ] = await withTimeout(
          Promise.all([
            supabase
              .from('clients')
              .select('*')
              .eq('organization_id', organization?.organizationId)
              .order('created_at', { ascending: false })
              .limit(5)
              .then((result: any) => {
                console.log('[Dashboard] Clients query result:', {
                  error: result.error,
                  count: result.data?.length || 0,
                  status: result.status,
                  statusText: result.statusText,
                })
                return result
              }),

            supabase
              .from('reminders')
              .select(`*,meeting:meetings (*,client:clients (*))`)
              .eq('organization_id', organization?.organizationId)
              .eq('is_dismissed', false)
              .gte('remind_at', new Date().toISOString())
              .order('remind_at', { ascending: true })
              .limit(5)
              .then((result: any) => {
                console.log('[Dashboard] Reminders query result:', {
                  error: result.error,
                  count: result.data?.length || 0,
                })
                return result
              }),

            supabase
              .from('clients')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', organization?.organizationId)
              .then((result: any) => {
                console.log('[Dashboard] Clients count result:', {
                  error: result.error,
                  count: result.count,
                })
                return result
              }),

            supabase
              .from('projects')
              .select('budget, total_paid, status, created_at')
              .eq('organization_id', organization?.organizationId)
              .then((result: any) => {
                console.log('[Dashboard] All projects result:', {
                  error: result.error,
                  count: result.data?.length || 0,
                })
                return result
              }),

            supabase
              .from('meetings')
              .select('*', { count: 'exact', head: true })
              .eq('organization_id', organization?.organizationId)
              .then((result: any) => {
                console.log('[Dashboard] Meetings count result:', {
                  error: result.error,
                  count: result.count,
                })
                return result
              }),

            supabase
              .from('expenses')
              .select('amount')
              .eq('organization_id', organization?.organizationId)
              .then((result: any) => {
                console.log('[Dashboard] Expenses result:', {
                  error: result.error,
                  count: result.data?.length || 0,
                })
                return result
              }),
          ]),
          10000,
          'Dashboard data fetch'
        )

        console.log('[Dashboard] All queries completed successfully')

        // Clear timeout since we completed successfully
        clearTimeout(timeoutId)

        // Check for errors in any result
        if (clientsResult.error) {
          console.error('[Dashboard] Clients fetch error:', clientsResult.error)
          setError('Failed to load clients: ' + clientsResult.error.message)
          return
        }
        if (remindersResult.error) {
          console.error('[Dashboard] Reminders fetch error:', remindersResult.error)
          console.warn('[Dashboard] Continuing without reminders')
        }
        if (clientsCountResult.error) {
          console.error('[Dashboard] Clients count error:', clientsCountResult.error)
        }
        if (allClientsResult.error) {
          console.error('[Dashboard] All clients error:', allClientsResult.error)
        }
        if (meetingsCountResult.error) {
          console.error('[Dashboard] Meetings count error:', meetingsCountResult.error)
        }
        if (expensesResult.error) {
          console.error('[Dashboard] Expenses fetch error:', expensesResult.error)
        }

        // Calculate totals and statistics from projects (project-based financial model)
        const allProjects = allClientsResult.data || []

        const getPaid = (p: any) => Number(p.total_paid || 0)

        // Status-based counts (projects)
        const newClients = allProjects.filter((p: any) => p.status === 'new').length
        const ongoingClients = allProjects.filter((p: any) => p.status === 'ongoing').length
        const completedClients = allProjects.filter((p: any) => p.status === 'completed').length

        // Overall totals (all statuses)
        const totalRevenue = allProjects.reduce(
          (sum: number, p: any) => sum + (Number(p.budget) || 0),
          0
        )
        const totalPaid = allProjects.reduce((sum: number, p: any) => sum + getPaid(p), 0)
        const totalPending = totalRevenue - totalPaid

        // Monthly calculations (current month)
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        const monthlyProjects = allProjects.filter((p: any) => {
          const createdDate = new Date(p.created_at)
          return (
            createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear
          )
        })

        const monthlyRevenue = monthlyProjects.reduce(
          (sum: number, p: any) => sum + (Number(p.budget) || 0),
          0
        )
        const monthlyPaid = monthlyProjects.reduce((sum: number, p: any) => sum + getPaid(p), 0)
        const monthlyPending = monthlyRevenue - monthlyPaid

        // Calculate monthly data for the last 6 months
        const monthlyDataCalc: MonthlyStats[] = []
        for (let i = 5; i >= 0; i--) {
          const date = new Date(currentYear, currentMonth - i, 1)
          const month = date.toLocaleString('default', { month: 'short' })
          const year = date.getFullYear()
          const targetMonth = date.getMonth()

          const projectsInMonth = allProjects.filter((p: any) => {
            const createdDate = new Date(p.created_at)
            return createdDate.getMonth() === targetMonth && createdDate.getFullYear() === year
          })

          const revenue = projectsInMonth.reduce(
            (sum: number, p: any) => sum + (Number(p.budget) || 0),
            0
          )
          const paid = projectsInMonth.reduce((sum: number, p: any) => sum + getPaid(p), 0)

          monthlyDataCalc.push({
            month: `${month} ${year}`,
            revenue,
            paid,
            pending: revenue - paid,
            clientCount: projectsInMonth.length,
          })
        }

        // Calculate total expenses
        const totalExpenses = (expensesResult.data || []).reduce(
          (sum: number, expense: any) => sum + (Number(expense.amount) || 0),
          0
        )

        // Calculate profit (Total Paid - Total Expenses)
        const profit = totalPaid - totalExpenses

        // Fetch team member earnings (if user is a team member)
        try {
          // Get assigned projects
          const { data: assignedProjects, error: projectsError } = await supabase
            .from('project_team_members')
            .select(
              `
              allocated_budget,
              total_paid,
              projects (
                id,
                name,
                clients (name, company_name)
              )
            `
            )
            .eq('team_member_id', user.id)

          if (!projectsError && assignedProjects && assignedProjects.length > 0) {
            const totalProjects = assignedProjects.length
            const totalEarned = assignedProjects.reduce(
              (sum: number, p: any) => sum + (p.allocated_budget || 0),
              0
            )
            const totalReceived = assignedProjects.reduce(
              (sum: number, p: any) => sum + (p.total_paid || 0),
              0
            )
            const totalPending = totalEarned - totalReceived

            // Get recent payments from expenses
            const projectIds = assignedProjects.map((p: any) => p.projects.id)
            const { data: recentExpenses, error: expensesError } = await supabase
              .from('expenses')
              .select(
                `
                projects (name),
                team_payment_records (
                  id,
                  amount,
                  payment_date,
                  payment_type,
                  notes
                )
              `
              )
              .in('project_id', projectIds)
              .order('created_at', { ascending: false })
              .limit(10)

            const allPayments: any[] = []
            if (!expensesError && recentExpenses) {
              recentExpenses.forEach((expense: any) => {
                if (expense.team_payment_records && expense.team_payment_records.length > 0) {
                  expense.team_payment_records.forEach((payment: any) => {
                    allPayments.push({
                      ...payment,
                      project_name: expense.projects?.name || 'Unknown Project',
                    })
                  })
                }
              })
            }

            const recentPayments = allPayments
              .sort(
                (a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
              )
              .slice(0, 5)

            setTeamEarnings({
              totalProjects,
              totalEarned,
              totalReceived,
              totalPending,
              recentPayments,
            })
          }
        } catch (earningsError) {
          console.warn('[Dashboard] Could not fetch team earnings:', earningsError)
          // Not a critical error, team member earnings are optional
        }

        setRecentClients(clientsResult.data || [])
        setUpcomingReminders(remindersResult.data || [])
        setMonthlyData(monthlyDataCalc)
        setStats({
          newClients,
          ongoingClients,
          completedClients,
          totalClients: clientsCountResult.count || 0,
          meetings: meetingsCountResult.count || 0,
          totalRevenue,
          totalPaid,
          totalPending,
          monthlyRevenue,
          monthlyPaid,
          monthlyPending,
          monthlyNewClients: monthlyProjects.length,
          totalExpenses,
          profit,
        })

        if ((clientsResult.data || []).length === 0) {
          setShowOnboarding(true)
        }

        // Mark as fetched to prevent refetching
        setHasFetched(true)
      } catch (err: any) {
        clearTimeout(timeoutId)
        console.error('[Dashboard] Error fetching dashboard data:', err)
        setError(
          'Failed to load dashboard: ' +
            (err?.message || 'Unknown error. Please try refreshing the page.')
        )
      } finally {
        clearTimeout(timeoutId)
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [user, authLoading, supabase, organization?.organizationId, hasFetched])

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

  // Get display name from profile, user metadata (OAuth), or fallback
  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    ''

  return (
    <div className="min-h-screen">
      <TopBar
        title={`Welcome back${displayName ? `, ${displayName}` : ''}!`}
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
              Get started by adding your first client. You can schedule meetings and we&apos;ll
              remind you before they start.
            </p>
            <Link href="/clients/new" className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Client
            </Link>
          </div>
        )}

        {/* testing for commit */}

        {/* Client Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="stat-card group hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-500 transition-colors">
                <AlertCircle className="w-6 h-6 text-purple-600 group-hover:text-white transition-colors" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.newClients}</span>
            </div>
            <p className="text-sm font-semibold text-gray-600">New Clients</p>
            <p className="text-xs text-gray-400 mt-1">Inquiries & leads</p>
          </div>

          <div className="stat-card group hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-500 transition-colors">
                <Briefcase className="w-6 h-6 text-green-600 group-hover:text-white transition-colors" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.ongoingClients}</span>
            </div>
            <p className="text-sm font-semibold text-gray-600">Ongoing Projects</p>
            <p className="text-xs text-gray-400 mt-1">Active clients</p>
          </div>

          <div className="stat-card group hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                <CheckCircle className="w-6 h-6 text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.completedClients}</span>
            </div>
            <p className="text-sm font-semibold text-gray-600">Completed Projects</p>
            <p className="text-xs text-gray-400 mt-1">Finished work</p>
          </div>

          <div className="stat-card group hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-500 transition-colors">
                <Users className="w-6 h-6 text-orange-600 group-hover:text-white transition-colors" />
              </div>
              <span className="text-3xl font-bold text-gray-900">{stats.totalClients}</span>
            </div>
            <p className="text-sm font-semibold text-gray-600">Total Clients</p>
            <p className="text-xs text-gray-400 mt-1">All time</p>
          </div>
        </div>

        {/* Profit & Expenses Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Profit Card */}
          <div className="stat-card group hover:shadow-2xl transition-all bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200">
            <div className="flex items-center justify-between mb-4">
              <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <div className="text-right">
                <span className="text-4xl font-bold text-emerald-700">
                  {formatCurrency(stats.profit, profile?.currency || 'INR')}
                </span>
              </div>
            </div>
            <p className="text-base font-bold text-emerald-900">Net Profit</p>
            <p className="text-sm text-emerald-700 mt-1">Revenue received minus expenses</p>
            <div className="mt-3 pt-3 border-t border-emerald-200 flex items-center justify-between text-xs">
              <span className="text-emerald-600">
                Paid: {formatCurrency(stats.totalPaid, profile?.currency || 'INR')}
              </span>
              <span className="text-red-600">
                Expenses: {formatCurrency(stats.totalExpenses, profile?.currency || 'INR')}
              </span>
            </div>
          </div>

          {/* Expenses Card */}
          <div className="stat-card group hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center group-hover:bg-red-500 transition-colors">
                <TrendingDown className="w-6 h-6 text-red-600 group-hover:text-white transition-colors" />
              </div>
              <span className="text-3xl font-bold text-gray-900">
                {formatCurrency(stats.totalExpenses, profile?.currency || 'INR')}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-600">Total Expenses</p>
            <p className="text-xs text-gray-400 mt-1">All business expenses</p>
            <Link
              href="/expenses"
              className="mt-3 inline-flex items-center text-sm text-red-600 hover:text-red-700 font-medium"
            >
              View all expenses
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        {/* Team Member Earnings Section */}
        {teamEarnings.totalProjects > 0 && (
          <div className="mb-8">
            <div className="card">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <Rupee className="w-5 h-5 mr-2 text-blue-600" size={14} />
                  My Earnings as Team Member
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Track your project payments and pending amounts
                </p>
              </div>

              <div className="p-6">
                {/* Earnings Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Total Projects</p>
                    <p className="text-2xl font-bold text-blue-600">{teamEarnings.totalProjects}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Total Earned</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(teamEarnings.totalEarned, profile?.currency || 'INR')}
                    </p>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Received</p>
                    <p className="text-2xl font-bold text-emerald-600">
                      {formatCurrency(teamEarnings.totalReceived, profile?.currency || 'INR')}
                    </p>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(teamEarnings.totalPending, profile?.currency || 'INR')}
                    </p>
                  </div>
                </div>

                {/* Recent Payments */}
                {teamEarnings.recentPayments.length > 0 && (
                  <div>
                    <h3 className="text-md font-bold text-gray-900 mb-3">Recent Payments</h3>
                    <div className="space-y-2">
                      {teamEarnings.recentPayments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{payment.project_name}</p>
                              <p className="text-xs text-gray-500">
                                {format(new Date(payment.payment_date), 'MMM dd, yyyy')} •{' '}
                                {payment.payment_type}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-green-600">
                              +{formatCurrency(payment.amount, profile?.currency || 'INR')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Revenue Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Total Revenue Overview */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Rupee className="w-5 h-5 mr-2 text-green-600" size={14} />
                Total Revenue Overview
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Total Project Value</span>
                    <span className="text-2xl font-bold text-gray-900">
                      {formatCurrency(stats.totalRevenue, profile?.currency || 'INR')}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Amount Received</span>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(stats.totalPaid, profile?.currency || 'INR')}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${
                          stats.totalRevenue > 0 ? (stats.totalPaid / stats.totalRevenue) * 100 : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Pending Amount</span>
                    <span className="text-xl font-bold text-orange-600">
                      {formatCurrency(stats.totalPending, profile?.currency || 'INR')}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${
                          stats.totalRevenue > 0
                            ? (stats.totalPending / stats.totalRevenue) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Payment Completion</span>
                    <span className="font-bold text-gray-900">
                      {stats.totalRevenue > 0
                        ? `${Math.round((stats.totalPaid / stats.totalRevenue) * 100)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Revenue */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
                This Month&apos;s Performance
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">New Clients</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.monthlyNewClients}</p>
                  </div>
                  <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Revenue</span>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(stats.monthlyRevenue, profile?.currency || 'INR')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Received</span>
                    <span className="text-lg font-bold text-blue-600">
                      {formatCurrency(stats.monthlyPaid, profile?.currency || 'INR')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <span className="text-sm font-medium text-gray-700">Pending</span>
                    <span className="text-lg font-bold text-orange-600">
                      {formatCurrency(stats.monthlyPending, profile?.currency || 'INR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Trend Chart */}
        {monthlyData.length > 0 && (
          <div className="card mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-orange-500" />
                6-Month Revenue Trend
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {monthlyData.map((data, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{data.month}</span>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="text-gray-600">
                          {data.clientCount} {data.clientCount === 1 ? 'client' : 'clients'}
                        </span>
                        <span className="font-bold text-gray-900">
                          {formatCurrency(data.revenue, profile?.currency || 'INR')}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div className="h-full flex">
                        <div
                          className="bg-green-500 h-2 transition-all"
                          style={{
                            width: `${data.revenue > 0 ? (data.paid / data.revenue) * 100 : 0}%`,
                          }}
                          title={`Paid: ${formatCurrency(data.paid, profile?.currency || 'INR')}`}
                        />
                        <div
                          className="bg-orange-400 h-2 transition-all"
                          style={{
                            width: `${data.revenue > 0 ? (data.pending / data.revenue) * 100 : 0}%`,
                          }}
                          title={`Pending: ${formatCurrency(
                            data.pending,
                            profile?.currency || 'INR'
                          )}`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Paid: {formatCurrency(data.paid, profile?.currency || 'INR')}</span>
                      <span>
                        Pending: {formatCurrency(data.pending, profile?.currency || 'INR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
                            {client.phone && (
                              <p className="text-xs text-gray-500 truncate">{client.phone}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end ml-2">
                            <p className="text-xs text-gray-400 mt-1">
                              {formatTimeAgo(client.created_at)}
                            </p>
                          </div>
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
