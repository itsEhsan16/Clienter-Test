'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { UserPlus, Loader2, Mail } from 'lucide-react'

import Image from 'next/image'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const router = useRouter()

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (session) {
        router.replace('/dashboard')
      }
    }
    checkSession()
  }, [router, supabase])

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      if (data.user) {
        if (data.user.identities && data.user.identities.length === 0) {
          // User already exists
          setError('An account with this email already exists. Please sign in instead.')
          setLoading(false)
          return
        }

        // Check if email confirmation is required
        if (data.session) {
          // Auto-confirmed (e.g., email confirmation disabled in Supabase)
          console.log('✅ Account created and auto-logged in')
          await fetch('/api/auth/set-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_at: data.session.expires_at,
            }),
          })
          router.push('/dashboard')
          router.refresh()
        } else {
          // Email confirmation required
          setEmailSent(true)
          setLoading(false)
        }
      }
    } catch (err) {
      console.error('Signup error:', err)
      setError('An unexpected error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        setError(error.message)
        setLoading(false)
      }
      // If successful, the browser will redirect to Google
    } catch (err) {
      console.error('Google signup error:', err)
      setError('Failed to initiate Google signup. Please try again.')
      setLoading(false)
    }
  }

  // Show success message if email was sent
  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full mb-6">
              <Mail className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-4">Check Your Email</h1>
            <div className="bg-white rounded-2xl p-8 shadow-2xl">
              <p className="text-gray-700 mb-4">We've sent a confirmation email to:</p>
              <p className="text-lg font-semibold text-orange-600 mb-6">{email}</p>
              <p className="text-gray-600 mb-6">
                Click the confirmation link in the email to activate your account. You'll be
                automatically logged in after confirming.
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-sm text-blue-700">
                  💡 Tip: Check your spam folder if you don't see the email within a few minutes.
                </p>
              </div>
              <div className="mt-6">
                <Link href="/login" className="text-orange-600 hover:text-orange-500 font-medium">
                  Back to Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo/Brand */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 overflow-hidden rounded-md">
              <Image
                src="/logo.png"
                alt="Clienter Logo"
                width={80}
                height={80}
                className="object-contain w-full h-full"
              />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Clienter</h1>
          <p className="text-gray-400">Start managing your freelance business today</p>
        </div>

        {/* Signup Form */}
        <div className="mt-8 bg-white py-8 px-6 shadow-2xl rounded-2xl">
          <form className="space-y-6" onSubmit={handleSignup}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="fullName" className="label">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="input"
                placeholder="John Doe"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••••"
                disabled={loading}
              />
              <p className="mt-2 text-xs text-gray-500">Must be at least 6 characters</p>
            </div>

            <button type="submit" disabled={loading} className="w-full btn-primary justify-center">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create account
                </>
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignup}
              disabled={loading}
              className="mt-4 w-full btn-secondary justify-center"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>
          </div>

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">Already have an account? </span>
            <Link href="/login" className="font-semibold text-orange-600 hover:text-orange-500">
              Sign in
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500">
          Secure authentication powered by Supabase
        </p>
      </div>
    </div>
  )
}
