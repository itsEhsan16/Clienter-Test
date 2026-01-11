'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { FolderKanban, TrendingUp, CheckCircle, Clock, Calendar } from 'lucide-react'
import Rupee from '@/components/Rupee'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import toast from 'react-hot-toast'

interface AssignedProject {
  id: string
  project_id: string
  team_member_id: string
  allocated_budget: number | null
  total_paid: number
  role: string | null
  status: string
  projects: {
    id: string
    name: string
    description: string | null
    status: string
    budget: number
    total_paid: number
    created_at: string
    clients: {
      name: string
    }
  }
}

export default function TeammateDashboardPage() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<AssignedProject[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchAssignedProjects()
    }
  }, [user])

  const fetchAssignedProjects = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/teammate/projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      const { projects: data } = await res.json()
      setProjects(data || [])
    } catch (error: any) {
      console.error('Error fetching projects:', error)
      toast.error('Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-purple-100 text-purple-800'
      case 'ongoing':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new':
        return 'New'
      case 'ongoing':
        return 'Ongoing'
      case 'completed':
        return 'Completed'
      default:
        return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  const activeProjects = projects.filter((p) => ['new', 'ongoing'].includes(p.projects.status))
  const completedProjects = projects.filter((p) => p.projects.status === 'completed')

  const totalEarnings = projects.reduce((sum, p) => sum + (p.allocated_budget || 0), 0)
  const totalReceived = projects.reduce((sum, p) => sum + p.total_paid, 0)
  const totalPending = totalEarnings - totalReceived

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Dashboard</h1>
        <p className="text-gray-600">Overview of your assigned projects and earnings</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FolderKanban className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Earnings</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalEarnings)}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Rupee className="text-purple-600" size={20} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Received</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalReceived)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalPending)}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="text-orange-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Active Projects */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FolderKanban size={24} />
          Active Projects ({activeProjects.length})
        </h2>

        {activeProjects.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-600">No active projects assigned</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeProjects.map((assignment) => (
              <div
                key={assignment.id}
                className="card cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => router.push(`/projects/${assignment.projects.id}`)}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {assignment.projects.name}
                  </h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      assignment.projects.status
                    )}`}
                  >
                    {getStatusLabel(assignment.projects.status)}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  Client: {assignment.projects.clients.name}
                </p>

                {assignment.role && (
                  <p className="text-xs text-purple-600 mb-3">Role: {assignment.role}</p>
                )}

                {assignment.projects.description && (
                  <p className="text-sm text-gray-500 mb-4 line-clamp-2">
                    {assignment.projects.description}
                  </p>
                )}

                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Your Budget:</span>
                    <span className="font-semibold text-gray-900">
                      {assignment.allocated_budget !== null
                        ? formatCurrency(assignment.allocated_budget)
                        : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Received:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(assignment.total_paid)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Pending:</span>
                    <span className="font-semibold text-orange-600">
                      {formatCurrency((assignment.allocated_budget || 0) - assignment.total_paid)}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                {assignment.allocated_budget && assignment.allocated_budget > 0 && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            (assignment.total_paid / assignment.allocated_budget) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center text-xs text-gray-500">
                  <Calendar size={14} className="mr-1" />
                  Started {format(new Date(assignment.projects.created_at), 'MMM dd, yyyy')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Projects */}
      {completedProjects.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CheckCircle size={24} />
            Completed Projects ({completedProjects.length})
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedProjects.map((assignment) => (
              <div
                key={assignment.id}
                className="card cursor-pointer hover:shadow-lg transition-shadow opacity-75"
                onClick={() => router.push(`/projects/${assignment.projects.id}`)}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {assignment.projects.name}
                  </h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      assignment.projects.status
                    )}`}
                  >
                    {getStatusLabel(assignment.projects.status)}
                  </span>
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  Client: {assignment.projects.clients.name}
                </p>

                {assignment.role && (
                  <p className="text-xs text-purple-600 mb-3">Role: {assignment.role}</p>
                )}

                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Your Earnings:</span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(assignment.total_paid)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
