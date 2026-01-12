'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { TopBar } from '@/components/TopBar'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function NewClientPage() {
  const { user, supabase, organization, refreshOrganization } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
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
      // Ensure the user belongs to an organization (org-based RLS)
      let orgId = organization?.organizationId || null

      if (!orgId) {
        try {
          const { data: membership, error: membershipError } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .eq('status', 'active')
            .limit(1)

          if (membership && membership.length > 0) {
            orgId = membership[0].organization_id
          }
        } catch (err) {
          console.warn('Could not fetch organization membership:', err)
        }
      }

      if (!orgId) {
        setError('You must be part of an active organization to create a client')
        setLoading(false)
        return
      }

      // Get the max order within the organization
      const { data: maxOrderData } = await supabase
        .from('clients')
        .select('order')
        .eq('organization_id', orgId)
        .order('order', { ascending: false })
        .limit(1)

      const nextOrder =
        maxOrderData && maxOrderData.length > 0 ? (maxOrderData[0].order || 0) + 1 : 0

      const clientData = {
        user_id: user.id,
        organization_id: orgId,
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        order: nextOrder,
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
        setLoading(false)
        setFormData({
          name: '',
          phone: '',
        })
        // keep the success message briefly, but do NOT navigate away
        setTimeout(() => setSuccess(false), 1500)
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
        description="Create a new client profile"
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
                  <p className="text-sm text-green-700">Client created successfully!</p>
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

            <div className="flex justify-end space-x-3 pt-4">
              <Link href="/clients" className="btn-secondary">
                Cancel
              </Link>
              <button type="submit" disabled={loading} className="btn-primary">
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
