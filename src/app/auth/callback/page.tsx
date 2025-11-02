'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[Auth Callback] Starting OAuth callback handling...')
        console.log('[Auth Callback] Current URL:', window.location.href)

        const supabase = createBrowserClient()

        // The @supabase/ssr browser client automatically handles the code exchange
        // and uses the code_verifier from cookies
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error('[Auth Callback] Error getting session:', sessionError)
          setError(sessionError.message)
          setTimeout(() => {
            router.push(
              '/login?error=oauth_failed&details=' + encodeURIComponent(sessionError.message)
            )
          }, 2000)
          return
        }

        if (!session) {
          console.error('[Auth Callback] No session after callback')
          setError('No session created')
          setTimeout(() => {
            router.push('/login?error=no_session')
          }, 2000)
          return
        }

        console.log('[Auth Callback] Session created successfully for user:', session.user.email)

        // Redirect to dashboard
        router.push('/dashboard')
        router.refresh()
      } catch (e: any) {
        console.error('[Auth Callback] Unexpected error:', e)
        setError(e?.message || 'Unknown error')
        setTimeout(() => {
          router.push('/login?error=unexpected_error')
        }, 2000)
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-900">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl mb-4 animate-pulse">
          <span className="text-white font-bold text-2xl">C</span>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {error ? 'Authentication Failed' : 'Signing you in...'}
        </h1>
        {error ? (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 mt-4">
            <p className="text-red-400 text-sm">{error}</p>
            <p className="text-gray-400 text-xs mt-2">Redirecting to login...</p>
          </div>
        ) : (
          <>
            <p className="text-gray-400 mb-8">Please wait while we complete your authentication</p>
            <div className="flex justify-center gap-2">
              <div
                className="w-3 h-3 bg-orange-500 rounded-full animate-bounce"
                style={{ animationDelay: '0ms' }}
              ></div>
              <div
                className="w-3 h-3 bg-orange-500 rounded-full animate-bounce"
                style={{ animationDelay: '150ms' }}
              ></div>
              <div
                className="w-3 h-3 bg-orange-500 rounded-full animate-bounce"
                style={{ animationDelay: '300ms' }}
              ></div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
