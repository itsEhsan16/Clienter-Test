'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import TeamMemberLayout from '@/components/TeamMemberLayout'
import {
  CheckCircle,
  Clock,
  TrendingUp,
  Users,
  Briefcase,
  Calendar,
  DollarSign,
  AlertCircle,
  ListTodo,
} from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import toast from 'react-hot-toast'

interface DashboardStats {
  totalTasks: number
  completedTasks: number
  activeTasks: number
  urgentTasks: number
  totalProjects: number
  activeProjects: number
  totalEarnings: number
  thisMonthEarnings: number
}

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  deadline: string | null
  priority: string
  created_at: string
}

interface Project {
  id: string
  name: string
  status: string
  client_name: string
}

export default function TeamDashboardPage() {
  const { user, organization, loading: authLoading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    completedTasks: 0,
    activeTasks: 0,
    urgentTasks: 0,
    totalProjects: 0,
    activeProjects: 0,
    totalEarnings: 0,
    thisMonthEarnings: 0,
  })
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [activeProjects, setActiveProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    if (!authLoading && user) {
      // Check if user is a team member (not owner)
      if (organization?.role === 'owner') {
        router.push('/dashboard')
        return
      }
      loadDashboardData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, organization])

  const loadDashboardData = async () => {
    if (!user) return

    setLoading(true)
    try {
      // Load tasks stats
      const { data: allTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)

      if (tasksError) throw tasksError

      const completedTasks = allTasks?.filter((t) => t.status === 'completed').length || 0
      const activeTasks =
        allTasks?.filter((t) => t.status === 'assigned' || t.status === 'in_progress').length || 0
      const urgentTasks = allTasks?.filter((t) => t.priority === 'urgent').length || 0

      // Get recent active tasks
      const recentActiveTasks =
        allTasks
          ?.filter((t) => t.status !== 'completed' && t.status !== 'cancelled')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5) || []

      setRecentTasks(recentActiveTasks)

      // Load projects
      const { data: projectTeamMembers, error: projectsError } = await supabase
        .from('project_team_members')
        .select(
          `
          *,
          project:project_id (
            id,
            name,
            status,
            client:client_id (
              company_name
            )
          )
        `
        )
        .eq('team_member_id', user.id)
        .eq('status', 'active')

      if (!projectsError && projectTeamMembers) {
        const projects = projectTeamMembers
          .map((ptm: any) => ({
            id: ptm.project?.id,
            name: ptm.project?.name,
            status: ptm.project?.status,
            client_name: ptm.project?.client?.company_name || 'Unknown Client',
          }))
          .filter((p) => p.id)

        setActiveProjects(projects.slice(0, 5))

        const activeProjectsCount =
          projects.filter((p) => p.status === 'in_progress' || p.status === 'planning').length || 0

        // Load earnings
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('amount, payment_date')
          .eq('team_member_id', user.id)

        if (!paymentsError && payments) {
          const totalEarnings = payments.reduce((sum, p) => sum + Number(p.amount), 0)

          const currentMonth = new Date().getMonth()
          const currentYear = new Date().getFullYear()
          const thisMonthEarnings = payments
            .filter((p) => {
              const paymentDate = new Date(p.payment_date)
              return (
                paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear
              )
            })
            .reduce((sum, p) => sum + Number(p.amount), 0)

          setStats({
            totalTasks: allTasks?.length || 0,
            completedTasks,
            activeTasks,
            urgentTasks,
            totalProjects: projects.length,
            activeProjects: activeProjectsCount,
            totalEarnings,
            thisMonthEarnings,
          })
        } else {
          setStats((prev) => ({
            ...prev,
            totalTasks: allTasks?.length || 0,
            completedTasks,
            activeTasks,
            urgentTasks,
            totalProjects: projects.length,
            activeProjects: activeProjectsCount,
          }))
        }
      } else {
        setStats((prev) => ({
          ...prev,
          totalTasks: allTasks?.length || 0,
          completedTasks,
          activeTasks,
          urgentTasks,
        }))
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'assigned':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'planning':
        return 'bg-purple-100 text-purple-800'
      case 'on_hold':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (authLoading || loading) {
    return (
      <TeamMemberLayout>
        <div className="min-h-screen bg-gray-50 p-8">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-gray-200 rounded w-1/3"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 bg-gray-200 rounded"></div>
                ))}
              </div>
              <div className="h-96 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </TeamMemberLayout>
    )
  }

  return (
    <TeamMemberLayout>
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8 text-gray-900">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back, {user?.email?.split('@')[0] || 'Team Member'}!
            </h1>
            <p className="text-gray-600">Here&apos;s what&apos;s happening with your work</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Active Tasks */}
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.activeTasks}</div>
              <div className="text-sm text-gray-600">Active Tasks</div>
              {stats.urgentTasks > 0 && (
                <div className="mt-2 flex items-center text-xs text-red-600">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {stats.urgentTasks} urgent
                </div>
              )}
            </div>

            {/* Completed Tasks */}
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.completedTasks}</div>
              <div className="text-sm text-gray-600">Completed Tasks</div>
              <div className="mt-2 text-xs text-gray-500">
                {stats.totalTasks > 0
                  ? `${Math.round(
                      (stats.completedTasks / stats.totalTasks) * 100
                    )}% completion rate`
                  : ''}
              </div>
            </div>

            {/* Active Projects */}
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Briefcase className="w-6 h-6 text-purple-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{stats.activeProjects}</div>
              <div className="text-sm text-gray-600">Active Projects</div>
              <div className="mt-2 text-xs text-gray-500">{stats.totalProjects} total projects</div>
            </div>

            {/* This Month Earnings */}
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="p-3 bg-orange-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">
                ₹{stats.thisMonthEarnings.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">This Month</div>
              <div className="mt-2 text-xs text-gray-500">
                Total: ₹{stats.totalEarnings.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Recent Tasks */}
            <div className="bg-white rounded-lg shadow-lg border border-gray-100">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <ListTodo className="w-5 h-5 mr-2 text-orange-600" />
                  Your Active Tasks
                </h2>
              </div>
              <div className="p-6">
                {recentTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No active tasks</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Great job staying on top of things!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentTasks.map((task) => (
                      <div
                        key={task.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 transition-colors cursor-pointer"
                        onClick={() => router.push('/tasks')}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-gray-900 flex-1">{task.title}</h3>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getTaskStatusColor(
                              task.status
                            )}`}
                          >
                            {task.status.replace('_', ' ')}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        {task.deadline && (
                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar className="w-3 h-3 mr-1" />
                            Due: {new Date(task.deadline).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Active Projects */}
            <div className="bg-white rounded-lg shadow-lg border border-gray-100">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center">
                  <Briefcase className="w-5 h-5 mr-2 text-orange-600" />
                  Your Projects
                </h2>
              </div>
              <div className="p-6">
                {activeProjects.length === 0 ? (
                  <div className="text-center py-12">
                    <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-600">No active projects</p>
                    <p className="text-sm text-gray-500 mt-1">
                      You&apos;ll be assigned to projects soon
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeProjects.map((project) => (
                      <div
                        key={project.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 transition-colors cursor-pointer"
                        onClick={() => router.push('/projects')}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{project.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{project.client_name}</p>
                          </div>
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getProjectStatusColor(
                              project.status
                            )}`}
                          >
                            {project.status.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TeamMemberLayout>
  )
}
