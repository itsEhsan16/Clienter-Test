import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getClientStatusColor, formatCurrency } from '@/lib/utils'
import { Phone } from 'lucide-react'
import Link from 'next/link'

// Generic type for Kanban items (can be clients or projects)
type KanbanItem = {
  id: string
  name: string
  phone?: string | null
  [key: string]: any
}

interface KanbanCardProps {
  client: KanbanItem
  isDragging?: boolean
  currency?: string
}

export function KanbanCard({ client, isDragging, currency = 'USD' }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({ id: client.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const dragging = isDragging || sortableIsDragging

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
      <Link href={`/clients/${client.id}`} className="block">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-gray-900 truncate">{client.name}</h4>
          </div>
        </div>

        {client.phone && (
          <p className="text-xs text-gray-600 flex items-center">
            <Phone className="w-3 h-3 mr-1" />
            {client.phone}
          </p>
        )}

        {client.phone && (
          <p className="text-xs text-gray-600 flex items-center">
            <Phone className="w-3 h-3 mr-1" />
            {client.phone}
          </p>
        )}
      </Link>
    </div>
  )
}
