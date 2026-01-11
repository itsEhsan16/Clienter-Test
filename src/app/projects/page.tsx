'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { Plus, FolderKanban, DollarSign, TrendingUp, Search, Download } from 'lucide-react'
import { formatCurrency, exportToCSV, exportToJSON } from '@/lib/utils'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { KanbanColumn } from '@/components/KanbanColumn'
import { ProjectKanbanCard } from '@/components/ProjectKanbanCard'
import type { Project as DBProject, ProjectStatus } from '@/types/database'

interface Project {
  id: string
  name: string
  description: string | null
  client_id: string
  status: ProjectStatus
  budget: number | null
  total_paid: number
  start_date: string | null
  deadline: string | null
  order: number
  created_at: string
  // Additional fields from the database schema expected by components
  organization_id?: string | null
  completed_at: string | null
  created_by?: string | null
  updated_at?: string | null
  clients: {
    id: string
    name: string
    phone: string | null
  }
  team_member_count?: number
}

const STATUSES: ProjectStatus[] = ['new', 'ongoing', 'completed']

export default function ProjectsPage() {
  const { user, profile, supabase } = useAuth()
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useEffect(() => {
    if (user && supabase) {
      fetchProjects()
    }
  }, [user, supabase])

  const fetchProjects = async () => {
    try {
      setLoading(true)

      // Use API route for fetching projects
      const response = await fetch('/api/projects')
      if (!response.ok) throw new Error('Failed to fetch projects')

      const { projects: data } = await response.json()
      setProjects(data || [])
    } catch (error: any) {
      console.error('Error fetching projects:', error)
      toast.error('Failed to fetch projects')
    } finally {
      setLoading(false)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeProject = projects.find((p) => p.id === activeId)
    const overProject = projects.find((p) => p.id === overId)

    if (!activeProject) return

    const activeStatus = activeProject.status
    const overStatus = STATUSES.includes(overId as ProjectStatus)
      ? (overId as ProjectStatus)
      : overProject?.status

    if (!overStatus || activeStatus === overStatus) return

    // Update project status in state
    setProjects((prev) => {
      const updated = prev.map((p) => (p.id === activeId ? { ...p, status: overStatus } : p))
      return updated
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeProject = projects.find((p) => p.id === activeId)
    const overProject = projects.find((p) => p.id === overId)

    if (!activeProject) return

    // Determine new status
    let newStatus = activeProject.status
    if (STATUSES.includes(overId as ProjectStatus)) {
      newStatus = overId as ProjectStatus
    } else if (overProject) {
      newStatus = overProject.status
    }

    // Get projects in the new status
    const statusProjects = projects.filter((p) => p.status === newStatus)
    const oldIndex = statusProjects.findIndex((p) => p.id === activeId)
    const newIndex = statusProjects.findIndex((p) => p.id === overId)

    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
      // Reorder within same status
      const reordered = arrayMove(statusProjects, oldIndex, newIndex)
      const updatedProjects = projects.map((p) => {
        if (p.status === newStatus) {
          const index = reordered.findIndex((rp) => rp.id === p.id)
          return { ...p, order: index }
        }
        return p
      })
      setProjects(updatedProjects)

      // Update order in database
      try {
        for (const project of reordered) {
          const index = reordered.findIndex((p) => p.id === project.id)
          await fetch(`/api/projects/${project.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: index }),
          })
        }
      } catch (error) {
        console.error('Error updating order:', error)
        toast.error('Failed to update order')
        fetchProjects() // Refresh
      }
    }

    // Update status if changed
    if (newStatus !== activeProject.status) {
      try {
        const response = await fetch(`/api/projects/${activeId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })

        if (!response.ok) throw new Error('Failed to update status')

        toast.success(`Project moved to ${newStatus}`)
      } catch (error) {
        console.error('Error updating status:', error)
        toast.error('Failed to update project status')
        fetchProjects() // Refresh to correct state
      }
    }
  }

  const filteredProjects = projects.filter((project) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      project.name.toLowerCase().includes(searchLower) ||
      project.clients.name.toLowerCase().includes(searchLower) ||
      (project.description && project.description.toLowerCase().includes(searchLower))
    )
  })

  const projectsByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = filteredProjects
      .filter((p) => p.status === status)
      .sort((a, b) => a.order - b.order)
    return acc
  }, {} as Record<ProjectStatus, Project[]>)

  // Calculate stats
  const stats = {
    total: projects.length,
    ongoing: projects.filter((p) => p.status === 'ongoing').length,
    completed: projects.filter((p) => p.status === 'completed').length,
    totalBudget: projects.reduce((sum, p) => sum + (p.budget || 0), 0),
    totalPaid: projects.reduce((sum, p) => sum + p.total_paid, 0),
  }

  const handleExportCSV = () => {
    const data = projects.map((p) => ({
      Name: p.name,
      Client: p.clients.name,
      Status: p.status,
      Budget: p.budget || 0,
      'Total Paid': p.total_paid,
      Pending: (p.budget || 0) - p.total_paid,
      'Team Members': p.team_member_count || 0,
      Deadline: p.deadline || 'N/A',
      Created: new Date(p.created_at).toLocaleDateString(),
    }))
    exportToCSV(data, 'projects')
    toast.success('Projects exported to CSV')
  }

  const handleExportJSON = () => {
    exportToJSON(projects, 'projects')
    toast.success('Projects exported to JSON')
  }

  const activeProject = activeId ? projects.find((p) => p.id === activeId) : null

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">Manage your client projects and budgets</p>
        </div>
        <button
          onClick={() => router.push('/projects/new')}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          New Project
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100">
              <FolderKanban className="text-blue-600" size={20} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Ongoing</p>
              <p className="text-2xl font-bold text-gray-900">{stats.ongoing}</p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100">
              <TrendingUp className="text-blue-600" size={20} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.totalBudget, profile?.currency || 'INR')}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100">
              <DollarSign className="text-purple-600" size={20} />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Paid</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.totalPaid, profile?.currency || 'INR')}
              </p>
            </div>
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-green-100">
              <DollarSign className="text-green-600" size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Export */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 relative w-full">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={20}
            />
            <input
              type="text"
              placeholder="Search projects, clients, or descriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2">
              <Download size={16} />
              Export CSV
            </button>
            <button onClick={handleExportJSON} className="btn-secondary flex items-center gap-2">
              <Download size={16} />
              Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              id={status}
              title={status.charAt(0).toUpperCase() + status.slice(1)}
            >
              <SortableContext
                items={projectsByStatus[status].map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {projectsByStatus[status].map((project) => (
                    <ProjectKanbanCard
                      key={project.id}
                      project={project as any}
                      currency={profile?.currency || 'INR'}
                    />
                  ))}
                  {projectsByStatus[status].length === 0 && (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No {status} projects
                    </div>
                  )}
                </div>
              </SortableContext>
            </KanbanColumn>
          ))}
        </div>

        <DragOverlay>
          {activeProject && (
            <ProjectKanbanCard
              project={activeProject as any}
              isDragging
              currency={profile?.currency || 'INR'}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
