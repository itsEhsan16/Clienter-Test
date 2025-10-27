import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Client } from '@/types/database'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnProps {
  id: string
  title: string
  clients: Client[]
  count: number
}

export function KanbanColumn({ id, title, clients, count }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  })

  return (
    <div
      ref={setNodeRef}
      className={`card p-4 min-h-[600px] ${isOver ? 'ring-2 ring-orange-500 bg-orange-50' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">{count}</span>
      </div>

      <SortableContext items={clients.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {clients.map((client) => (
            <KanbanCard key={client.id} client={client} />
          ))}
        </div>
      </SortableContext>

      {clients.length === 0 && (
        <div className="text-center py-8 text-gray-400">No clients in {title.toLowerCase()}</div>
      )}
    </div>
  )
}
