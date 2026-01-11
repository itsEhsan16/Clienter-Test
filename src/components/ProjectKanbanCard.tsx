import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Project } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { Calendar, Users, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

interface ProjectKanbanCardProps {
  project: Project & {
    clients: {
      id: string
      name: string
      phone: string | null
    }
    team_member_count?: number
  }
  isDragging?: boolean
  currency?: string
}

export function ProjectKanbanCard({
  project,
  isDragging,
  currency = 'INR',
}: ProjectKanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({ id: project.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const dragging = isDragging || sortableIsDragging

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
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  const calculateProgress = (totalPaid: number, budget: number | null) => {
    if (!budget || budget === 0) return 0
    return Math.min((totalPaid / budget) * 100, 100)
  }

  const progress = calculateProgress(project.total_paid, project.budget)
  const pendingAmount = (project.budget || 0) - project.total_paid

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`card p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        dragging ? 'opacity-50 rotate-2' : ''
      }`}
    >
      <Link href={`/projects/${project.id}`} className="block">
        {/* Header with Project Name and Status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-gray-900 truncate mb-1">{project.name}</h4>
            <p className="text-xs text-gray-600">Client: {project.clients.name}</p>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${getStatusColor(
              project.status
            )}`}
          >
            {getStatusLabel(project.status)}
          </span>
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-xs text-gray-600 mb-3 line-clamp-2">{project.description}</p>
        )}

        {/* Budget Information */}
        <div className="mb-3">
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-gray-600">Budget Progress</span>
            <span className="font-semibold text-gray-900">
              {formatCurrency(project.total_paid, currency)} /{' '}
              {formatCurrency(project.budget || 0, currency)}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                progress >= 100 ? 'bg-green-500' : progress >= 75 ? 'bg-blue-500' : 'bg-orange-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Pending Amount */}
          {pendingAmount > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-orange-600" />
              <span className="text-xs text-orange-600">
                Pending: {formatCurrency(pendingAmount, currency)}
              </span>
            </div>
          )}
        </div>

        {/* Footer with Deadline and Team Count */}
        <div className="flex items-center justify-between text-xs text-gray-600 pt-2 border-t border-gray-100">
          {project.deadline ? (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(project.deadline), 'MMM d, yyyy')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-gray-400">
              <Calendar className="w-3 h-3" />
              <span>No deadline</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>
              {project.team_member_count || 0}{' '}
              {project.team_member_count === 1 ? 'member' : 'members'}
            </span>
          </div>
        </div>
      </Link>
    </div>
  )
}
