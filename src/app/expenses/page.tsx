'use client'

import { useEffect, useState, Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { Plus, TrendingUp, Users, Package, X, Calendar, FileText, Eye } from 'lucide-react'
import Rupee from '@/components/Rupee'
import { formatCurrency } from '@/lib/utils'
import { format } from 'date-fns'
import { useSearchParams } from 'next/navigation'

interface Expense {
  id: string
  title: string
  description: string | null
  amount: number
  expense_type: 'team' | 'other'
  date: string
  category: string | null
  project_id: string | null
  project_team_member_id: string | null
  team_member_id: string | null
  total_amount: number | null
  paid_amount: number | null
  payment_status: 'pending' | 'partial' | 'completed' | null
  created_at: string
  projects?: {
    name: string
    clients: {
      name: string
    }
  }
  project_team_members?: {
    profiles: {
      id: string
      full_name: string
      email: string
    }
  }
  team_payment_records?: TeamPaymentRecord[]
}

interface TeamPaymentRecord {
  id: string
  amount: number
  payment_date: string
  payment_type: 'advance' | 'milestone' | 'regular' | 'final'
  notes: string | null
  created_at: string
}

interface AssignedProject {
  id: string
  name: string
  project_team_member_id: string
  team_member_id?: string
  allocated_budget: number
  total_paid: number
  clients: {
    name: string
  }
}

interface TeamMemberOption {
  profileId: string // profiles.id / payee
  name: string
  email: string
}

function ExpensesPageContent() {
  const { user, organization } = useAuth()
  const searchParams = useSearchParams()
  const preselectedProjectId = searchParams?.get('project')

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [assignedProjects, setAssignedProjects] = useState<AssignedProject[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)

  const [newExpense, setNewExpense] = useState({
    title: '',
    expense_type: 'team' as 'team' | 'other',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    project_id: preselectedProjectId || '',
    project_team_member_id: '',
    team_member_profile_id: '',
  })

  const [newPayment, setNewPayment] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_type: 'regular' as 'advance' | 'milestone' | 'regular' | 'final',
    notes: '',
  })

  const [editExpense, setEditExpense] = useState({
    title: '',
    expense_type: 'team' as 'team' | 'other',
    amount: '',
    date: '',
    project_id: '',
    team_member_profile_id: '',
  })

  useEffect(() => {
    if (user && organization) {
      fetchData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, organization])

  const fetchData = async () => {
    try {
      setLoading(true)
      await Promise.all([fetchAssignedProjects(), fetchExpenses(), fetchTeamMembers()])
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamMembers = async () => {
    try {
      // Fetch all team members in the organization
      const { data, error } = await supabase
        .from('organization_members')
        .select(
          `
          user_id,
          profiles (id, full_name, email)
        `
        )
        .eq('organization_id', organization?.organizationId)
        .eq('status', 'active')
        .neq('role', 'owner') // Don't show owner in team member list

      if (error) throw error

      const formatted: TeamMemberOption[] = (data || []).map((member: any) => ({
        profileId: member.user_id,
        name: member.profiles?.full_name || 'Unnamed member',
        email: member.profiles?.email || '',
      }))

      setTeamMembers(formatted)
    } catch (error: any) {
      console.error('Error fetching team members:', error)
      toast.error('Failed to load team members')
    }
  }

  const fetchAssignedProjects = async () => {
    try {
      // If the current user is an owner or admin, show all projects for the organization
      if (organization?.role === 'owner' || organization?.role === 'admin') {
        const { data, error } = await supabase
          .from('projects')
          .select(`id, name, clients (name)`)
          .eq('organization_id', organization.organizationId)
          .order('name')

        if (error) throw error

        const formatted = (data || []).map((proj: any) => ({
          id: proj.id,
          name: proj.name,
          // Owners aren't tied to a project_team_member row, so leave empty
          project_team_member_id: '',
          allocated_budget: 0,
          total_paid: 0,
          clients: proj.clients,
        }))

        setAssignedProjects(formatted)
        return
      }

      // Fallback for team members: fetch only projects the user is assigned to
      const { data, error } = await supabase
        .from('project_team_members')
        .select(
          `
          project_team_member_id:id,
          team_member_id,
          allocated_budget,
          total_paid,
          projects (
            id,
            name,
            clients (name)
          )
        `
        )
        .eq('team_member_id', user?.id)

      if (error) throw error

      const formattedProjects = (data || []).map((item: any) => ({
        id: item.projects.id,
        name: item.projects.name,
        project_team_member_id: item.project_team_member_id,
        team_member_id: item.team_member_id,
        allocated_budget: item.allocated_budget,
        total_paid: item.total_paid,
        clients: item.projects.clients,
      }))

      setAssignedProjects(formattedProjects)
    } catch (error: any) {
      console.error('Error fetching projects:', error)
      toast.error('Failed to fetch assigned projects')
    }
  }

  const fetchExpenses = async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select(
          `
          *,
          projects (
            name,
            clients (name)
          ),
          project_team_members (
            profiles (id, full_name, email)
          ),
          team_payment_records (*)
        `
        )
        .eq('organization_id', organization?.organizationId)
        .order('date', { ascending: false })

      if (error) throw error
      setExpenses(data || [])
    } catch (error: any) {
      console.error('Error fetching expenses:', error)
      toast.error('Failed to fetch expenses')
    }
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newExpense.title) {
      toast.error('Please enter expense title')
      return
    }

    const amount = parseFloat(newExpense.amount)
    const totalAmount = amount

    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (newExpense.expense_type === 'team') {
      if (!newExpense.project_id) {
        toast.error('Please select a project')
        return
      }
      if (!newExpense.team_member_profile_id) {
        toast.error('Please select a team member')
        return
      }
    }

    try {
      let projectTeamMemberId = null

      // If team expense, ensure the team member is assigned to the project
      if (newExpense.expense_type === 'team') {
        // Check if team member is already assigned to this project
        const { data: existingAssignment } = await supabase
          .from('project_team_members')
          .select('id')
          .eq('project_id', newExpense.project_id)
          .eq('team_member_id', newExpense.team_member_profile_id)
          .maybeSingle()

        if (existingAssignment) {
          // Use existing assignment
          projectTeamMemberId = existingAssignment.id
        } else {
          // Auto-assign team member to project
          const { data: newAssignment, error: assignError } = await supabase
            .from('project_team_members')
            .insert({
              project_id: newExpense.project_id,
              team_member_id: newExpense.team_member_profile_id,
              status: 'active',
            })
            .select('id')
            .single()

          if (assignError) throw assignError
          projectTeamMemberId = newAssignment.id
          toast.success('Team member auto-assigned to project')
        }
      }

      // Create expense
      const expenseData: any = {
        title: newExpense.title,
        description:
          newExpense.expense_type === 'team'
            ? `Payment to team member for ${
                assignedProjects.find((p) => p.id === newExpense.project_id)?.name || 'project'
              }`
            : null,
        amount: amount,
        expense_type: newExpense.expense_type,
        date: newExpense.date,
        user_id: user?.id,
        organization_id: organization?.organizationId,
      }

      if (newExpense.expense_type === 'team') {
        expenseData.project_id = newExpense.project_id
        expenseData.project_team_member_id = projectTeamMemberId
        expenseData.team_member_id = newExpense.team_member_profile_id
        expenseData.total_amount = totalAmount
        expenseData.paid_amount = amount
      } else {
        // For other expenses, ensure these are null
        expenseData.project_id = null
        expenseData.project_team_member_id = null
        expenseData.team_member_id = null
        expenseData.total_amount = null
        expenseData.paid_amount = null
      }

      const { data: expense, error: expenseError } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select()
        .single()

      if (expenseError) throw expenseError

      // If team payment with initial amount, create payment record
      if (newExpense.expense_type === 'team' && amount > 0) {
        const { error: paymentError } = await supabase.from('team_payment_records').insert({
          expense_id: expense.id,
          created_by: user?.id,
          amount: amount,
          payment_date: newExpense.date,
          payment_type: 'regular',
          notes: 'Full payment recorded by owner',
        })

        if (paymentError) throw paymentError
      }

      toast.success('Expense added successfully')
      setShowAddModal(false)
      setNewExpense({
        title: '',
        expense_type: 'team',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        project_id: '',
        project_team_member_id: '',
        team_member_profile_id: '',
      })
      fetchData()
    } catch (error: any) {
      console.error('Error adding expense:', error)
      toast.error(error.message || 'Failed to add expense')
    }
  }

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', expenseId)

      if (error) throw error

      toast.success('Expense deleted successfully')
      fetchData()
    } catch (error: any) {
      console.error('Error deleting expense:', error)
      toast.error(error.message || 'Failed to delete expense')
    }
  }

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense)
    setEditExpense({
      title: expense.title,
      expense_type: expense.expense_type,
      amount: expense.amount.toString(),
      date: expense.date,
      project_id: expense.project_id || '',
      team_member_profile_id: expense.team_member_id || '',
    })
    setShowEditModal(true)
  }

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!editingExpense) return

    if (!editExpense.title) {
      toast.error('Please enter expense title')
      return
    }

    const amount = parseFloat(editExpense.amount)

    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (editExpense.expense_type === 'team') {
      if (!editExpense.project_id) {
        toast.error('Please select a project')
        return
      }
      if (!editExpense.team_member_profile_id) {
        toast.error('Please select a team member')
        return
      }
    }

    try {
      let projectTeamMemberId = editingExpense.project_team_member_id

      // If team expense and team member changed, update project assignment
      if (
        editExpense.expense_type === 'team' &&
        editExpense.team_member_profile_id !== editingExpense.team_member_id
      ) {
        // Check if team member is already assigned to this project
        const { data: existingAssignment } = await supabase
          .from('project_team_members')
          .select('id')
          .eq('project_id', editExpense.project_id)
          .eq('team_member_id', editExpense.team_member_profile_id)
          .maybeSingle()

        if (existingAssignment) {
          projectTeamMemberId = existingAssignment.id
        } else {
          // Auto-assign team member to project
          const { data: newAssignment, error: assignError } = await supabase
            .from('project_team_members')
            .insert({
              project_id: editExpense.project_id,
              team_member_id: editExpense.team_member_profile_id,
              status: 'active',
            })
            .select('id')
            .single()

          if (assignError) throw assignError
          projectTeamMemberId = newAssignment.id
          toast.success('Team member auto-assigned to project')
        }
      }

      // Update expense
      const expenseData: any = {
        title: editExpense.title,
        amount: amount,
        date: editExpense.date,
      }

      if (editExpense.expense_type === 'team') {
        expenseData.project_id = editExpense.project_id
        expenseData.project_team_member_id = projectTeamMemberId
        expenseData.team_member_id = editExpense.team_member_profile_id
        expenseData.description = `Payment to team member for ${
          assignedProjects.find((p) => p.id === editExpense.project_id)?.name || 'project'
        }`
      } else {
        expenseData.project_id = null
        expenseData.project_team_member_id = null
        expenseData.team_member_id = null
        expenseData.description = null
      }

      const { error: updateError } = await supabase
        .from('expenses')
        .update(expenseData)
        .eq('id', editingExpense.id)

      if (updateError) throw updateError

      toast.success('Expense updated successfully')
      setShowEditModal(false)
      setEditingExpense(null)
      setEditExpense({
        title: '',
        expense_type: 'team',
        amount: '',
        date: '',
        project_id: '',
        team_member_profile_id: '',
      })
      fetchData()
    } catch (error: any) {
      console.error('Error updating expense:', error)
      toast.error(error.message || 'Failed to update expense')
    }
  }

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedExpense) return

    const amount = parseFloat(newPayment.amount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    const remainingAmount = (selectedExpense.total_amount || 0) - (selectedExpense.paid_amount || 0)
    if (amount > remainingAmount) {
      toast.error(`Amount cannot exceed remaining balance: ${formatCurrency(remainingAmount)}`)
      return
    }

    try {
      const { error } = await supabase.from('team_payment_records').insert({
        expense_id: selectedExpense.id,
        created_by: user?.id,
        amount,
        payment_date: newPayment.payment_date,
        payment_type: newPayment.payment_type,
        notes: newPayment.notes || null,
      })

      if (error) throw error

      toast.success('Payment recorded successfully')
      setShowPaymentModal(false)
      setSelectedExpense(null)
      setNewPayment({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_type: 'regular',
        notes: '',
      })
      fetchData()
    } catch (error: any) {
      console.error('Error adding payment:', error)
      toast.error(error.message || 'Failed to record payment')
    }
  }

  const getPaymentStatusColor = (status: string | null) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'partial':
        return 'bg-yellow-100 text-yellow-800'
      case 'pending':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPaymentStatusLabel = (status: string | null) => {
    if (!status) return 'N/A'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  // Calculate stats
  const stats = {
    total: expenses.reduce((sum, exp) => sum + exp.amount, 0),
    team: expenses
      .filter((e) => e.expense_type === 'team')
      .reduce((sum, exp) => sum + (exp.total_amount || exp.amount), 0),
    other: expenses
      .filter((e) => e.expense_type === 'other')
      .reduce((sum, exp) => sum + exp.amount, 0),
    pending: expenses
      .filter((e) => e.expense_type === 'team' && e.payment_status !== 'completed')
      .reduce((sum, exp) => sum + ((exp.total_amount || 0) - (exp.paid_amount || 0)), 0),
  }

  // Filter expenses based on user's projects if they're a team member
  const filteredExpenses = expenses.filter((expense) => {
    if (expense.expense_type === 'other') return true
    if (!expense.project_id) return true
    return assignedProjects.some((proj) => proj.id === expense.project_id)
  })

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Expenses & Payments</h1>
          <p className="text-gray-600 mt-1">Track project payments and other expenses</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={20} />
          Add Expense
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Expenses</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.total)}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Rupee className="text-blue-600" size={20} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Team Payments</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.team)}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="text-purple-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Other Expenses</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.other)}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Package className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pending Payments</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.pending)}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingUp className="text-red-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expense
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No expenses found. Click &quot;Add Expense&quot; to get started.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    {/* Expense Column */}
                    <td className="px-6 py-4">
                      {expense.expense_type === 'team' && expense.project_team_members ? (
                        <div>
                          <div className="text-sm font-bold text-gray-900">
                            {expense.project_team_members.profiles.full_name}
                          </div>
                          <div className="text-sm text-gray-600">{expense.title}</div>
                        </div>
                      ) : (
                        <div className="text-sm font-medium text-gray-900">{expense.title}</div>
                      )}
                    </td>

                    {/* Type Column */}
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          expense.expense_type === 'team'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {expense.expense_type === 'team' ? 'Team Payment' : 'Other'}
                      </span>
                    </td>

                    {/* Project Column */}
                    <td className="px-6 py-4">
                      {expense.projects ? (
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">{expense.projects.name}</div>
                          <div className="text-xs text-gray-500">
                            {expense.projects.clients.name}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">-</span>
                      )}
                    </td>

                    {/* Amount Column */}
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(expense.amount)}
                      </div>
                    </td>

                    {/* Date Column */}
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {format(new Date(expense.date), 'MMM dd, yyyy')}
                    </td>

                    {/* Actions Column */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(expense)}
                          className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          title="Edit expense"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            // TODO: Implement delete functionality
                            if (confirm('Are you sure you want to delete this expense?')) {
                              handleDeleteExpense(expense.id)
                            }
                          }}
                          className="text-red-600 hover:text-red-900 text-sm font-medium"
                          title="Delete expense"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Add New Expense</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-4">
                {/* Expense Type Selection */}
                <div>
                  <label className="label">Expense Type *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewExpense({ ...newExpense, expense_type: 'team' })}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        newExpense.expense_type === 'team'
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Users className="mx-auto mb-2" size={24} />
                      <div className="font-medium">Team Payment</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Payment to team member for project
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewExpense({ ...newExpense, expense_type: 'other' })}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        newExpense.expense_type === 'other'
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Package className="mx-auto mb-2" size={24} />
                      <div className="font-medium">Other Expense</div>
                      <div className="text-xs text-gray-500 mt-1">General business expense</div>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="label">Title *</label>
                  <input
                    type="text"
                    value={newExpense.title}
                    onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                    className="input w-full"
                    placeholder="e.g., January payment, Office supplies"
                    required
                  />
                </div>

                {/* Project Selection - Only for team payments */}
                {newExpense.expense_type === 'team' && (
                  <div>
                    <label className="label">Project *</label>
                    <select
                      value={newExpense.project_id}
                      onChange={(e) => {
                        const projectId = e.target.value
                        setNewExpense({
                          ...newExpense,
                          project_id: projectId,
                          project_team_member_id: '',
                          team_member_profile_id: '',
                        })
                      }}
                      className="input w-full"
                      required
                    >
                      <option value="">Select a project</option>
                      {assignedProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name} - {project.clients.name}
                        </option>
                      ))}
                    </select>
                    {assignedProjects.length === 0 && (
                      <p className="text-sm text-red-600 mt-1">
                        You are not assigned to any projects yet.
                      </p>
                    )}
                  </div>
                )}

                {/* Team member selection */}
                {newExpense.expense_type === 'team' && (
                  <div>
                    <label className="label">Team Member *</label>
                    <select
                      value={newExpense.team_member_profile_id}
                      onChange={(e) => {
                        const profileId = e.target.value
                        setNewExpense({
                          ...newExpense,
                          team_member_profile_id: profileId,
                        })
                      }}
                      className="input w-full"
                      required
                      disabled={!teamMembers.length}
                    >
                      <option value="">Select a team member</option>
                      {teamMembers.map((member) => (
                        <option key={member.profileId} value={member.profileId}>
                          {member.name} {member.email ? `(${member.email})` : ''}
                        </option>
                      ))}
                    </select>
                    {!teamMembers.length && (
                      <p className="text-sm text-red-600 mt-1">
                        No active team members in your organization.
                      </p>
                    )}
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label className="label">Amount *</label>
                  <input
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="input w-full"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="label">Date *</label>
                  <input
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Add Expense
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Expense Modal */}
      {showEditModal && editingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Edit Expense</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingExpense(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateExpense} className="space-y-4">
                {/* Expense Type Selection */}
                <div>
                  <label className="label">Expense Type *</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setEditExpense({ ...editExpense, expense_type: 'team' })}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        editExpense.expense_type === 'team'
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Users className="mx-auto mb-2" size={24} />
                      <div className="font-medium">Team Payment</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Payment to team member for project
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditExpense({ ...editExpense, expense_type: 'other' })}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        editExpense.expense_type === 'other'
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Package className="mx-auto mb-2" size={24} />
                      <div className="font-medium">Other Expense</div>
                      <div className="text-xs text-gray-500 mt-1">General business expense</div>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="label">Title *</label>
                  <input
                    type="text"
                    value={editExpense.title}
                    onChange={(e) => setEditExpense({ ...editExpense, title: e.target.value })}
                    className="input w-full"
                    placeholder="e.g., January payment, Office supplies"
                    required
                  />
                </div>

                {/* Project Selection - Only for team payments */}
                {editExpense.expense_type === 'team' && (
                  <div>
                    <label className="label">Project *</label>
                    <select
                      value={editExpense.project_id}
                      onChange={(e) => {
                        const projectId = e.target.value
                        setEditExpense({
                          ...editExpense,
                          project_id: projectId,
                          team_member_profile_id: '',
                        })
                      }}
                      className="input w-full"
                      required
                    >
                      <option value="">Select a project</option>
                      {assignedProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name} - {project.clients.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Team member selection */}
                {editExpense.expense_type === 'team' && (
                  <div>
                    <label className="label">Team Member *</label>
                    <select
                      value={editExpense.team_member_profile_id}
                      onChange={(e) => {
                        const profileId = e.target.value
                        setEditExpense({
                          ...editExpense,
                          team_member_profile_id: profileId,
                        })
                      }}
                      className="input w-full"
                      required
                      disabled={!teamMembers.length}
                    >
                      <option value="">Select a team member</option>
                      {teamMembers.map((member) => (
                        <option key={member.profileId} value={member.profileId}>
                          {member.name} {member.email ? `(${member.email})` : ''}
                        </option>
                      ))}
                    </select>
                    {!teamMembers.length && (
                      <p className="text-sm text-red-600 mt-1">
                        No active team members in your organization.
                      </p>
                    )}
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label className="label">Amount *</label>
                  <input
                    type="number"
                    value={editExpense.amount}
                    onChange={(e) => setEditExpense({ ...editExpense, amount: e.target.value })}
                    className="input w-full"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    required
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="label">Date *</label>
                  <input
                    type="date"
                    value={editExpense.date}
                    onChange={(e) => setEditExpense({ ...editExpense, date: e.target.value })}
                    className="input w-full"
                    required
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingExpense(null)
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary">
                    Update Expense
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Payment Details</h2>
                <button
                  onClick={() => {
                    setShowPaymentModal(false)
                    setSelectedExpense(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Expense Summary */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">{selectedExpense.title}</h3>
                {selectedExpense.projects && (
                  <p className="text-sm text-gray-600 mb-2">
                    Project: {selectedExpense.projects.name}
                  </p>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Total:</span>
                  <span className="font-semibold">
                    {formatCurrency(selectedExpense.total_amount || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Paid:</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(selectedExpense.paid_amount || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t mt-2">
                  <span className="text-gray-600">Remaining:</span>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(
                      (selectedExpense.total_amount || 0) - (selectedExpense.paid_amount || 0)
                    )}
                  </span>
                </div>
              </div>

              {/* Payment History */}
              {selectedExpense.team_payment_records &&
                selectedExpense.team_payment_records.length > 0 && (
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Payment History</h3>
                    <div className="space-y-2">
                      {selectedExpense.team_payment_records.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex justify-between items-center p-3 bg-gray-50 rounded"
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {formatCurrency(payment.amount)}
                            </div>
                            <div className="text-sm text-gray-600">
                              {format(new Date(payment.payment_date), 'MMM dd, yyyy')} •{' '}
                              {payment.payment_type}
                            </div>
                            {payment.notes && (
                              <div className="text-sm text-gray-500">{payment.notes}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Add New Payment Form */}
              {selectedExpense.payment_status !== 'completed' && (
                <form onSubmit={handleAddPayment} className="space-y-4">
                  <h3 className="font-semibold text-gray-900">Record New Payment</h3>

                  <div>
                    <label className="label">Amount *</label>
                    <input
                      type="number"
                      value={newPayment.amount}
                      onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                      className="input w-full"
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      max={(selectedExpense.total_amount || 0) - (selectedExpense.paid_amount || 0)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Payment Date *</label>
                      <input
                        type="date"
                        value={newPayment.payment_date}
                        onChange={(e) =>
                          setNewPayment({ ...newPayment, payment_date: e.target.value })
                        }
                        className="input w-full"
                        required
                      />
                    </div>
                    <div>
                      <label className="label">Payment Type *</label>
                      <select
                        value={newPayment.payment_type}
                        onChange={(e) =>
                          setNewPayment({ ...newPayment, payment_type: e.target.value as any })
                        }
                        className="input w-full"
                        required
                      >
                        <option value="advance">Advance</option>
                        <option value="milestone">Milestone</option>
                        <option value="regular">Regular</option>
                        <option value="final">Final</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label">Notes</label>
                    <textarea
                      value={newPayment.notes}
                      onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                      className="input w-full"
                      rows={2}
                      placeholder="Optional notes..."
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPaymentModal(false)
                        setSelectedExpense(null)
                      }}
                      className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Close
                    </button>
                    <button type="submit" className="btn-primary">
                      Record Payment
                    </button>
                  </div>
                </form>
              )}

              {selectedExpense.payment_status === 'completed' && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2 text-green-600">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="font-medium">Payment Completed</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <ExpensesPageContent />
    </Suspense>
  )
}
