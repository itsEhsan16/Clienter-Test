'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Navigation } from '@/components/Navigation'
import { Client, Project, Meeting } from '@/types/database'
import {
  formatCurrency,
  getStatusColor,
  getStatusLabel,
  getClientStatusColor,
  getClientStatusLabel,
} from '@/lib/utils'
import { formatRelativeTime, formatTimeAgo } from '@/lib/date-utils'
import { ArrowLeft, Edit, Trash2, Plus, Phone, Calendar, DollarSign } from 'lucide-react'
import Link from 'next/link'

export default function ClientDetailPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const params = useParams()
  const clientId = params?.id as string
  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    project_description: '',
    budget: '',
    status: 'important' as 'general' | 'important' | 'working' | 'finished',
  })

  useEffect(() => {
    if (!user || !clientId) return

    const fetchData = async () => {
      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .eq('user_id', user.id)
        .single()

      if (clientError) {
        console.error('Error fetching client:', clientError)
        router.push('/clients')
        return
      }

      if (clientData) {
        setClient(clientData)
        setEditData({
          name: clientData.name,
          phone: clientData.phone || '',
          project_description: clientData.project_description || '',
          budget: clientData.budget ? clientData.budget.toString() : '',
          status: clientData.status,
        })
      } else {
        router.push('/clients')
        return
      }

      // Fetch projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })

      if (projectsData) {
        setProjects(projectsData)
      }

      // Fetch meetings
      const { data: meetingsData } = await supabase
        .from('meetings')
        .select('*')
        .eq('client_id', clientId)
        .order('meeting_time', { ascending: false })

      if (meetingsData) {
        setMeetings(meetingsData)
      }
    }

    fetchData()
  }, [user, clientId, router])

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!client) return

    const { error } = await supabase
      .from('clients')
      .update({
        name: editData.name,
        phone: editData.phone || null,
        project_description: editData.project_description || null,
        budget: editData.budget ? parseFloat(editData.budget) : null,
        status: editData.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)

    if (!error) {
      setClient({
        ...client,
        name: editData.name,
        phone: editData.phone || null,
        project_description: editData.project_description || null,
        budget: editData.budget ? parseFloat(editData.budget) : null,
        status: editData.status,
      })
      setIsEditing(false)
    }
  }

  const handleDelete = async () => {
    if (!client) return
    if (
      !confirm(
        `Are you sure you want to delete ${client.name}? This will also delete all associated projects and meetings.`
      )
    ) {
      return
    }

    const { error } = await supabase.from('clients').delete().eq('id', client.id)

    if (!error) {
      router.push('/clients')
    }
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    )
  }

  const upcomingMeetings = meetings.filter((m) => new Date(m.meeting_time) > new Date())
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/clients"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Clients
          </Link>
        </div>

        {/* Client Header */}
        <div className="card p-6 mb-6">
          {isEditing ? (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="label">Name *</label>
                <input
                  type="text"
                  required
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input
                  type="tel"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  className="input"
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <div>
                <label className="label">Project Description</label>
                <textarea
                  rows={3}
                  value={editData.project_description}
                  onChange={(e) =>
                    setEditData({ ...editData, project_description: e.target.value })
                  }
                  className="input"
                  placeholder="Brief description of the project or service..."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Budget</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editData.budget}
                    onChange={(e) => setEditData({ ...editData, budget: e.target.value })}
                    className="input"
                    placeholder="5000.00"
                  />
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    value={editData.status}
                    onChange={(e) =>
                      setEditData({
                        ...editData,
                        status: e.target.value as 'general' | 'important' | 'working' | 'finished',
                      })
                    }
                    className="input"
                  >
                    <option value="general">General</option>
                    <option value="important">Important</option>
                    <option value="working">Working</option>
                    <option value="finished">Finished</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getClientStatusColor(
                        client.status
                      )}`}
                    >
                      {getClientStatusLabel(client.status)}
                    </span>
                  </div>
                  {client.budget && (
                    <p className="text-lg text-gray-600 mt-1 flex items-center">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Budget: {formatCurrency(client.budget)}
                    </p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button onClick={() => setIsEditing(true)} className="btn-secondary">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </button>
                  <button
                    onClick={handleDelete}
                    className="btn-secondary text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
                </div>
              </div>

              {client.project_description && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Project Description</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{client.project_description}</p>
                </div>
              )}

              {client.phone && (
                <div className="mb-4 flex items-center text-gray-600">
                  <Phone className="w-4 h-4 mr-2" />
                  <a
                    href={`tel:${client.phone}`}
                    className="text-primary-600 hover:text-primary-700"
                  >
                    {client.phone}
                  </a>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="text-sm text-gray-500">Added {formatTimeAgo(client.created_at)}</p>
              </div>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="card p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Total Projects</div>
            <div className="text-3xl font-bold text-gray-900">{projects.length}</div>
          </div>
          <div className="card p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Total Budget</div>
            <div className="text-3xl font-bold text-gray-900">{formatCurrency(totalBudget)}</div>
          </div>
          <div className="card p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Upcoming Meetings</div>
            <div className="text-3xl font-bold text-gray-900">{upcomingMeetings.length}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Projects */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
                <button className="text-sm text-primary-600 hover:text-primary-700 flex items-center">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Project
                </button>
              </div>
            </div>
            <div className="p-6">
              {projects.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No projects yet</p>
              ) : (
                <ul className="space-y-4">
                  {projects.map((project) => (
                    <li key={project.id} className="border-l-4 border-primary-500 pl-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{project.title}</h3>
                          {project.description && (
                            <p className="text-sm text-gray-600 mt-1">{project.description}</p>
                          )}
                          {project.budget && (
                            <p className="text-sm text-gray-500 mt-1 flex items-center">
                              <DollarSign className="w-3 h-3 mr-1" />
                              {formatCurrency(project.budget)}
                            </p>
                          )}
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                            project.status
                          )}`}
                        >
                          {getStatusLabel(project.status)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Meetings */}
          <div className="card">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Meetings</h2>
                <Link
                  href="/meetings"
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Schedule Meeting
                </Link>
              </div>
            </div>
            <div className="p-6">
              {meetings.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No meetings yet</p>
              ) : (
                <ul className="space-y-4">
                  {meetings.slice(0, 5).map((meeting) => (
                    <li key={meeting.id} className="flex items-start space-x-3">
                      <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{meeting.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatRelativeTime(meeting.meeting_time)} · {meeting.duration_minutes}{' '}
                          min
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
