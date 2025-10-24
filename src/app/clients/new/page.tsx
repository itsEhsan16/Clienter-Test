'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/TopBar'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function NewClientPage() {
  const { user, supabase } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    project_description: '',
    budget: '',
    status: 'important' as 'general' | 'important' | 'working' | 'finished',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      setError('You must be logged in to create a client')
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const clientData = {
        user_id: user.id,
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        project_description: formData.project_description.trim() || null,
        budget: formData.budget ? parseFloat(formData.budget) : null,
        status: formData.status,
      }

      const { data, error: insertError } = await supabase
        .from('clients')
        .insert([clientData])
        .select()

      if (insertError) {
        console.error('Insert error:', insertError)
        setError(insertError.message || 'Failed to create client')
        setLoading(false)
      } else if (data && data.length > 0) {
        setSuccess(true)
        // Redirect to clients list after a brief delay
        setTimeout(() => {
          router.push('/clients')
        }, 1000)
      } else {
        setError('Failed to create client - no data returned')
        setLoading(false)
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
      setLoading(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div className="min-h-screen">
      <TopBar
        title="Add New Client"
        description="Create a new client profile to start managing their projects"
        actions={
          <Link href="/clients" className="btn-secondary">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Clients
          </Link>
        }
      />

      <div className="p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="card p-8">
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-green-700">
                    Client created successfully! Redirecting...
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="label">
                Client Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="input"
                placeholder="John Doe"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="phone" className="label">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="input"
                placeholder="+1 (555) 123-4567"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="project_description" className="label">
                Project Description
              </label>
              <textarea
                id="project_description"
                name="project_description"
                rows={3}
                value={formData.project_description}
                onChange={handleChange}
                className="input"
                placeholder="Brief description of the project or service..."
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="budget" className="label">
                  Budget
                </label>
                <input
                  type="number"
                  id="budget"
                  name="budget"
                  step="0.01"
                  min="0"
                  value={formData.budget}
                  onChange={handleChange}
                  className="input"
                  placeholder="5000.00"
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="status" className="label">
                  Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="input"
                  disabled={loading}
                >
                  <option value="general">General</option>
                  <option value="important">Important</option>
                  <option value="working">Working</option>
                  <option value="finished">Finished</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Link href="/clients" className="btn-secondary">
                Cancel
              </Link>
              <button type="submit" disabled={loading || success} className="btn-primary">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Client
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
