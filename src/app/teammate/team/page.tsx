'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getTeamMembers, getRoleBadgeColor, getRoleLabel } from '@/lib/rbac-helpers'
import { Users, Mail, Calendar, Shield } from 'lucide-react'

interface TeamMember {
  id: string
  role: string
  status: string
  display_name?: string | null
  notes?: string | null
  monthly_salary?: number | null
  profile?: {
    id: string
    email: string
    full_name?: string | null
    created_at?: string | null
  } | null
  created_at?: string | null
}

export default function TeammateTeamPage() {
  const { user, organization, loading: authLoading } = useAuth()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && user) {
      loadMembers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user])

  const loadMembers = async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await getTeamMembers(user.id)
      setMembers(data as TeamMember[])
    } catch (err) {
      console.error('Failed to load team members', err)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto animate-pulse space-y-4">
          <div className="h-8 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-64 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Team</h1>
          <p className="text-gray-600">Organization context not found. Please re-login.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-gray-900">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-gray-600">All teammates in {organization.organizationName}</p>
        </div>

        {members.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
            <Users className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-700 font-medium">No teammates found</p>
            <p className="text-sm text-gray-500 mt-1">Ask your owner/admin to add teammates.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map((member) => (
              <div
                key={member.id}
                className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {member.display_name ||
                        member.profile?.full_name ||
                        member.profile?.email ||
                        'Team Member'}
                    </p>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {member.profile?.email || '—'}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(
                      member.role as any
                    )}`}
                  >
                    {getRoleLabel(member.role as any)}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1">
                    <Shield className="w-4 h-4 text-gray-400" />
                    {member.status === 'active' ? 'Active' : member.status || 'Unknown'}
                  </span>
                  {member.created_at && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      Joined {new Date(member.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {member.notes && (
                  <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-3">
                    {member.notes}
                  </p>
                )}

                {member.monthly_salary && (
                  <p className="text-sm text-gray-700">
                    Monthly allocation:{' '}
                    <span className="font-semibold">₹{member.monthly_salary}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
