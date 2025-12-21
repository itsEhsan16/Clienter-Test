'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/TopBar'
import { ClientsListSkeleton } from '@/components/SkeletonLoaders'
import { Client } from '@/types/database'
import {
  exportToCSV,
  exportToJSON,
  getClientStatusColor,
  getClientStatusLabel,
  formatCurrency,
} from '@/lib/utils'
import { Plus, Search, Download, Users as UsersIcon, X, Phone } from 'lucide-react'
import Link from 'next/link'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { KanbanColumn } from '@/components/KanbanColumn'
import { KanbanCard } from '@/components/KanbanCard'

const STATUSES = ['new', 'ongoing', 'completed'] as const

export default function ClientsPage() {
  const { user, profile, loading: authLoading, supabase } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  useEffect(() => {
    if (!user || authLoading || !supabase) return

    const fetchClients = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Verify session first
        const {
          data: { session },
        } = await supabase.auth.getSession()
        console.log('[Clients] Session check:', {
          hasSession: !!session,
          userId: session?.user?.id,
          accessToken: session?.access_token ? 'present' : 'missing',
        })

        if (!session || !session.access_token) {
          setError('No active session. Please log in again.')
          setIsLoading(false)
          return
        }

        // Add timeout protection
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Fetch clients timed out after 10 seconds')), 10000)
        )

        const fetchPromise = supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id)
          .order('status', { ascending: true })
          .order('order', { ascending: true })

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise])

        console.log('[Clients] Query result:', {
          error: error,
          count: data?.length || 0,
        })

        if (error) {
          setError('Failed to load clients: ' + error.message)
          console.error('[Clients] Clients fetch error:', error)
        }
        if (data) {
          setClients(data)
          setFilteredClients(data)
        }
      } catch (err: any) {
        setError('Failed to load clients: ' + (err?.message || 'Unknown error'))
        console.error('[Clients] Error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchClients()
  }, [user, authLoading, supabase])

  useEffect(() => {
    let filtered = clients

    if (searchTerm) {
      filtered = filtered.filter((client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    setFilteredClients(filtered)
  }, [searchTerm, clients])

  const clientsByStatus = useMemo(() => {
    const grouped: Record<string, Client[]> = {
      new: [],
      ongoing: [],
      completed: [],
    }
    filteredClients.forEach((client) => {
      if (grouped[client.status]) {
        grouped[client.status].push(client)
      }
    })
    return grouped
  }, [filteredClients])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeClient = clients.find((c) => c.id === activeId)
    if (!activeClient) return

    // If dropped on a column (status change)
    if (STATUSES.includes(overId as any)) {
      const newStatus = overId as Client['status']
      if (newStatus === activeClient.status) return

      // Update local state
      setClients((prev) => prev.map((c) => (c.id === activeId ? { ...c, status: newStatus } : c)))

      // Update database
      const { error } = await supabase
        .from('clients')
        .update({ status: newStatus })
        .eq('id', activeId)

      if (error) {
        console.error('Error updating client status:', error)
        // Revert on error
        setClients((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, status: activeClient.status } : c))
        )
      }
    } else {
      // Reordering within the same column
      const overClient = clients.find((c) => c.id === overId)
      if (!overClient || activeClient.status !== overClient.status) return

      const statusClients = clients.filter((c) => c.status === activeClient.status)
      const activeIndex = statusClients.findIndex((c) => c.id === activeId)
      const overIndex = statusClients.findIndex((c) => c.id === overId)

      if (activeIndex === -1 || overIndex === -1) return

      // Reorder the clients in this status
      const reorderedClients = arrayMove(statusClients, activeIndex, overIndex)

      // Update orders
      const updatedClients = reorderedClients.map((client, index) => ({
        ...client,
        order: index,
      }))

      // Update local state
      setClients((prev) => {
        const newClients = prev.filter((c) => c.status !== activeClient.status)
        return [...newClients, ...updatedClients]
      })

      // Update database orders
      const updates = updatedClients.map((client) => ({
        id: client.id,
        order: client.order,
      }))

      if (!user) return

      for (const update of updates) {
        const { error } = await supabase
          .from('clients')
          .update({ order: update.order })
          .eq('id', update.id)

        if (error) {
          console.error('Error updating client order:', error)
          // Revert on error - refetch clients
          const { data } = await supabase
            .from('clients')
            .select('*')
            .eq('user_id', user.id)
            .order('status', { ascending: true })
            .order('order', { ascending: true })
          if (data) setClients(data)
          break
        }
      }
    }
  }

  const handleExportCSV = () => {
    exportToCSV(filteredClients, `clients-${new Date().toISOString().split('T')[0]}`)
  }

  const handleExportJSON = () => {
    exportToJSON(filteredClients, `clients-${new Date().toISOString().split('T')[0]}`)
  }

  // Show skeleton while loading
  if (authLoading || isLoading) {
    return <ClientsListSkeleton />
  }

  if (!user) return null

  const activeClient = activeId ? clients.find((c) => c.id === activeId) : null

  return (
    <div className="min-h-screen">
      <TopBar
        title="Clients"
        description="Manage your client relationships"
        actions={
          <Link href="/clients/new" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Link>
        }
      />

      <div className="p-6 lg:p-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-8 bg-red-50 border-l-4 border-red-500 rounded-xl p-6">
            <h2 className="text-lg font-bold text-red-900 mb-2">⚠️ Error Loading Clients</h2>
            <p className="text-red-700 mb-4">{error}</p>
            <p className="text-gray-700">
              Check your Supabase configuration, RLS policies, and database setup. See console for
              details.
            </p>
          </div>
        )}

        {/* Filters and Search */}
        <div className="card p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Export Options */}
        {filteredClients.length > 0 && (
          <div className="mb-6 flex justify-end space-x-3">
            <button onClick={handleExportCSV} className="btn-secondary text-sm">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
            <button onClick={handleExportJSON} className="btn-secondary text-sm">
              <Download className="w-4 h-4 mr-2" />
              Export JSON
            </button>
          </div>
        )}

        {/* Kanban Board */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STATUSES.map((status) => (
              <KanbanColumn
                key={status}
                id={status}
                title={getClientStatusLabel(status)}
                clients={clientsByStatus[status]}
                count={clientsByStatus[status].length}
                currency={profile?.currency || 'INR'}
              />
            ))}
          </div>

          <DragOverlay>
            {activeClient ? (
              <KanbanCard client={activeClient} isDragging currency={profile?.currency || 'INR'} />
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* Completed Clients Section */}
        {clientsByStatus.completed.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Completed Clients</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clientsByStatus.completed.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="card p-4 block hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-gray-900">{client.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${getClientStatusColor(
                        client.status
                      )}`}
                    >
                      {getClientStatusLabel(client.status)}
                    </span>
                  </div>
                  {client.phone && (
                    <p className="text-sm text-gray-600 mb-2">
                      <Phone className="w-4 h-4 inline mr-1" />
                      {client.phone}
                    </p>
                  )}
                  {client.project_description && (
                    <p className="text-sm text-gray-600 mb-2">{client.project_description}</p>
                  )}
                  {client.budget && (
                    <p className="text-sm font-medium text-gray-900">
                      Budget: {formatCurrency(client.budget, profile?.currency || 'INR')}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredClients.length === 0 && (
          <div className="card p-12 text-center col-span-full">
            <UsersIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {clients.length === 0 ? 'No clients yet' : 'No clients found'}
            </h3>
            <p className="text-gray-600 mb-6">
              {clients.length === 0
                ? 'Add your first client to get started'
                : 'Try adjusting your search or filters'}
            </p>
            {clients.length === 0 && (
              <Link href="/clients/new" className="btn-primary">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Client
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
