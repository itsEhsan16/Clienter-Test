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

export default function ClientsPage() {
  const { user, loading: authLoading, supabase } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [filteredClients, setFilteredClients] = useState<Client[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || authLoading) return

    const fetchClients = async () => {
      setIsLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        setError('Clients fetch error: ' + error.message)
        console.error('[Clients] Clients fetch error:', error)
      }
      if (data) {
        setClients(data)
        setFilteredClients(data)
      }
      setIsLoading(false)
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

  return (
    <div className="min-h-screen">
      <TopBar
        title="Clients"
        description="Manage your client relationships and projects"
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
            <p className="text-gray-700">Check your Supabase configuration, RLS policies, and database setup. See console for details.</p>
          </div>
        )}
        {/* Filters and Search */}
        <div className="card p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search clients by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10 w-full"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filteredClients.length}</span> of{' '}
              <span className="font-semibold">{clients.length}</span> clients
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="text-sm font-semibold text-orange-500 hover:text-orange-600"
              >
                Clear filters
              </button>
            )}
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

        {/* Clients Grid */}
        {filteredClients.length === 0 ? (
          <div className="card p-12 text-center">
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredClients.map((client) => (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="card p-6 hover:shadow-lg hover:border-orange-200 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-orange-600 transition-colors">
                      {client.name}
                    </h3>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getClientStatusColor(
                      client.status
                    )}`}
                  >
                    {getClientStatusLabel(client.status)}
                  </span>
                </div>

                {client.budget && (
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    {formatCurrency(client.budget)}
                  </p>
                )}

                {client.project_description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {client.project_description}
                  </p>
                )}

                {client.phone && (
                  <p className="text-sm text-gray-600 mt-4 flex items-center">
                    <Phone className="w-4 h-4 mr-2" />
                    {client.phone}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
