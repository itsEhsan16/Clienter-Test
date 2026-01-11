'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { FolderKanban, TrendingUp, CheckCircle } from 'lucide-react'
import Rupee from '@/components/Rupee'
import { formatCurrency } from '@/lib/utils'
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

export default function TeammateProjectsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<AssignedProject[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  useEffect(() => {
    if (user) {
      fetchProjects()
    }
  }, [user])

  const fetchProjects = async () => {
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

  const filteredProjects = projects.filter((p) => {
    if (filter === 'active') return ['new', 'ongoing'].includes(p.projects.status)
    if (filter === 'completed') return p.projects.status === 'completed'
    return true
  })

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Projects</h1>
        <p className="text-gray-600">Projects assigned to you</p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Projects ({projects.length})
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'active'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Active ({projects.filter((p) => ['new', 'ongoing'].includes(p.projects.status)).length})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'completed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Completed ({projects.filter((p) => p.projects.status === 'completed').length})
        </button>
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-600">No projects found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((assignment) => (
            <div
              key={assignment.id}
              className="card cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(`/projects/${assignment.projects.id}`)}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold text-gray-900 text-lg">{assignment.projects.name}</h3>
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
