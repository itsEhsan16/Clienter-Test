'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Edit, Users, Calendar, TrendingUp, Plus, X } from 'lucide-react'
import Rupee from '@/components/Rupee'
import { formatCurrency } from '@/lib/utils'

import { format } from 'date-fns'

interface Project {
  id: string
  name: string
  description: string | null
  client_id: string
  status: string
  budget: number
  total_paid: number
  start_date: string | null
  deadline: string | null
  created_at: string
  clients: {
    id: string
    name: string
    phone: string | null
  }
}

interface TeamMember {
  id: string
  team_member_id: string
  allocated_budget?: number | null
  total_paid?: number | null
  role?: string | null
  profiles: {
    full_name: string
    email: string
  }
}

interface Payment {
  id: string
  amount: number
  payment_date: string
  payment_type: string
  notes: string | null
  profiles: {
    full_name: string
  }
}

export default function ProjectDetailsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const projectId = params.id as string

  const [project, setProject] = useState<Project | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    status: 'new',
    budget: '',
    deadline: '',
  })
  const [showAddMemberModal, setShowAddMemberModal] = useState(false)
  const [availableMembers, setAvailableMembers] = useState<any[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [selectedMember, setSelectedMember] = useState('')
  const [memberRole, setMemberRole] = useState('')
  const [memberBudget, setMemberBudget] = useState('')
  const [addingMember, setAddingMember] = useState(false)

  // Edit member state
  const [showEditMemberModal, setShowEditMemberModal] = useState(false)
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null)
  const [editingMemberRole, setEditingMemberRole] = useState('')
  const [editingMemberBudget, setEditingMemberBudget] = useState('')
  const [editingMemberSaving, setEditingMemberSaving] = useState(false)

  // Delete confirmation modal
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteAssignmentId, setDeleteAssignmentId] = useState<string | null>(null)
  const [deleteMemberName, setDeleteMemberName] = useState('')

  const fetchProjectDetails = useCallback(async () => {
    try {
      setLoading(true)

      // Fetch project via server API (avoids RLS recursion)
      const res = await fetch(`/api/projects/${projectId}`)
      if (!res.ok) {
        let errMsg = 'Failed to fetch project'
        try {
          const body = await res.json()
          errMsg = body?.error || errMsg
        } catch (e) {}
        throw new Error(errMsg)
      }
      const { project: projectData } = await res.json()
      setProject(projectData)

      // Team members are included in the project response (project_team_members)
      setTeamMembers(projectData.project_team_members || [])

      // Fetch payments via server API
      const paymentsRes = await fetch(`/api/projects/${projectId}/payments`)
      if (!paymentsRes.ok) {
        let errMsg = 'Failed to fetch payments'
        try {
          const body = await paymentsRes.json()
          errMsg = body?.error || errMsg
        } catch (e) {}
        throw new Error(errMsg)
      }
      const { payments: paymentsData } = await paymentsRes.json()

      setPayments(
        (paymentsData || []).map((p: any) => ({
          id: p.id,
          amount: p.amount,
          payment_date: p.payment_date,
          payment_type: p.payment_type,
          notes: p.notes,
          profiles: p.creator || { full_name: 'Unknown' },
        }))
      )
    } catch (error: any) {
      console.error('Error fetching project details:', error)
      toast.error('Failed to fetch project details')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (user && projectId) {
      fetchProjectDetails()
    }
  }, [projectId, user, fetchProjectDetails])

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
    switch (status) {
      case 'new':
        return 'New'
      case 'ongoing':
        return 'Ongoing'
      case 'completed':
        return 'Completed'
      default:
        return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  const calculateProgress = (totalPaid?: number | null, budget?: number | null) => {
    const t = totalPaid ?? 0
    const b = budget ?? 0
    if (b === 0) return 0
    return Math.min((t / b) * 100, 100)
  }

  const MS_IN_DAY = 1000 * 60 * 60 * 24

  const deadlineMetrics = useMemo(() => {
    if (!project?.deadline) return null

    const start = project.start_date ? new Date(project.start_date) : new Date(project.created_at)
    const deadline = new Date(project.deadline)
    const now = new Date()

    if (Number.isNaN(start.getTime()) || Number.isNaN(deadline.getTime())) return null

    const totalMs = deadline.getTime() - start.getTime()
    const elapsedMs = now.getTime() - start.getTime()
    const remainingMs = deadline.getTime() - now.getTime()

    const totalDays = Math.max(1, Math.ceil(totalMs / MS_IN_DAY))
    const elapsedDays = Math.max(0, Math.min(totalDays, Math.ceil(elapsedMs / MS_IN_DAY)))
    const daysLeft = remainingMs > 0 ? Math.ceil(remainingMs / MS_IN_DAY) : 0
    const overdueBy = remainingMs < 0 ? Math.abs(Math.ceil(remainingMs / MS_IN_DAY)) : 0

    const progress = totalMs <= 0 ? 100 : Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))

    let badgeText = 'On Track'
    let badgeClass = 'bg-emerald-100 text-emerald-700'

    if (remainingMs < 0) {
      badgeText = 'Overdue'
      badgeClass = 'bg-red-100 text-red-700'
    } else if (daysLeft <= 3) {
      badgeText = 'Critical'
      badgeClass = 'bg-orange-100 text-orange-700'
    } else if (daysLeft <= 7) {
      badgeText = 'Tight'
      badgeClass = 'bg-amber-100 text-amber-700'
    }

    const paceHint =
      remainingMs < 0
        ? 'Deadline passed—ship essentials now.'
        : daysLeft <= 3
        ? 'Sprint mode: clear blockers daily.'
        : daysLeft <= 7
        ? 'Tight timeline: prioritize high-impact tasks.'
        : 'Steady window: keep momentum without scope creep.'

    const daysLeftLabel =
      remainingMs < 0
        ? `Overdue by ${overdueBy} day${overdueBy === 1 ? '' : 's'}`
        : daysLeft === 0
        ? 'Due today'
        : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`

    return {
      start,
      deadline,
      progress,
      totalDays,
      elapsedDays,
      daysLeft,
      overdueBy,
      badgeText,
      badgeClass,
      paceHint,
      daysLeftLabel,
    }
  }, [MS_IN_DAY, project])

  const openEditModal = () => {
    if (!project) return

    setEditForm({
      name: project.name || '',
      description: project.description || '',
      status: project.status || 'new',
      budget: project.budget ? project.budget.toString() : '',
      deadline: project.deadline ? format(new Date(project.deadline), 'yyyy-MM-dd') : '',
    })

    // Open the modal after pre-filling the form
    setShowEditModal(true)
  }

  const fetchAvailableMembers = async () => {
    try {
      setLoadingMembers(true)
      const res = await fetch('/api/team/list')
      if (!res.ok) throw new Error('Failed to fetch team members')
      const { teamMembers } = await res.json()
      setAvailableMembers(teamMembers || [])
    } catch (error: any) {
      console.error('Error fetching team members:', error)
      toast.error('Failed to load team members')
    } finally {
      setLoadingMembers(false)
    }
  }

  const openAddMemberModal = () => {
    fetchAvailableMembers()
    setShowAddMemberModal(true)
    setSelectedMember('')
    setMemberRole('')
    setMemberBudget('')
  }

  const handleAddTeamMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMember) {
      toast.error('Please select a team member')
      return
    }

    try {
      setAddingMember(true)
      const res = await fetch(`/api/projects/${projectId}/team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_member_id: selectedMember,
          role: memberRole || null,
          allocated_budget: memberBudget ? parseFloat(memberBudget) : null,
        }),
      })

      if (!res.ok) {
        let errMsg = 'Failed to add team member'
        try {
          const errBody = await res.json()
          errMsg =
            errBody?.error || (typeof errBody === 'string' ? errBody : JSON.stringify(errBody))
        } catch (e) {
          try {
            const text = await res.text()
            errMsg = text || errMsg
          } catch (e2) {
            // ignore
          }
        }
        console.error('Project add-team response error:', errMsg)
        throw new Error(errMsg)
      }

      toast.success('Team member added successfully!')
      setShowAddMemberModal(false)
      fetchProjectDetails() // Refresh data
    } catch (error: any) {
      console.error('Error adding team member:', error)
      toast.error(error.message || 'Failed to add team member')
    } finally {
      setAddingMember(false)
    }
  }

  const confirmRemoveTeamMember = (assignmentId: string, memberName: string) => {
    setDeleteAssignmentId(assignmentId)
    setDeleteMemberName(memberName)
    setShowDeleteConfirm(true)
  }

  const handleRemoveTeamMemberConfirmed = async () => {
    if (!deleteAssignmentId) return
    try {
      const res = await fetch(
        `/api/projects/${projectId}/team?assignmentId=${deleteAssignmentId}`,
        {
          method: 'DELETE',
        }
      )

      if (!res.ok) {
        let errMsg = 'Failed to remove team member'
        try {
          const errBody = await res.json()
          errMsg = errBody?.error || errMsg
        } catch (e) {
          try {
            const text = await res.text()
            errMsg = text || errMsg
          } catch (e2) {}
        }
        throw new Error(errMsg)
      }

      toast.success('Team member removed successfully!')
      setShowDeleteConfirm(false)
      fetchProjectDetails() // Refresh data
    } catch (error: any) {
      console.error('Error removing team member:', error)
      toast.error(error.message || 'Failed to remove team member')
    }
  }

  const openEditMemberModal = (assignment: any) => {
    setEditingAssignmentId(assignment.id)
    setEditingMemberRole(assignment.role || '')
    setEditingMemberBudget(
      assignment.allocated_budget ? assignment.allocated_budget.toString() : ''
    )
    setShowEditMemberModal(true)
  }

  const handleEditTeamMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAssignmentId) return

    try {
      setEditingMemberSaving(true)
      const res = await fetch(`/api/projects/${projectId}/team`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: editingAssignmentId,
          role: editingMemberRole || null,
          allocated_budget: editingMemberBudget ? parseFloat(editingMemberBudget) : null,
        }),
      })

      if (!res.ok) {
        let errMsg = 'Failed to update team member'
        try {
          const errBody = await res.json()
          errMsg = errBody?.error || errMsg
        } catch (e) {
          try {
            const text = await res.text()
            errMsg = text || errMsg
          } catch (e2) {}
        }
        throw new Error(errMsg)
      }

      toast.success('Team member updated!')
      setShowEditMemberModal(false)
      fetchProjectDetails()
    } catch (error: any) {
      console.error('Error updating team member:', error)
      toast.error(error.message || 'Failed to update team member')
    } finally {
      setEditingMemberSaving(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!project) return

    try {
      setSaving(true)

      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          description: editForm.description || null,
          status: editForm.status,
          budget: editForm.budget ? parseFloat(editForm.budget) : null,
          deadline: editForm.deadline || null,
        }),
      })

      if (!res.ok) {
        // Try parsing JSON safely, fall back to text (server may return HTML during dev errors)
        let errMsg = 'Failed to update project'
        try {
          const errorBody = await res.json()
          errMsg =
            errorBody?.error ||
            (typeof errorBody === 'string' ? errorBody : JSON.stringify(errorBody))
        } catch (e) {
          try {
            const text = await res.text()
            errMsg = text || errMsg
          } catch (e2) {
            // leave default
          }
        }
        console.error('Project update response error:', errMsg)
        throw new Error(errMsg)
      }

      toast.success('Project updated successfully!')
      setShowEditModal(false)
      fetchProjectDetails() // Refresh data
    } catch (error: any) {
      console.error('Error updating project:', error)
      toast.error(error.message || 'Failed to update project')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="p-6">
        <div className="card text-center py-12">
          <p className="text-gray-600">Project not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/projects')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} />
          Back to Projects
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.name}</h1>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                  project.status
                )}`}
              >
                {getStatusLabel(project.status)}
              </span>
              <span className="text-gray-600">Client: {project.clients.name}</span>
            </div>
          </div>
          <button onClick={openEditModal} className="btn-primary flex items-center gap-2">
            <Edit size={16} />
            Edit Project
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div
        className={`grid grid-cols-1 ${
          project.deadline ? 'md:grid-cols-5' : 'md:grid-cols-4'
        } gap-4 mb-6`}
      >
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(project.budget)}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Rupee className="text-purple-600" size={22} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(project.total_paid)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Rupee className="text-green-600" size={22} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Remaining</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(project.budget - project.total_paid)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <TrendingUp className="text-blue-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Team Members</p>
              <p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Users className="text-orange-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-amber-50 via-white to-rose-50" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Deadline</p>
                {project.deadline ? (
                  <p className="text-xl font-bold text-gray-900">
                    {format(new Date(project.deadline), 'MMM dd, yyyy')}
                  </p>
                ) : (
                  <p className="text-lg font-semibold text-gray-700">Not set</p>
                )}
              </div>
              {project.deadline && deadlineMetrics ? (
                <span
                  className={`text-xs px-2 py-1 rounded-full font-semibold ${deadlineMetrics.badgeClass}`}
                >
                  {deadlineMetrics.badgeText}
                </span>
              ) : (
                <button
                  onClick={openEditModal}
                  className="text-xs font-semibold text-orange-600 hover:text-orange-700"
                >
                  Add deadline
                </button>
              )}
            </div>

            {project.deadline && deadlineMetrics ? (
              <div className="mt-4">
                <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500"
                    style={{ width: `${deadlineMetrics.progress}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs text-gray-600 mt-2">
                  <span>{deadlineMetrics.daysLeftLabel}</span>
                  <span>{deadlineMetrics.progress.toFixed(0)}% of time elapsed</span>
                </div>
                <p className="mt-2 text-xs text-gray-700 font-medium">{deadlineMetrics.paceHint}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-600">Set a deadline to track urgency.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Info */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Information</h2>

            {project.description && (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-1">Description</p>
                <p className="text-gray-900">{project.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {project.start_date && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Start Date</p>
                  <p className="text-gray-900">
                    {format(new Date(project.start_date), 'MMM dd, yyyy')}
                  </p>
                </div>
              )}

              {project.deadline && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Deadline</p>
                  <p className="text-gray-900">
                    {format(new Date(project.deadline), 'MMM dd, yyyy')}
                  </p>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Budget Progress</span>
                <span className="text-sm font-semibold text-gray-900">
                  {calculateProgress(project.total_paid, project.budget).toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all"
                  style={{ width: `${calculateProgress(project.total_paid, project.budget)}%` }}
                />
              </div>
            </div>
          </div>

          {/* Team Members */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
              <button
                onClick={openAddMemberModal}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
              >
                <Plus size={16} />
                Add Member
              </button>
            </div>

            {teamMembers.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No team members assigned yet</p>
            ) : (
              <div className="space-y-3">
                {teamMembers.map((member) => (
                  <div key={member.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium text-gray-900">{member.profiles.full_name}</p>
                        <p className="text-sm text-gray-600">{member.profiles.email}</p>
                        {member.role && (
                          <p className="text-xs text-purple-600 mt-1">Role: {member.role}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditMemberModal(member)}
                          className="text-blue-600 hover:text-blue-700 p-1"
                          title="Edit team member"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() =>
                            confirmRemoveTeamMember(member.id, member.profiles.full_name)
                          }
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Remove team member"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Allocated Budget:</span>
                      <span className="font-semibold text-gray-900">
                        {member.allocated_budget !== null && member.allocated_budget !== undefined
                          ? formatCurrency(member.allocated_budget)
                          : 'Not set'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-gray-600">Total Paid:</span>
                      <span className="font-semibold text-green-600">
                        {member.total_paid !== null && member.total_paid !== undefined
                          ? formatCurrency(member.total_paid)
                          : 'N/A'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${calculateProgress(
                              member.total_paid,
                              member.allocated_budget
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Client Info */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Client Details</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600 mb-1">Name</p>
                <p className="text-gray-900">{project.clients.name}</p>
              </div>
              {project.clients.phone && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Phone</p>
                  <p className="text-gray-900">{project.clients.phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Payments */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Payments</h2>
            {payments.length === 0 ? (
              <p className="text-gray-600 text-center py-8 text-sm">No payments recorded yet</p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="pb-3 border-b last:border-b-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(payment.amount)}
                      </span>
                      <span className="text-xs text-gray-500">
                        {format(new Date(payment.payment_date), 'MMM dd')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{payment.profiles.full_name}</p>
                    {payment.notes && <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button
                onClick={() => router.push(`/expenses?project=${projectId}`)}
                className="w-full btn-primary justify-center"
              >
                <Plus size={16} />
                Add Payment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleEditSubmit}>
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Edit Project</h2>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-6 space-y-5">
                {/* Project Name */}
                <div>
                  <label className="label">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="input"
                    required
                    placeholder="Enter project name"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="label">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="input min-h-[100px] resize-y"
                    placeholder="Enter project description"
                    rows={4}
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="label">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="input"
                    required
                  >
                    <option value="new">New</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                {/* Deadline */}
                <div>
                  <label className="label">Deadline</label>
                  <input
                    type="date"
                    value={editForm.deadline}
                    onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                    className="input"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Set or adjust when this project should finish.
                  </p>
                </div>

                {/* Budget */}
                <div>
                  <label className="label">Budget (₹)</label>
                  <input
                    type="number"
                    value={editForm.budget}
                    onChange={(e) => setEditForm({ ...editForm, budget: e.target.value })}
                    className="input"
                    placeholder="Enter budget amount"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving || !editForm.name.trim()}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Team Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <form onSubmit={handleAddTeamMember}>
              {/* Modal Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-xl">
                <h2 className="text-xl font-bold text-gray-900">Add Team Member</h2>
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-6 space-y-4">
                {/* Select Team Member */}
                <div>
                  <label className="label">
                    Team Member <span className="text-red-500">*</span>
                  </label>
                  {loadingMembers ? (
                    <div className="text-gray-500 text-sm">Loading team members...</div>
                  ) : availableMembers.length === 0 ? (
                    <div className="text-gray-500 text-sm">No team members available</div>
                  ) : (
                    <select
                      value={selectedMember}
                      onChange={(e) => setSelectedMember(e.target.value)}
                      className="input"
                      required
                    >
                      <option value="">Select a team member...</option>
                      {availableMembers
                        .filter((m) => !teamMembers.some((tm) => tm.team_member_id === m.id))
                        .map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.full_name || member.email} ({member.role})
                          </option>
                        ))}
                    </select>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label className="label">Role (Optional)</label>
                  <input
                    type="text"
                    value={memberRole}
                    onChange={(e) => setMemberRole(e.target.value)}
                    className="input"
                    placeholder="e.g., Designer, Developer, Writer"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Specify the role of this member in the project
                  </p>
                </div>

                {/* Allocated Budget */}
                <div>
                  <label className="label">Allocated Budget (₹)</label>
                  <input
                    type="number"
                    value={memberBudget}
                    onChange={(e) => setMemberBudget(e.target.value)}
                    className="input"
                    placeholder="Enter budget allocation"
                    min="0"
                    step="0.01"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Budget allocated to this member for this project
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="btn-secondary"
                  disabled={addingMember}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={addingMember || !selectedMember}
                >
                  {addingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Team Member Modal */}
      {showEditMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <form onSubmit={handleEditTeamMember}>
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-xl">
                <h2 className="text-xl font-bold text-gray-900">Edit Team Member</h2>
                <button
                  type="button"
                  onClick={() => setShowEditMemberModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="px-6 py-6 space-y-4">
                <div>
                  <label className="label">Role (Optional)</label>
                  <input
                    type="text"
                    value={editingMemberRole}
                    onChange={(e) => setEditingMemberRole(e.target.value)}
                    className="input"
                    placeholder="e.g., Designer, Developer"
                  />
                </div>
                <div>
                  <label className="label">Allocated Budget (₹)</label>
                  <input
                    type="number"
                    value={editingMemberBudget}
                    onChange={(e) => setEditingMemberBudget(e.target.value)}
                    className="input"
                    placeholder="Enter budget allocation"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3 rounded-b-xl">
                <button
                  type="button"
                  onClick={() => setShowEditMemberModal(false)}
                  className="btn-secondary"
                  disabled={editingMemberSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={editingMemberSaving}>
                  {editingMemberSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="px-6 py-6">
              <h2 className="text-xl font-semibold">Remove Team Member</h2>
              <p className="text-gray-600 mt-2">
                Are you sure you want to remove <strong>{deleteMemberName}</strong> from this
                project? This action cannot be undone.
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">
                  Cancel
                </button>
                <button onClick={handleRemoveTeamMemberConfirmed} className="btn-danger">
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
