'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Loader2, Users } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import toast from 'react-hot-toast'

export default function TeamLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      if (data.session) {
        // CRITICAL: Check account_type first to ensure this is a team member
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('account_type, full_name')
          .eq('id', data.user.id)
          .single()

        if (profileError || !profile) {
          await supabase.auth.signOut()
          throw new Error('Unable to verify account type. Please contact support.')
        }

        // Owners cannot login via team login page
        if (profile.account_type === 'owner') {
          await supabase.auth.signOut()
          toast.error('Agency owners must use the main login page')
          setTimeout(() => router.push('/login'), 1500)
          return
        }

        // Check if user is a team member (not owner)
        // Get the first active membership if multiple exist
        const { data: memberships, error: membershipError } = await supabase
          .from('organization_members')
          .select('role, organization_id, display_name, status')
          .eq('user_id', data.user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .limit(1)

        console.log('Membership query result:', { memberships, membershipError })

        if (membershipError) {
          await supabase.auth.signOut()
          console.error('Membership error:', membershipError)
          throw new Error('Database error: ' + membershipError.message)
        }

        if (!memberships || memberships.length === 0) {
          await supabase.auth.signOut()
          throw new Error(
            'Your account is not associated with any active organization. Please contact your administrator to add you as a team member.'
          )
        }

        const membership = memberships[0]

        if (membership.status !== 'active') {
          await supabase.auth.signOut()
          throw new Error('Your account is inactive. Please contact your organization owner.')
        }

        if (membership.role === 'owner') {
          await supabase.auth.signOut()
          toast.error('Owners should use the regular login page')
          setTimeout(() => router.push('/login'), 500)
          return
        }

        // Set httpOnly cookies for server-side middleware/SSR
        try {
          await fetch('/api/auth/set-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_at: data.session.expires_at,
              expires_in: data.session.expires_in ?? 3600,
            }),
          })
        } catch (cookieError) {
          console.warn('[Team Login] Failed to call set-session API:', cookieError)
        }

        toast.success(`Welcome back, ${membership.display_name || 'Team Member'}!`)
        router.push('/teammate/dashboard')
      }
    } catch (error: any) {
      console.error('Login error:', error)
      toast.error(error.message || 'Failed to login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Team Member Login</h1>
          <p className="text-gray-600">Access your tasks and projects</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-gray-900"
                  placeholder="your@email.com"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-gray-900"
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have access?{' '}
              <span className="text-gray-900 font-medium">Contact your organization owner</span>
            </p>
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">Team Member Access</p>
          <p className="text-blue-700">
            This login is exclusively for team members. Organization owners should use the{' '}
            <button
              onClick={() => router.push('/login')}
              className="underline hover:text-blue-900 font-medium"
            >
              main login page
            </button>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
