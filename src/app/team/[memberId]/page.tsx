'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Mail,
  Lock,
  User as UserIcon,
  Calendar,
  DollarSign,
  FileText,
  Copy,
  CheckCircle,
  TrendingUp,
  Clock,
  Briefcase,
} from 'lucide-react'
import { getRoleBadgeColor, getRoleLabel } from '@/lib/rbac-helpers'
import toast from 'react-hot-toast'

export default function TeamMemberDetailPage() {
  const { user, organization } = useAuth()
  const router = useRouter()
  const params = useParams()
  const memberId = params?.memberId as string

  const [member, setMember] = useState<any>(null)
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    activeTasks: 0,
    totalProjects: 0,
    totalEarnings: 0,
  })
  const [loading, setLoading] = useState(true)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const isOwnerOrAdmin = organization?.role === 'owner' || organization?.role === 'admin'

  useEffect(() => {
    if (user && memberId) {
      loadMemberDetails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, memberId])

  const loadMemberDetails = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/team/member-details?memberId=${memberId}`)
      if (!response.ok) throw new Error('Failed to load member details')

      const data = await response.json()
      setMember(data.member)
      setStats(data.stats)
    } catch (error) {
      console.error('Error loading member details:', error)
      toast.error('Failed to load member details')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      toast.success(`${field} copied!`)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      toast.error('Failed to copy')
    }
  }

  const teamLoginUrl = `${window.location.origin}/team-login`

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Team Member Not Found</h2>
          <button
            onClick={() => router.push('/team')}
            className="text-orange-600 hover:text-orange-700"
          >
            ← Back to Team
          </button>
        </div>
      </div>
    )
  }

  const profile = member.profile
  const displayName =
    member.display_name || profile?.full_name || profile?.email?.split('@')[0] || 'Unknown'

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 text-gray-900">
      <div className="max-w-5xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => router.push('/team')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Team</span>
        </button>

        {/* Header Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6 border border-gray-100">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-6">
              <div className="h-24 w-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                <span className="text-white font-bold text-3xl">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{displayName}</h1>
                <div className="flex items-center space-x-4">
                  <span
                    className={`px-3 py-1 inline-flex text-sm leading-5 font-semibold rounded-full ${getRoleBadgeColor(
                      member.role
                    )}`}
                  >
                    {getRoleLabel(member.role)}
                  </span>
                  <span className="text-sm text-gray-500 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Joined {new Date(member.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Stats */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{stats.activeTasks}</div>
                <div className="text-sm text-gray-600">Active Tasks</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{stats.completedTasks}</div>
                <div className="text-sm text-gray-600">Completed Tasks</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <Briefcase className="w-5 h-5 text-purple-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{stats.totalProjects}</div>
                <div className="text-sm text-gray-600">Projects</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border border-gray-100 sm:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  ₹{stats.totalEarnings.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Total Earnings</div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <FileText className="w-5 h-5 text-gray-500" />
                </div>
                <div className="text-2xl font-bold text-gray-900">{stats.totalTasks}</div>
                <div className="text-sm text-gray-600">Total Tasks</div>
              </div>
            </div>

            {/* Additional Info */}
            {member.notes && (
              <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Notes
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">{member.notes}</p>
              </div>
            )}

            {member.monthly_salary && (
              <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2" />
                  Monthly Salary
                </h3>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{member.monthly_salary.toLocaleString()}
                </p>
              </div>
            )}
          </div>

          {/* Right Column - Credentials */}
          <div className="space-y-6">
            {/* Login Credentials Card */}
            {isOwnerOrAdmin && (
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg shadow-lg p-6 border border-orange-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Lock className="w-5 h-5 mr-2 text-orange-600" />
                  Login Credentials
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Share these credentials with your team member
                </p>

                {/* Email */}
                <div className="mb-4">
                  <label className="flex text-sm font-medium text-gray-700 mb-2 items-center">
                    <Mail className="w-4 h-4 mr-1" />
                    Email
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={profile?.email || ''}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(profile?.email || '', 'Email')}
                      className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {copiedField === 'Email' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Password */}
                {member.password_for_sharing && (
                  <div className="mb-4">
                    <label className="flex text-sm font-medium text-gray-700 mb-2 items-center">
                      <Lock className="w-4 h-4 mr-1" />
                      Password
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={member.password_for_sharing}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-mono"
                      />
                      <button
                        onClick={() => copyToClipboard(member.password_for_sharing, 'Password')}
                        className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {copiedField === 'Password' ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Login URL */}
                <div className="mb-4">
                  <label className="flex text-sm font-medium text-gray-700 mb-2 items-center">
                    <UserIcon className="w-4 h-4 mr-1" />
                    Team Member Login URL
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={teamLoginUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => copyToClipboard(teamLoginUrl, 'Login URL')}
                      className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {copiedField === 'Login URL' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Copy All Button */}
                <button
                  onClick={() => {
                    const credentials = `Team Member Login Details\n\nLogin URL: ${teamLoginUrl}\nEmail: ${profile?.email}\nPassword: ${member.password_for_sharing}\n\nPlease keep these credentials secure.`
                    copyToClipboard(credentials, 'All credentials')
                  }}
                  className="w-full mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>Copy All Credentials</span>
                </button>
              </div>
            )}

            {/* Contact Info */}
            <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Info</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Mail className="w-4 h-4 mr-2 text-gray-400" />
                  <span className="text-gray-700">{profile?.email}</span>
                </div>
                {profile?.full_name && (
                  <div className="flex items-center text-sm">
                    <UserIcon className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-gray-700">{profile.full_name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
