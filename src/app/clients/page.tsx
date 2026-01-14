'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, Download, Users as UsersIcon, X, Phone, FolderKanban } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/TopBar'
import { ClientsListSkeleton } from '@/components/SkeletonLoaders'
import { exportToCSV, exportToJSON } from '@/lib/utils'
import { formatTimeAgo } from '@/lib/date-utils'
import type { ProjectStatus } from '@/types/database'

type ProjectStatusCounts = Record<ProjectStatus, number>

type ClientListItem = {
  id: string
  name: string
  phone: string | null
  created_at: string
  projectsCount: number
  statusCounts: ProjectStatusCounts
  latestProject?: {
    id: string
    name: string
    status: ProjectStatus
    created_at: string
  }
}

type ClientProjectStats = {
  total: number
  statusCounts: ProjectStatusCounts
  latest?: {
    id: string
    name: string
    status: ProjectStatus
    created_at: string
  }
}

const createEmptyStatusCounts = (): ProjectStatusCounts => ({
  new: 0,
  ongoing: 0,
  completed: 0,
})

const statusBadgeClass = (status: ProjectStatus) => {
  switch (status) {
    case 'ongoing':
      return 'bg-green-100 text-green-800'
    case 'completed':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-purple-100 text-purple-800'
  }
}

export default function ClientsPage() {
  const { user, organization, loading: authLoading, supabase } = useAuth()

  const [clients, setClients] = useState<ClientListItem[]>([])
  const [filteredClients, setFilteredClients] = useState<ClientListItem[]>([])
  const [projectSummary, setProjectSummary] = useState<{
    totalProjects: number
    statusCounts: ProjectStatusCounts
  }>({
    totalProjects: 0,
    statusCounts: createEmptyStatusCounts(),
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || authLoading || !supabase) return

    const fetchClients = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session || !session.access_token) {
          setError('No active session. Please log in again.')
          setIsLoading(false)
          return
        }

        let orgId = organization?.organizationId || null

        if (!orgId) {
          const { data: membershipData, error: membershipError } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .limit(1)

          if (membershipError) {
            throw membershipError
          }

          if (membershipData && membershipData.length > 0) {
            orgId = membershipData[0].organization_id
          }
        }

        if (!orgId) {
          setError('No active organization found. Join or create one to see clients.')
          setIsLoading(false)
          return
        }

        const [clientsRes, projectsRes] = await Promise.all([
          supabase
            .from('clients')
            .select('id, name, phone, created_at')
            .eq('organization_id', orgId)
            .order('created_at', { ascending: false }),
          supabase
            .from('projects')
            .select('id, client_id, status, name, created_at')
            .eq('organization_id', orgId),
        ])

        if (clientsRes.error) {
          throw clientsRes.error
        }

        const projectRows = projectsRes.error ? [] : projectsRes.data || []

        const projectTotals: ProjectStatusCounts = createEmptyStatusCounts()
        const projectMap = new Map<string, ClientProjectStats>()

        projectRows.forEach((project: any) => {
          const status = (project.status as ProjectStatus) || 'new'
          projectTotals[status] = (projectTotals[status] || 0) + 1

          if (!project.client_id) return

          const existing = projectMap.get(project.client_id) || {
            total: 0,
            statusCounts: createEmptyStatusCounts(),
          }

          existing.total += 1
          existing.statusCounts[status] = (existing.statusCounts[status] || 0) + 1

          if (
            !existing.latest ||
            new Date(project.created_at) > new Date(existing.latest.created_at)
          ) {
            existing.latest = {
              id: project.id,
              name: project.name,
              status,
              created_at: project.created_at,
            }
          }

          projectMap.set(project.client_id, existing)
        })

        const mappedClients: ClientListItem[] = (clientsRes.data || []).map((client: any) => {
          const stats = projectMap.get(client.id) || {
            total: 0,
            statusCounts: createEmptyStatusCounts(),
          }

          return {
            id: client.id,
            name: client.name,
            phone: client.phone || null,
            created_at: client.created_at,
            projectsCount: stats.total,
            statusCounts: { ...stats.statusCounts },
            latestProject: stats.latest,
          }
        })

        setProjectSummary({
          totalProjects: projectRows.length,
          statusCounts: { ...projectTotals },
        })

        setClients(mappedClients)
        setFilteredClients(mappedClients)
      } catch (err: any) {
        console.error('[Clients] Error fetching clients list:', err)
        setError('Failed to load clients: ' + (err?.message || 'Unknown error'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchClients()
  }, [user, authLoading, supabase, organization])

  useEffect(() => {
    const value = searchTerm.toLowerCase().trim()
    if (!value) {
      setFilteredClients(clients)
      return
    }

    const filtered = clients.filter((client) => {
      return (
        client.name.toLowerCase().includes(value) ||
        (client.phone ? client.phone.toLowerCase().includes(value) : false)
      )
    })

    setFilteredClients(filtered)
  }, [searchTerm, clients])

  const handleExportCSV = () => {
    const rows = filteredClients.map((client) => ({
      name: client.name,
      phone: client.phone || '',
      projects: client.projectsCount,
      latest_project: client.latestProject?.name || '',
      latest_project_status: client.latestProject?.status || '',
      added_at: client.created_at,
    }))

    exportToCSV(rows, `clients-${new Date().toISOString().split('T')[0]}`)
  }

  const handleExportJSON = () => {
    const rows = filteredClients.map((client) => ({
      name: client.name,
      phone: client.phone || '',
      projects: client.projectsCount,
      latest_project: client.latestProject?.name || '',
      latest_project_status: client.latestProject?.status || '',
      added_at: client.created_at,
    }))

    exportToJSON(rows, `clients-${new Date().toISOString().split('T')[0]}`)
  }

  if (authLoading || isLoading) {
    return <ClientsListSkeleton />
  }

  if (!user) return null

  return (
    <div className="min-h-screen">
      <TopBar
        title="Clients"
        description="View all clients and jump into their projects"
        actions={
          <Link href="/clients/new" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Link>
        }
      />

      <div className="p-6 lg:p-8 space-y-6">
        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-500 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-red-800">Unable to load clients</h2>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-sm text-gray-500">Total clients</p>
            <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Total projects</p>
            <p className="text-2xl font-bold text-gray-900">{projectSummary.totalProjects}</p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Ongoing projects</p>
            <p className="text-2xl font-bold text-green-700">
              {projectSummary.statusCounts.ongoing}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-sm text-gray-500">Completed projects</p>
            <p className="text-2xl font-bold text-blue-700">
              {projectSummary.statusCounts.completed}
            </p>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {filteredClients.length > 0 && (
              <div className="flex gap-3">
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
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          {filteredClients.length === 0 ? (
            <div className="p-12 text-center">
              <UsersIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {clients.length === 0 ? 'No clients yet' : 'No clients match your search'}
              </h3>
              <p className="text-gray-600 mb-6">
                {clients.length === 0
                  ? 'Add your first client to get started'
                  : 'Try a different name or phone number'}
              </p>
              {clients.length === 0 && (
                <Link href="/clients/new" className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Client
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-gray-900 truncate">{client.name}</p>
                    <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {client.phone || 'No phone added'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Added {formatTimeAgo(client.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
                    <div>
                      <p className="text-xs text-gray-500">Projects</p>
                      <p className="font-semibold">{client.projectsCount}</p>
                    </div>

                    {client.latestProject && (
                      <div className="flex items-center gap-2 min-w-[180px]">
                        <div>
                          <p className="text-xs text-gray-500">Latest project</p>
                          <p className="font-semibold truncate max-w-[200px]">
                            {client.latestProject.name}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${statusBadgeClass(
                            client.latestProject.status
                          )}`}
                        >
                          {client.latestProject.status}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link href={`/projects/new?client=${client.id}`} className="btn-primary">
                      <FolderKanban className="w-4 h-4 mr-2" />
                      New Project
                    </Link>
                    <Link href={`/clients/${client.id}`} className="btn-secondary">
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
