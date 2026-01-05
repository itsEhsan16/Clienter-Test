'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Plus, X } from 'lucide-react'

interface Client {
  id: string
  name: string
  company_name: string | null
}

interface TeamMember {
  id: string
  profiles: {
    full_name: string
    email: string
  }
}

interface AssignedTeamMember {
  team_member_id: string
  full_name: string
  email: string
  allocated_budget: number
}

export default function NewProjectPage() {
  const { user, organization } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedClientId = searchParams?.get('client')

  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assignedMembers, setAssignedMembers] = useState<AssignedTeamMember[]>([])

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_id: preselectedClientId || '',
    status: 'planning' as const,
    budget: '',
    start_date: '',
    deadline: '',
  })

  useEffect(() => {
    if (user && organization) {
      fetchClients()
      fetchTeamMembers()
    }
  }, [user, organization])

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, company_name')
        .eq('organization_id', organization?.organizationId)
        .order('name')

      if (error) throw error
      setClients(data || [])
    } catch (error: any) {
      console.error('Error fetching clients:', error)
      toast.error('Failed to fetch clients')
    }
  }

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('id, profiles (full_name, email)')
        .eq('organization_id', organization?.organizationId)
        .order('created_at')

      if (error) throw error
      setTeamMembers(
        (data || []).map((tm: any) => ({
          id: tm.id,
          profiles: tm.profiles
            ? tm.profiles[0] || { full_name: 'Unknown', email: '' }
            : { full_name: 'Unknown', email: '' },
        }))
      )
    } catch (error: any) {
      console.error('Error fetching team members:', error)
      toast.error('Failed to fetch team members')
    }
  }

  const handleAddTeamMember = () => {
    if (teamMembers.length === 0) {
      toast.error('No team members available')
      return
    }

    const availableMembers = teamMembers.filter(
      (tm) => !assignedMembers.some((am) => am.team_member_id === tm.id)
    )

    if (availableMembers.length === 0) {
      toast.error('All team members already assigned')
      return
    }

    const firstAvailable = availableMembers[0]
    setAssignedMembers([
      ...assignedMembers,
      {
        team_member_id: firstAvailable.id,
        full_name: firstAvailable.profiles.full_name,
        email: firstAvailable.profiles.email,
        allocated_budget: 0,
      },
    ])
  }

  const handleRemoveTeamMember = (index: number) => {
    setAssignedMembers(assignedMembers.filter((_, i) => i !== index))
  }

  const handleTeamMemberChange = (index: number, field: string, value: any) => {
    const updated = [...assignedMembers]
    if (field === 'team_member_id') {
      const member = teamMembers.find((tm) => tm.id === value)
      if (member) {
        updated[index] = {
          ...updated[index],
          team_member_id: value,
          full_name: member.profiles.full_name,
          email: member.profiles.email,
        }
      }
    } else {
      updated[index] = { ...updated[index], [field]: value }
    }
    setAssignedMembers(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.client_id) {
      toast.error('Please fill in all required fields')
      return
    }

    const budget = parseFloat(formData.budget)
    if (isNaN(budget) || budget < 0) {
      toast.error('Please enter a valid budget')
      return
    }

    // Validate team member budgets
    const totalAllocated = assignedMembers.reduce((sum, member) => sum + member.allocated_budget, 0)
    if (assignedMembers.length > 0 && totalAllocated > budget) {
      toast.error(
        `Total allocated budget (${totalAllocated}) cannot exceed project budget (${budget})`
      )
      return
    }

    try {
      setLoading(true)

      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: formData.name,
          description: formData.description || null,
          client_id: formData.client_id,
          organization_id: organization?.organizationId,
          status: formData.status,
          budget,
          start_date: formData.start_date || null,
          deadline: formData.deadline || null,
        })
        .select()
        .single()

      if (projectError) throw projectError

      // Assign team members
      if (assignedMembers.length > 0) {
        const { error: membersError } = await supabase.from('project_team_members').insert(
          assignedMembers.map((member) => ({
            project_id: project.id,
            team_member_id: member.team_member_id,
            allocated_budget: member.allocated_budget,
          }))
        )

        if (membersError) throw membersError
      }

      toast.success('Project created successfully')
      router.push(`/projects/${project.id}`)
    } catch (error: any) {
      console.error('Error creating project:', error)
      toast.error(error.message || 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  const availableTeamMembers = teamMembers.filter(
    (tm) => !assignedMembers.some((am) => am.team_member_id === tm.id)
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={20} />
          Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Create New Project</h1>
        <p className="text-gray-600 mt-1">Set up a new project for your client</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>

          <div className="space-y-4">
            <div>
              <label className="label">Project Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input w-full"
                placeholder="e.g., Website Redesign"
                required
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input w-full"
                rows={3}
                placeholder="Brief description of the project..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Client *</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="input w-full"
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name || client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="input w-full"
                >
                  <option value="planning">Planning</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label">Budget *</label>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                className="input w-full"
                placeholder="0.00"
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Start Date</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="label">Deadline</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="input w-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Team Members */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Assign Team Members</h2>
            <button
              type="button"
              onClick={handleAddTeamMember}
              className="btn-primary flex items-center gap-2"
              disabled={availableTeamMembers.length === 0}
            >
              <Plus size={16} />
              Add Member
            </button>
          </div>

          {assignedMembers.length === 0 ? (
            <p className="text-gray-600 text-center py-8">
              No team members assigned yet. Click "Add Member" to assign team members.
            </p>
          ) : (
            <div className="space-y-3">
              {assignedMembers.map((member, index) => (
                <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Team Member</label>
                      <select
                        value={member.team_member_id}
                        onChange={(e) =>
                          handleTeamMemberChange(index, 'team_member_id', e.target.value)
                        }
                        className="input w-full"
                      >
                        <option value={member.team_member_id}>
                          {member.full_name} ({member.email})
                        </option>
                        {availableTeamMembers.map((tm) => (
                          <option key={tm.id} value={tm.id}>
                            {tm.profiles.full_name} ({tm.profiles.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">Allocated Budget</label>
                      <input
                        type="number"
                        value={member.allocated_budget}
                        onChange={(e) =>
                          handleTeamMemberChange(
                            index,
                            'allocated_budget',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="input w-full"
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveTeamMember(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg mt-6"
                  >
                    <X size={20} />
                  </button>
                </div>
              ))}

              {assignedMembers.length > 0 && formData.budget && (
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-sm font-medium text-gray-700">Total Allocated:</span>
                  <span className="text-lg font-semibold text-gray-900">
                    ${assignedMembers.reduce((sum, m) => sum + m.allocated_budget, 0).toFixed(2)} /
                    ${parseFloat(formData.budget || '0').toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={loading}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  )
}
