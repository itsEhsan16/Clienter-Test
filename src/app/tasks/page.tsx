'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Filter,
  CheckSquare,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  User as UserIcon,
} from 'lucide-react'
import { Task, TaskWithDetails } from '@/types/database'
import { getRoleBadgeColor, getRoleLabel, getTeamMembers } from '@/lib/rbac-helpers'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function TasksPage() {
  const { user, organization, loading: authLoading } = useAuth()
  const router = useRouter()

  const [tasks, setTasks] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterMember, setFilterMember] = useState<string>('all')

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [deadline, setDeadline] = useState('')

  const isOwnerOrAdmin = organization?.role === 'owner' || organization?.role === 'admin'
  const isTeamMember = organization && !isOwnerOrAdmin

  useEffect(() => {
    if (!authLoading && user) {
      loadData()
    }
  }, [user, authLoading])

  const loadData = async () => {
    if (!user) return

    setLoading(true)
    try {
      // Load team members (for owner/admin)
      if (isOwnerOrAdmin && organization) {
        const members = await getTeamMembers(user.id)
        setTeamMembers(members)
      }

      // Load tasks
      await loadTasks()
    } catch (error) {
      console.error('Error loading data:', error)
      // Don't show error if it's just because migrations aren't run
    } finally {
      setLoading(false)
    }
  }

  const loadTasks = async () => {
    if (!organization) return

    try {
      let query = supabase
        .from('tasks')
        .select(
          `
          *,
          assigned_to_profile:assigned_to (
            id,
            email,
            full_name
          ),
          assigned_by_profile:assigned_by (
            id,
            email,
            full_name
          )
        `
        )
        .eq('organization_id', organization.organizationId)
        .order('created_at', { ascending: false })

      // If team member, only show their tasks
      if (isTeamMember) {
        query = query.eq('assigned_to', user!.id)
      }

      const { data, error } = await query

      if (error) throw error

      setTasks(data || [])
    } catch (error: any) {
      console.error('Error loading tasks:', error)
      toast.error('Failed to load tasks')
    }
  }

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || !organization || !title || !assignedTo) {
      toast.error('Title and assignee are required')
      return
    }

    setSubmitting(true)

    try {
      const { error } = await supabase.from('tasks').insert({
        organization_id: organization.organizationId,
        assigned_to: assignedTo,
        assigned_by: user.id,
        title,
        description: description || null,
        deadline: deadline || null,
        status: 'assigned',
      })

      if (error) throw error

      toast.success('Task created successfully! 🎉')
      setShowAddModal(false)
      resetForm()
      loadTasks()
    } catch (error: any) {
      console.error('Error creating task:', error)
      toast.error(error.message || 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const updates: any = { status: newStatus }
      if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString()
      }

      const { error } = await supabase.from('tasks').update(updates).eq('id', taskId)

      if (error) throw error

      toast.success('Task updated')
      loadTasks()
    } catch (error: any) {
      console.error('Error updating task:', error)
      toast.error('Failed to update task')
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)

      if (error) throw error

      toast.success('Task deleted')
      loadTasks()
    } catch (error: any) {
      console.error('Error deleting task:', error)
      toast.error('Failed to delete task')
    }
  }

  const resetForm = () => {
    setTitle('')
    setDescription('')
    setAssignedTo('')
    setDeadline('')
  }

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    if (filterStatus !== 'all' && task.status !== filterStatus) return false
    if (filterMember !== 'all' && task.assigned_to !== filterMember) return false
    return true
  })

  // Group tasks by status
  const tasksByStatus = {
    assigned: filteredTasks.filter((t) => t.status === 'assigned'),
    in_progress: filteredTasks.filter((t) => t.status === 'in_progress'),
    completed: filteredTasks.filter((t) => t.status === 'completed'),
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'bg-blue-100 text-blue-800'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'assigned':
        return <Clock className="w-4 h-4" />
      case 'in_progress':
        return <CheckSquare className="w-4 h-4" />
      case 'completed':
        return <CheckCircle2 className="w-4 h-4" />
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-96 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 text-gray-900">
      <div className="max-w-7xl mx-auto">
        {/* Setup Notice - Show if organization not loaded */}
        {!organization && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Database Setup Required</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    Tasks require database migrations. Run migrations to enable task management.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {isTeamMember ? 'My Tasks' : 'Task Management'}
            </h1>
            <p className="text-gray-600">
              {isTeamMember
                ? 'View and manage your assigned tasks'
                : 'Create and assign tasks to your team'}
            </p>
          </div>
          {(isOwnerOrAdmin || !organization) && (
            <button
              onClick={() => setShowAddModal(true)}
              disabled={!organization}
              className="mt-4 sm:mt-0 flex items-center space-x-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              <span>Create Task</span>
            </button>
          )}
        </div>

        {/* Filters */}
        {isOwnerOrAdmin && (
          <div className="flex flex-wrap gap-4 mb-6">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Statuses</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>

            <select
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">All Team Members</option>
              {teamMembers.map((member: any) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.display_name || member.profile?.full_name || member.profile?.email}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Assigned Column */}
          <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-500" />
                <span>Assigned ({tasksByStatus.assigned.length})</span>
              </h2>
            </div>
            <div className="space-y-3">
              {tasksByStatus.assigned.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onUpdateStatus={handleUpdateTaskStatus}
                  onDelete={handleDeleteTask}
                  canManage={isOwnerOrAdmin}
                  canUpdateStatus={true}
                  currentUserId={user?.id}
                />
              ))}
              {tasksByStatus.assigned.length === 0 && (
                <p className="text-center text-gray-500 py-8">No assigned tasks</p>
              )}
            </div>
          </div>

          {/* In Progress Column */}
          <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <CheckSquare className="w-5 h-5 text-yellow-500" />
                <span>In Progress ({tasksByStatus.in_progress.length})</span>
              </h2>
            </div>
            <div className="space-y-3">
              {tasksByStatus.in_progress.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onUpdateStatus={handleUpdateTaskStatus}
                  onDelete={handleDeleteTask}
                  canManage={isOwnerOrAdmin}
                  canUpdateStatus={true}
                  currentUserId={user?.id}
                />
              ))}
              {tasksByStatus.in_progress.length === 0 && (
                <p className="text-center text-gray-500 py-8">No tasks in progress</p>
              )}
            </div>
          </div>

          {/* Completed Column */}
          <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <span>Completed ({tasksByStatus.completed.length})</span>
              </h2>
            </div>
            <div className="space-y-3">
              {tasksByStatus.completed.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onUpdateStatus={handleUpdateTaskStatus}
                  onDelete={handleDeleteTask}
                  canManage={isOwnerOrAdmin}
                  canUpdateStatus={false}
                  currentUserId={user?.id}
                />
              ))}
              {tasksByStatus.completed.length === 0 && (
                <p className="text-center text-gray-500 py-8">No completed tasks</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      {showAddModal && isOwnerOrAdmin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create Task</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Enter task title"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Task description and requirements..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center space-x-2">
                      <UserIcon className="w-4 h-4" />
                      <span>Assign To *</span>
                    </div>
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select team member</option>
                    {teamMembers.map((member: any) => (
                      <option key={member.user_id} value={member.user_id}>
                        {member.display_name || member.profile?.full_name || member.profile?.email}{' '}
                        - {getRoleLabel(member.role)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>Deadline (Optional)</span>
                    </div>
                  </label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      resetForm()
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={submitting}
                  >
                    {submitting ? 'Creating...' : 'Create Task'}
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

// Task Card Component
function TaskCard({
  task,
  onUpdateStatus,
  onDelete,
  canManage,
  canUpdateStatus,
  currentUserId,
}: {
  task: any
  onUpdateStatus: (taskId: string, status: string) => void
  onDelete: (taskId: string) => void
  canManage: boolean
  canUpdateStatus: boolean
  currentUserId?: string
}) {
  const assignedToProfile = task.assigned_to_profile
  const assignedToName =
    assignedToProfile?.full_name || assignedToProfile?.email?.split('@')[0] || 'Unknown'
  const isOwnTask = task.assigned_to === currentUserId

  const getNextStatus = (currentStatus: string) => {
    if (currentStatus === 'assigned') return 'in_progress'
    if (currentStatus === 'in_progress') return 'completed'
    return null
  }

  const nextStatus = getNextStatus(task.status)

  return (
    <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-orange-500">
      <h3 className="font-semibold text-gray-900 mb-2">{task.title}</h3>

      {task.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center space-x-2 text-xs text-gray-500 mb-3">
        <UserIcon className="w-3 h-3" />
        <span>{assignedToName}</span>
      </div>

      {task.deadline && (
        <div className="flex items-center space-x-2 text-xs text-gray-500 mb-3">
          <Calendar className="w-3 h-3" />
          <span>Due: {format(new Date(task.deadline), 'MMM d, yyyy')}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        {canUpdateStatus && nextStatus && (isOwnTask || canManage) && (
          <button
            onClick={() => onUpdateStatus(task.id, nextStatus)}
            className="text-xs px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
          >
            {nextStatus === 'in_progress' && 'Start'}
            {nextStatus === 'completed' && 'Complete'}
          </button>
        )}

        {canManage && (
          <button
            onClick={() => onDelete(task.id)}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
