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
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          // Quick check - just verify if they have membership
          const { data: membership } = await supabase
            .from('organization_members')
            .select('role')
            .eq('user_id', session.user.id)
            .eq('status', 'active')
            .maybeSingle()

          if (membership?.role === 'owner') {
            router.replace('/dashboard')
          } else if (membership) {
            router.replace('/teammate/dashboard')
          }
        }
      } catch (error) {
        console.error('[Team Login] Session check error:', error)
        // Silently fail - user can try to login
      }
    }

    checkExistingSession()
  }, [router])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    console.log('[Team Login] Form submitted')
    setLoading(true)
    setErrorMessage('')

    try {
      const trimmedEmail = email.trim().toLowerCase()
      console.log('[Team Login] Signing in:', trimmedEmail)

      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (error) {
        console.error('[Team Login] Sign-in error:', error)
        throw new Error(error.message || 'Invalid email or password')
      }

      if (!data.session || !data.user) {
        throw new Error('Login failed. Please try again.')
      }

      console.log('[Team Login] Signed in successfully')

      // Fetch membership to verify team member access
      const { data: membership, error: membershipError } = await supabase
        .from('organization_members')
        .select('role, display_name, status')
        .eq('user_id', data.user.id)
        .eq('status', 'active')
        .maybeSingle()

      if (membershipError) {
        console.error('[Team Login] Membership error:', membershipError)
        await supabase.auth.signOut()
        throw new Error('Unable to verify membership. Please contact support.')
      }

      if (!membership) {
        await supabase.auth.signOut()
        throw new Error('No active membership found. Please contact your organization owner.')
      }

      // Check if user is trying to use team login as owner
      if (membership.role === 'owner') {
        await supabase.auth.signOut()
        toast.error('Agency owners must use the main login page')
        setTimeout(() => router.push('/login'), 1500)
        return
      }

      console.log('[Team Login] Team member verified')

      // Set server-side session cookies with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // 8 second timeout

      try {
        const cookieRes = await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            expires_at: data.session.expires_at,
            expires_in: data.session.expires_in ?? 3600,
          }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!cookieRes.ok) {
          throw new Error('Failed to set session')
        }

        console.log('[Team Login] Session set successfully')
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          throw new Error('Login is taking too long. Please check your connection and try again.')
        }
        throw new Error('Failed to establish session. Please try again.')
      }

      // Success - redirect to team dashboard
      toast.success(`Welcome back, ${membership.display_name || 'Team Member'}!`)
      console.log('[Team Login] Redirecting to team dashboard')

      // Hard redirect to ensure middleware processes the session
      window.location.href = '/teammate/dashboard'
    } catch (error: any) {
      console.error('[Team Login] Error:', error)
      const message = error?.message || 'Login failed. Please try again.'
      setErrorMessage(message)
      toast.error(message)
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
