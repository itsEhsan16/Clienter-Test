'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Expense } from '@/types/database'
import { formatCurrency } from '@/lib/utils'
import { Plus, Trash2, DollarSign, Calendar, TrendingDown } from 'lucide-react'
import { format } from 'date-fns'

interface MonthlyExpense {
  month: string
  total: number
  count: number
}

export default function ExpensesPage() {
  const { user, profile, supabase } = useAuth()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
  })
  const [monthlyExpenses, setMonthlyExpenses] = useState<MonthlyExpense[]>([])
  const [selectedMonth, setSelectedMonth] = useState<string>('all')

  useEffect(() => {
    if (!user) return
    fetchExpenses()
  }, [user])

  const fetchExpenses = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setExpenses(data)
      calculateMonthlyExpenses(data)
    }
    setIsLoading(false)
  }

  const calculateMonthlyExpenses = (expensesData: Expense[]) => {
    const monthsMap = new Map<string, { total: number; count: number }>()

    expensesData.forEach((expense) => {
      const monthKey = format(new Date(expense.created_at), 'MMM yyyy')
      const existing = monthsMap.get(monthKey) || { total: 0, count: 0 }
      monthsMap.set(monthKey, {
        total: existing.total + Number(expense.amount),
        count: existing.count + 1,
      })
    })

    const monthlyData: MonthlyExpense[] = Array.from(monthsMap.entries())
      .map(([month, data]) => ({
        month,
        total: data.total,
        count: data.count,
      }))
      .sort((a, b) => {
        const dateA = new Date(a.month)
        const dateB = new Date(b.month)
        return dateB.getTime() - dateA.getTime()
      })

    setMonthlyExpenses(monthlyData)
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()

    const { data, error } = await supabase
      .from('expenses')
      .insert([
        {
          user_id: user!.id,
          description: newExpense.description,
          amount: parseFloat(newExpense.amount),
        },
      ])
      .select()

    if (!error && data) {
      setExpenses([data[0], ...expenses])
      calculateMonthlyExpenses([data[0], ...expenses])
      setNewExpense({
        description: '',
        amount: '',
      })
      setShowAddExpense(false)
    } else {
      alert('Failed to add expense')
    }
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return

    const { error } = await supabase.from('expenses').delete().eq('id', id)

    if (!error) {
      const updatedExpenses = expenses.filter((e) => e.id !== id)
      setExpenses(updatedExpenses)
      calculateMonthlyExpenses(updatedExpenses)
    } else {
      alert('Failed to delete expense')
    }
  }

  const filteredExpenses =
    selectedMonth === 'all'
      ? expenses
      : expenses.filter(
          (expense) => format(new Date(expense.created_at), 'MMM yyyy') === selectedMonth
        )

  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const currentMonthExpenses = expenses
    .filter((expense) => {
      const expenseDate = new Date(expense.created_at)
      const now = new Date()
      return (
        expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear()
      )
    })
    .reduce((sum, expense) => sum + Number(expense.amount), 0)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading expenses...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-600 mt-2">Track your business expenses and team costs</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(totalExpenses, profile?.currency || 'INR')}
                </p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {formatCurrency(currentMonthExpenses, profile?.currency || 'INR')}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Count</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{expenses.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Breakdown */}
        {monthlyExpenses.length > 0 && (
          <div className="card p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Monthly Breakdown</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {monthlyExpenses.map((monthData) => (
                <div
                  key={monthData.month}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-600">{monthData.month}</p>
                  <p className="text-lg font-bold text-gray-900 mt-1">
                    {formatCurrency(monthData.total, profile?.currency || 'INR')}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{monthData.count} expenses</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Bar */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filter by month:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="input py-2"
            >
              <option value="all">All Time</option>
              {monthlyExpenses.map((monthData) => (
                <option key={monthData.month} value={monthData.month}>
                  {monthData.month}
                </option>
              ))}
            </select>
          </div>
          <button onClick={() => setShowAddExpense(true)} className="btn-primary">
            <Plus className="w-5 h-5 mr-2" />
            Add Expense
          </button>
        </div>

        {/* Add Expense Form */}
        {showAddExpense && (
          <div className="card p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Expense</h2>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label">Description *</label>
                  <input
                    type="text"
                    required
                    value={newExpense.description}
                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    className="input"
                    placeholder="e.g., Team lunch, Software subscription, Tools"
                  />
                </div>
                <div>
                  <label className="label">Amount *</label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    min="0"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="input"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Expense
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Expenses List */}
        <div className="card">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              {selectedMonth === 'all' ? 'All Expenses' : `Expenses - ${selectedMonth}`}
            </h2>
          </div>
          <div className="overflow-x-auto">
            {filteredExpenses.length === 0 ? (
              <div className="p-12 text-center">
                <TrendingDown className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses yet</h3>
                <p className="text-gray-600 mb-6">
                  Start tracking your business expenses by adding your first expense.
                </p>
                <button onClick={() => setShowAddExpense(true)} className="btn-primary">
                  <Plus className="w-5 h-5 mr-2" />
                  Add First Expense
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Added
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(expense.created_at), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{expense.description}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                        {formatCurrency(expense.amount, profile?.currency || 'INR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
