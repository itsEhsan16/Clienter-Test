'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Client, Meeting } from '@/types/database'
import {
  formatCurrency,
  getStatusColor,
  getStatusLabel,
  getClientStatusColor,
  getClientStatusLabel,
} from '@/lib/utils'
import { formatRelativeTime, formatTimeAgo } from '@/lib/date-utils'
import { ArrowLeft, Edit, Trash2, Plus, Phone, Calendar } from 'lucide-react'
import Rupee from '@/components/Rupee'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

function formatPhoneForWhatsApp(phone?: string | null) {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits || null
}

export default function ClientDetailPage() {
  const { user, profile, supabase } = useAuth()
  const router = useRouter()
  const params = useParams()
  const clientId = params?.id as string
  const [client, setClient] = useState<Client | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
  })
  const [projects, setProjects] = useState<any[]>([])
  const [totalBudget, setTotalBudget] = useState(0)
  const [totalPaidFromProjects, setTotalPaidFromProjects] = useState(0)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // remove per-client payment UI state (payments moved to projects)

  useEffect(() => {
    if (!user || !clientId) return

    const fetchData = async () => {
      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
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
        })

        // Fetch projects for this client and compute aggregates
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('id, name, budget, total_paid, status, created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })

        if (!projectsError && projectsData) {
          setProjects(projectsData)
          recomputeTotals(projectsData)
        }
      } else {
        router.push('/clients')
        return
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

  const recomputeTotals = (list: any[]) => {
    const budgetSum = list.reduce((s: number, p: any) => s + (Number(p.budget) || 0), 0)
    const paidSum = list.reduce((s: number, p: any) => s + (Number(p.total_paid) || 0), 0)
    setTotalBudget(budgetSum)
    setTotalPaidFromProjects(paidSum)
  }

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    if (!supabase) return
    const confirmed = window.confirm(
      `Delete project "${projectName}"? This cannot be undone and removes related records.`
    )
    if (!confirmed) return

    setDeletingId(projectId)
    const { error } = await supabase.from('projects').delete().eq('id', projectId)
    setDeletingId(null)

    if (error) {
      console.error('Error deleting project:', error)
      toast.error(error.message || 'Failed to delete project')
      return
    }

    toast.success('Project deleted')
    setProjects((prev) => {
      const next = prev.filter((p) => p.id !== projectId)
      recomputeTotals(next)
      return next
    })
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!client) return

    const { error } = await supabase
      .from('clients')
      .update({
        name: editData.name,
        phone: editData.phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)

    if (!error) {
      setClient({
        ...client,
        name: editData.name,
        phone: editData.phone || null,
      })
      setIsEditing(false)
    }
  }

  const handleDelete = async () => {
    if (!client) return
    if (
      !confirm(
        `Are you sure you want to delete ${client.name}? This will also delete all associated meetings.`
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
  const totalPaid = totalPaidFromProjects || 0
  const balance = (totalBudget || 0) - totalPaid

  return (
    <div className="min-h-screen bg-gray-50">
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
                  </div>

                  {/* Project-based aggregates */}
                  <p className="text-lg text-gray-600 mt-1 flex items-center">
                    Total Budget: {formatCurrency(totalBudget || 0, profile?.currency || 'INR')}
                  </p>
                  <p className="text-lg text-green-600 mt-1 flex items-center">
                    Total Paid:{' '}
                    {formatCurrency(totalPaidFromProjects || 0, profile?.currency || 'INR')}
                  </p>
                  <p className="text-lg text-orange-600 mt-1 flex items-center">
                    Balance:{' '}
                    {formatCurrency(
                      (totalBudget || 0) - (totalPaidFromProjects || 0),
                      profile?.currency || 'INR'
                    )}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Link href={`/projects/new?client=${client.id}`} className="btn-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    New Project
                  </Link>
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

              {client.phone && (
                <div className="mb-4 flex items-center text-gray-600">
                  <Phone className="w-4 h-4 mr-2" />
                  {formatPhoneForWhatsApp(client.phone) ? (
                    <a
                      href={`https://wa.me/${formatPhoneForWhatsApp(client.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-500 hover:text-zinc-600"
                      aria-label={`Open WhatsApp chat with ${client.phone}`}
                    >
                      {client.phone}
                    </a>
                  ) : (
                    <span className="text-zinc-500">{client.phone}</span>
                  )}
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
            <div className="text-sm font-medium text-gray-600 mb-1">Total Budget</div>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(totalBudget || 0, profile?.currency || 'INR')}
            </div>
          </div>
          <div className="card p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Total Paid</div>
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(totalPaid || 0, profile?.currency || 'INR')}
            </div>
          </div>
          <div className="card p-6">
            <div className="text-sm font-medium text-gray-600 mb-1">Balance Due</div>
            <div className="text-3xl font-bold text-orange-600">
              {formatCurrency(balance, profile?.currency || 'INR')}
            </div>
          </div>
        </div>

        {/* Projects list for this client */}
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Projects</h3>
            <div className="flex items-center space-x-2">
              <Link
                href={`/projects/new?client=${client.id}`}
                className="btn-primary flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Link>
            </div>
          </div>

          {projects && projects.length > 0 ? (
            <div className="space-y-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md transition cursor-pointer"
                  onClick={() => router.push(`/projects/${p.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="text-lg font-semibold text-gray-900">{p.name}</h4>
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                            p.status as any
                          )}`}
                        >
                          {getStatusLabel(p.status as any)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-4">
                        <span>
                          Budget: {formatCurrency(p.budget || 0, profile?.currency || 'INR')}
                        </span>
                        <span className="text-green-700 font-medium">
                          Paid: {formatCurrency(p.total_paid || 0, profile?.currency || 'INR')}
                        </span>
                        <span className="text-orange-700 font-medium">
                          Balance:{' '}
                          {formatCurrency(
                            (Number(p.budget) || 0) - (Number(p.total_paid) || 0),
                            profile?.currency || 'INR'
                          )}
                        </span>
                        <span className="text-gray-500">Added {formatTimeAgo(p.created_at)}</span>
                      </div>
                    </div>

                    <button
                      className="text-red-600 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteProject(p.id, p.name)
                      }}
                      disabled={deletingId === p.id}
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 mb-4">No projects for this client yet.</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6">
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
                  {meetings.slice(0, 10).map((meeting) => (
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
