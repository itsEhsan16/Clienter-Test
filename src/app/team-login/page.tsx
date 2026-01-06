'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Loader2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'

export default function TeamLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // If a session already exists, route to the right dashboard
  useEffect(() => {
    const checkExistingSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('id', session.user.id)
          .maybeSingle()

        if (profile?.account_type === 'owner') {
          router.replace('/dashboard')
        } else {
          router.replace('/teammate/dashboard')
        }
      }
    }

    checkExistingSession()
  }, [router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    console.log('[Team Login] ========== FORM SUBMITTED ==========')
    setLoading(true)
    setErrorMessage('')

    try {
      const trimmedEmail = email.trim().toLowerCase()
      console.log('[Team Login] Attempting sign-in for:', trimmedEmail)

      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      console.log('[Team Login] Sign-in response:', {
        hasSession: !!data?.session,
        hasUser: !!data?.user,
        error: error?.message,
      })

      if (error) {
        console.error('[Team Login] Supabase sign-in error:', error)
        throw error
      }

      if (!data.session || !data.user) {
        throw new Error('Login failed: no session returned from Supabase.')
      }

      console.log('[Team Login] Fetching profile and membership...')

      if (data.session) {
        // Get profile (may have legacy owner flag) and membership together
        const [
          { data: profile, error: profileError },
          { data: memberships, error: membershipError },
        ] = await Promise.all([
          supabase
            .from('profiles')
            .select('account_type, full_name')
            .eq('id', data.user.id)
            .single(),
          supabase
            .from('organization_members')
            .select('role, organization_id, display_name, status')
            .eq('user_id', data.user.id)
            .eq('status', 'active')
            .order('created_at', { ascending: true })
            .limit(1),
        ])

        console.log('[Team Login] Data fetched:', {
          profile: profile?.account_type,
          profileError: profileError?.message,
          membershipCount: memberships?.length,
          membershipError: membershipError?.message,
        })

        if (profileError || !profile) {
          console.error('[Team Login] Profile check failed')
          await supabase.auth.signOut()
          throw new Error('Unable to verify account type. Please contact support.')
        }

        if (membershipError) {
          console.error('[Team Login] Membership error:', membershipError)
          await supabase.auth.signOut()
          throw new Error('Database error: ' + membershipError.message)
        }

        if (!memberships || memberships.length === 0) {
          console.error('[Team Login] No membership found')
          await supabase.auth.signOut()
          throw new Error(
            'Your account is not associated with any active organization. Please contact your administrator to add you as a team member.'
          )
        }

        const membership = memberships[0]
        console.log('[Team Login] Membership found:', {
          role: membership.role,
          status: membership.status,
          displayName: membership.display_name,
        })

        if (membership.status !== 'active') {
          console.error('[Team Login] Membership inactive')
          await supabase.auth.signOut()
          throw new Error('Your account is inactive. Please contact your organization owner.')
        }

        // Determine actual role: trust profile.account_type when explicitly set to team_member
        let actualRole: string
        if (profile.account_type === 'team_member') {
          // Profile explicitly says team_member, trust it
          actualRole = 'team_member'
          console.log('[Team Login] Profile says team_member, using that role')

          // Fix inconsistent membership role if needed
          if (membership.role === 'owner') {
            console.log(
              '[Team Login] Fixing inconsistent membership role from owner to team member'
            )
            await supabase
              .from('organization_members')
              .update({ role: 'member' })
              .eq('user_id', data.user.id)
              .eq('organization_id', membership.organization_id)
          }
        } else {
          // Use membership role
          actualRole = membership.role === 'owner' ? 'owner' : 'team_member'
          console.log('[Team Login] Using membership role:', actualRole)
        }

        if (actualRole === 'owner') {
          console.warn('[Team Login] Owner attempted team login')
          await supabase.auth.signOut()
          toast.error('Agency owners must use the main login page')
          setTimeout(() => router.push('/login'), 1500)
          return
        }

        console.log('[Team Login] User is team member, proceeding...')

        // Ensure profile is marked as team_member
        if (profile.account_type !== 'team_member') {
          console.log('[Team Login] Updating profile account_type to team_member')
          await supabase
            .from('profiles')
            .update({ account_type: 'team_member' })
            .eq('id', data.user.id)
        }

        console.log('[Team Login] Persisting session...')

        // Persist both client and httpOnly cookies; fail fast if cookie API fails
        try {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          })

          console.log('[Team Login] Client session set, verifying...')

          // Verify session was set
          const {
            data: { session: verifySession },
          } = await supabase.auth.getSession()
          console.log('[Team Login] Session verification:', {
            hasSession: !!verifySession,
            userId: verifySession?.user?.id,
          })

          console.log('[Team Login] Calling cookie API...')

          const cookieRes = await fetch('/api/auth/set-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_at: data.session.expires_at,
              expires_in: data.session.expires_in ?? 3600,
            }),
          })

          console.log('[Team Login] Cookie API response:', {
            ok: cookieRes.ok,
            status: cookieRes.status,
          })

          if (!cookieRes.ok) {
            throw new Error('Failed to persist session cookies. Please try again.')
          }

          console.log('[Team Login] Session persisted successfully')
        } catch (cookieError) {
          console.error('[Team Login] Failed to persist session:', cookieError)
          throw new Error('Login succeeded but session could not be saved. Please try again.')
        }

        console.log('[Team Login] Redirecting to /teammate/dashboard...')
        toast.success(`Welcome back, ${membership.display_name || 'Team Member'}!`)

        // Use window.location for hard navigation to ensure middleware runs
        window.location.href = '/teammate/dashboard'
      }
    } catch (error: any) {
      console.error('Login error:', error)
      const message = error?.message || 'Failed to login'
      setErrorMessage(message)
      toast.error(message)
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
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
                {errorMessage}
              </div>
            )}

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
