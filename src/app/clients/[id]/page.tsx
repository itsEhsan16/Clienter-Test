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
import { ArrowLeft, Edit, Trash2, Plus, Phone, Calendar, DollarSign } from 'lucide-react'
import Link from 'next/link'

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
    project_description: '',
    total_amount: '',
    status: 'new' as 'new' | 'ongoing' | 'completed',
  })
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [newPaymentName, setNewPaymentName] = useState('')
  const [newPaymentAmount, setNewPaymentAmount] = useState('')

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
        const paymentsSorted =
          clientData.payments && clientData.payments.length
            ? [...clientData.payments].sort(
                (a: any, b: any) => +new Date(b.created_at) - +new Date(a.created_at)
              )
            : []

        setClient({ ...clientData, payments: paymentsSorted })
        setEditData({
          name: clientData.name,
          phone: clientData.phone || '',
          project_description: clientData.project_description || '',
          total_amount: clientData.total_amount ? clientData.total_amount.toString() : '',
          status: clientData.status,
        })
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!client) return

    const { error } = await supabase
      .from('clients')
      .update({
        name: editData.name,
        phone: editData.phone || null,
        project_description: editData.project_description || null,
        total_amount: editData.total_amount ? parseFloat(editData.total_amount) : null,
        // keep payments as-is when updating basic client info
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
        total_amount: editData.total_amount ? parseFloat(editData.total_amount) : null,
        // payments remain unchanged here
        status: editData.status,
      })
      setIsEditing(false)
    }
  }

  const handleAddPayment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!client) return

    const amount = parseFloat(newPaymentAmount || '0')
    if (!newPaymentName || !amount || amount <= 0) {
      alert('Please enter a valid payment name and amount')
      return
    }

    const existingPayments = client.payments && client.payments.length ? client.payments : []
    const newEntry = { name: newPaymentName, amount, created_at: new Date().toISOString() }
    const updatedPayments = [newEntry, ...existingPayments]
    const totalPaid = updatedPayments.reduce((s, p) => s + (p.amount || 0), 0)

    const { error } = await supabase
      .from('clients')
      .update({
        payments: updatedPayments,
        advance_paid: totalPaid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)

    if (!error) {
      setClient({ ...client, payments: updatedPayments, advance_paid: totalPaid })
      setNewPaymentAmount('')
      setNewPaymentName('')
      setShowAddPayment(false)
    } else {
      console.error('Failed to add payment', error)
      alert('Failed to add payment')
    }
  }

  const handleDeletePayment = async (index: number) => {
    if (!client) return
    if (!confirm('Delete this payment? This cannot be undone.')) return

    const existingPayments = client.payments && client.payments.length ? client.payments : []
    if (index < 0 || index >= existingPayments.length) return

    const updatedPayments = existingPayments.filter((_, i) => i !== index)
    const totalPaid = updatedPayments.reduce((s, p) => s + (p.amount || 0), 0)

    const { error } = await supabase
      .from('clients')
      .update({
        payments: updatedPayments,
        advance_paid: totalPaid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)

    if (!error) {
      setClient({ ...client, payments: updatedPayments, advance_paid: totalPaid })
    } else {
      console.error('Failed to delete payment', error)
      alert('Failed to delete payment')
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
  const totalPaid =
    client.payments && client.payments.length
      ? client.payments.reduce((s, p) => s + (p.amount || 0), 0)
      : client.advance_paid || 0
  const balance = (client?.total_amount || 0) - totalPaid

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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="label">Total Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editData.total_amount}
                    onChange={(e) => setEditData({ ...editData, total_amount: e.target.value })}
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
                        status: e.target.value as 'new' | 'ongoing' | 'completed',
                      })
                    }
                    className="input"
                  >
                    <option value="new">New</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
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
                        client.status || 'new'
                      )}`}
                    >
                      {getClientStatusLabel(client.status || 'new')}
                    </span>
                  </div>
                  {client.total_amount && (
                    <p className="text-lg text-gray-600 mt-1 flex items-center">
                      Total: {formatCurrency(client.total_amount, profile?.currency || 'INR')}
                    </p>
                  )}
                  {totalPaid > 0 && (
                    <p className="text-lg text-green-600 mt-1 flex items-center">
                      Paid: {formatCurrency(totalPaid, profile?.currency || 'INR')}
                    </p>
                  )}
                  {client.total_amount !== undefined && (
                    <p className="text-lg text-orange-600 mt-1 flex items-center">
                      Balance: {formatCurrency(balance, profile?.currency || 'INR')}
                    </p>
                  )}
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

              {client.project_description && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Project Description</h3>
                  <p className="text-gray-600 whitespace-pre-wrap">{client.project_description}</p>
                </div>
              )}

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
            <div className="text-sm font-medium text-gray-600 mb-1">Total Amount</div>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(client.total_amount || 0, profile?.currency || 'INR')}
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

        {/* Payments list / add payment */}
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Payments</h3>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowAddPayment((s) => !s)}
                className="btn-secondary flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Payment
              </button>
            </div>
          </div>

          {client.payments && client.payments.length > 0 ? (
            <ul className="space-y-2 mb-4">
              {client.payments.map((p, idx) => (
                <li key={idx} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{`Payment ${idx + 1}: ${p.name}`}</div>
                    <div className="text-xs text-gray-500">
                      {p.created_at ? formatRelativeTime(p.created_at) : ''}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="text-sm font-semibold">
                      {formatCurrency(p.amount || 0, profile?.currency || 'INR')}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePayment(idx)}
                      className="text-gray-400 hover:text-red-600"
                      aria-label={`Delete payment ${idx + 1}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 mb-4">No payments recorded yet.</p>
          )}

          {showAddPayment && (
            <form onSubmit={handleAddPayment} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                placeholder="Payment name (e.g. Advance)"
                value={newPaymentName}
                onChange={(e) => setNewPaymentName(e.target.value)}
                className="input"
                required
              />
              <input
                placeholder="Amount"
                type="number"
                step="0.01"
                min="0"
                value={newPaymentAmount}
                onChange={(e) => setNewPaymentAmount(e.target.value)}
                className="input"
                required
              />
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddPayment(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Payment
                </button>
              </div>
            </form>
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
