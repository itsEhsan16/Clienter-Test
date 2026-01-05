'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Edit, Users, DollarSign, Calendar, TrendingUp, Plus, X } from 'lucide-react'
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
    name: string
    company_name: string | null
    email: string
  }
}

interface TeamMember {
  id: string
  team_member_id: string
  allocated_budget: number
  total_paid: number
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

  useEffect(() => {
    if (user && projectId) {
      fetchProjectDetails()
    }
  }, [user, projectId])

  const fetchProjectDetails = async () => {
    try {
      setLoading(true)

      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select(
          `
          *,
          clients (name, company_name, email)
        `
        )
        .eq('id', projectId)
        .single()

      if (projectError) throw projectError
      setProject(projectData)

      // Fetch team members
      const { data: teamData, error: teamError } = await supabase
        .from('project_team_members')
        .select(
          `
          *,
          profiles (full_name, email)
        `
        )
        .eq('project_id', projectId)

      if (teamError) throw teamError
      setTeamMembers(teamData || [])

      // Fetch payments via expenses
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('team_payment_records')
        .select(
          `
          id,
          amount,
          payment_date,
          payment_type,
          notes,
          expenses!inner (project_id),
          profiles (full_name)
        `
        )
        .eq('expenses.project_id', projectId)
        .order('payment_date', { ascending: false })
        .limit(10)

      if (paymentsError) throw paymentsError
      setPayments(
        (paymentsData || []).map((p: any) => ({
          id: p.id,
          amount: p.amount,
          payment_date: p.payment_date,
          payment_type: p.payment_type,
          notes: p.notes,
          profiles: p.profiles
            ? p.profiles[0] || { full_name: 'Unknown' }
            : { full_name: 'Unknown' },
        }))
      )
    } catch (error: any) {
      console.error('Error fetching project details:', error)
      toast.error('Failed to fetch project details')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planning':
        return 'bg-gray-100 text-gray-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'on_hold':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusLabel = (status: string) => {
    return status
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const calculateProgress = (totalPaid: number, budget: number) => {
    if (budget === 0) return 0
    return Math.min((totalPaid / budget) * 100, 100)
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
              <span className="text-gray-600">
                Client: {project.clients.company_name || project.clients.name}
              </span>
            </div>
          </div>
          <button
            onClick={() => toast('Edit functionality coming soon')}
            className="btn-primary flex items-center gap-2"
          >
            <Edit size={16} />
            Edit Project
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(project.budget)}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <DollarSign className="text-purple-600" size={24} />
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
              <DollarSign className="text-green-600" size={24} />
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
                onClick={() => toast('Add team member functionality coming soon')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                + Add Member
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
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Allocated Budget:</span>
                      <span className="font-semibold text-gray-900">
                        {formatCurrency(member.allocated_budget)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-gray-600">Total Paid:</span>
                      <span className="font-semibold text-green-600">
                        {formatCurrency(member.total_paid)}
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
              {project.clients.company_name && (
                <div>
                  <p className="text-sm text-gray-600 mb-1">Company</p>
                  <p className="text-gray-900">{project.clients.company_name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-600 mb-1">Email</p>
                <p className="text-gray-900">{project.clients.email}</p>
              </div>
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
    </div>
  )
}
