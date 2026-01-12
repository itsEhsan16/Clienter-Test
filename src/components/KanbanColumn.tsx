import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { KanbanCard } from './KanbanCard'

// Generic type for Kanban items (can be clients or projects)
type KanbanItem = {
  id: string
  name: string
  status: string
  order?: number
  phone?: string | null
  [key: string]: any
}

interface KanbanColumnProps {
  id: string
  title: string
  clients?: KanbanItem[]
  count?: number
  currency?: string
  children?: React.ReactNode
}

export function KanbanColumn({
  id,
  title,
  clients,
  count,
  currency = 'USD',
  children,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  })
  const finalClients = clients || []
  const finalCount = count ?? finalClients.length

  const isNew = id === 'new'
  const isOngoing = id === 'ongoing'
  const isCompleted = id === 'completed'

  const getColumnColor = () => {
    if (isNew) return 'ring-1 ring-purple-200 bg-purple-50/30'
    if (isOngoing) return 'ring-1 ring-green-200 bg-green-50/30'
    if (isCompleted) return 'ring-1 ring-blue-200 bg-blue-50/30'
    return ''
  }

  const getTitleColor = () => {
    if (isNew) return 'text-purple-700'
    if (isOngoing) return 'text-green-700'
    if (isCompleted) return 'text-blue-700'
    return 'text-gray-900'
  }

  const getBadgeColor = () => {
    if (isNew) return 'bg-purple-100 text-purple-700'
    if (isOngoing) return 'bg-green-100 text-green-700'
    if (isCompleted) return 'bg-blue-100 text-blue-700'
    return 'bg-gray-100 text-gray-600'
  }

  return (
    <div
      ref={setNodeRef}
      className={`card p-4 min-h-[600px] ${
        isOver ? 'ring-2 ring-orange-500 bg-orange-50' : getColumnColor()
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-bold ${getTitleColor()}`}>{title}</h3>
        <span className={`px-2 py-1 text-sm rounded-full ${getBadgeColor()}`}>{finalCount}</span>
      </div>

      {children ? (
        // If children provided, render them (used for Projects board)
        <div>{children}</div>
      ) : (
        <SortableContext
          items={finalClients.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {finalClients.map((client) => (
              <KanbanCard key={client.id} client={client} currency={currency} />
            ))}
          </div>
        </SortableContext>
      )}

      {finalClients.length === 0 && (
        <div className="text-center py-8 text-gray-400">No clients in {title.toLowerCase()}</div>
      )}
    </div>
  )
}
