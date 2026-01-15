'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/TopBar'
import { DashboardSkeleton } from '@/components/SkeletonLoaders'
import { ProfileErrorBanner } from '@/components/ProfileErrorBanner'
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
  const {
    user,
    profile,
    loading: authLoading,
    profileLoading,
    profileError,
    supabase,
    organization,
  } = useAuth()
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
    console.log('[Dashboard] useEffect:', {
      authLoading,
      user: user?.id,
      organization: organization?.organizationId,
      hasFetched,
    })

    // Wait for auth to complete
    if (authLoading) {
      return
    }

    // No user = not logged in
    if (!user || !supabase) {
      setIsLoading(false)
      return
    }

    // Already fetched
    if (hasFetched) {
      setIsLoading(false)
      return
    }

    // Fetch data - don't wait for organization, use it if available
    const fetchDashboardData = async () => {
      console.log('[Dashboard] Fetching data for user:', user.id)
      setIsLoading(true)
      setError(null)

      try {
        // Use organization ID if available, otherwise queries will use RLS with user context
        const orgId = organization?.organizationId

        // Parallel data fetching with timeout
        const timeout = (ms: number) =>
          new Promise((_, reject) => setTimeout(() => reject(new Error('Query timeout')), ms))

        const [clientsRes, projectsRes, meetingsRes, expensesRes] = await Promise.all([
          // Recent clients
          orgId
            ? supabase
                .from('clients')
                .select('*')
                .eq('organization_id', orgId)
                .order('created_at', { ascending: false })
                .limit(5)
            : supabase
                .from('clients')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5),

          // All projects for stats
          orgId
            ? supabase
                .from('projects')
                .select('budget, total_paid, status, created_at')
                .eq('organization_id', orgId)
            : supabase.from('projects').select('budget, total_paid, status, created_at'),

          // Meetings count
          orgId
            ? supabase
                .from('meetings')
                .select('*', { count: 'exact', head: true })
                .eq('organization_id', orgId)
            : supabase.from('meetings').select('*', { count: 'exact', head: true }),

          // Expenses
          orgId
            ? supabase.from('expenses').select('amount').eq('organization_id', orgId)
            : supabase.from('expenses').select('amount'),
        ])

        // Process results even if some fail
        const clients = clientsRes.data || []
        const projects = projectsRes.data || []
        const expensesData = expensesRes.data || []

        // Calculate stats from projects
        const newClients = projects.filter((p: any) => p.status === 'new').length
        const ongoingClients = projects.filter((p: any) => p.status === 'ongoing').length
        const completedClients = projects.filter((p: any) => p.status === 'completed').length

        const totalRevenue = projects.reduce(
          (sum: number, p: any) => sum + (Number(p.budget) || 0),
          0
        )
        const totalPaid = projects.reduce(
          (sum: number, p: any) => sum + (Number(p.total_paid) || 0),
          0
        )
        const totalPending = totalRevenue - totalPaid
        const totalExpenses = expensesData.reduce(
          (sum: number, e: any) => sum + (Number(e.amount) || 0),
          0
        )
        const profit = totalPaid - totalExpenses

        // Monthly calculations
        const now = new Date()
        const currentMonth = now.getMonth()
        const currentYear = now.getFullYear()
        const monthlyProjects = projects.filter((p: any) => {
          const d = new Date(p.created_at)
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear
        })

        const monthlyRevenue = monthlyProjects.reduce(
          (sum: number, p: any) => sum + (Number(p.budget) || 0),
          0
        )
        const monthlyPaid = monthlyProjects.reduce(
          (sum: number, p: any) => sum + (Number(p.total_paid) || 0),
          0
        )

        // Calculate monthly trend data
        const monthlyDataCalc: MonthlyStats[] = []
        for (let i = 5; i >= 0; i--) {
          const date = new Date(currentYear, currentMonth - i, 1)
          const month = date.toLocaleString('default', { month: 'short' })
          const year = date.getFullYear()
          const targetMonth = date.getMonth()

          const projectsInMonth = projects.filter((p: any) => {
            const d = new Date(p.created_at)
            return d.getMonth() === targetMonth && d.getFullYear() === year
          })

          const revenue = projectsInMonth.reduce(
            (sum: number, p: any) => sum + (Number(p.budget) || 0),
            0
          )
          const paid = projectsInMonth.reduce(
            (sum: number, p: any) => sum + (Number(p.total_paid) || 0),
            0
          )

          monthlyDataCalc.push({
            month: `${month} ${year}`,
            revenue,
            paid,
            pending: revenue - paid,
            clientCount: projectsInMonth.length,
          })
        }

        setRecentClients(clients)
        setMonthlyData(monthlyDataCalc)
        setStats({
          newClients,
          ongoingClients,
          completedClients,
          totalClients: clients.length,
          meetings: meetingsRes.count || 0,
          totalRevenue,
          totalPaid,
          totalPending,
          monthlyRevenue,
          monthlyPaid,
          monthlyPending: monthlyRevenue - monthlyPaid,
          monthlyNewClients: monthlyProjects.length,
          totalExpenses,
          profit,
        })

        if (clients.length === 0) {
          setShowOnboarding(true)
        }

        setHasFetched(true)
        console.log('[Dashboard] Data loaded successfully')
      } catch (err: any) {
        console.error('[Dashboard] Fetch error:', err)
        setError(err?.message || 'Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [user, authLoading, supabase, organization?.organizationId, hasFetched])

  // Reset hasFetched when organization changes to allow refetch
  useEffect(() => {
    if (organization?.organizationId && hasFetched) {
      // Only reset if we've fetched before but org changed
      console.log('[Dashboard] Organization changed, will refetch on next render')
    }
  }, [organization?.organizationId])

  // Callback for when profile retry succeeds
  const handleProfileRetrySuccess = useCallback(() => {
    console.log('[Dashboard] Profile retry succeeded, resetting fetch state')
    setHasFetched(false)
    setError(null)
  }, [])

  // Show skeleton while auth is initializing or data is loading
  // Keep skeleton visible during the entire auth initialization to prevent flash of "not logged in"
  if (authLoading || profileLoading || (isLoading && !profileError)) {
    return <DashboardSkeleton />
  }

  // Only show "not logged in" if auth has FULLY completed and there's definitely no user
  // The middleware should redirect unauthenticated users, so this is a fallback
  if (!user && !authLoading && !profileLoading) {
    // Double-check by redirecting to login - middleware should handle this
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    return <DashboardSkeleton />
  }

  // If we have a user but still loading, show skeleton
  if (!user) {
    return <DashboardSkeleton />
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
        {/* Profile Error Banner - show when profile failed to load */}
        <ProfileErrorBanner onRetrySuccess={handleProfileRetrySuccess} showSignOut={true} />

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
