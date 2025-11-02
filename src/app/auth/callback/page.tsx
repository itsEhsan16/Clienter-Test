'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code')
        const errorParam = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        console.log('[Auth Callback] Received:', {
          hasCode: !!code,
          error: errorParam,
          errorDescription,
        })

        if (errorParam) {
          console.error('[Auth Callback] OAuth error:', errorParam, errorDescription)
          router.push(`/login?error=${encodeURIComponent(errorDescription || errorParam)}`)
          return
        }

        if (!code) {
          console.error('[Auth Callback] No code present')
          router.push('/login?error=no_code')
          return
        }

        console.log('[Auth Callback] Exchanging code for session...')
        
        // This will use the code verifier from localStorage automatically
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
          console.error('[Auth Callback] Exchange failed:', exchangeError)
          router.push(
            `/login?error=oauth_failed&details=${encodeURIComponent(exchangeError.message)}`
          )
          return
        }

        if (!data.session) {
          console.error('[Auth Callback] No session after exchange')
          router.push('/login?error=no_session')
          return
        }

        console.log('[Auth Callback] Session created successfully for:', data.session.user.email)
        
        // Set session cookies via API for SSR
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
        } catch (e) {
          console.warn('[Auth Callback] Failed to set server cookies:', e)
        }

        // Redirect to dashboard
        router.push('/dashboard')
        router.refresh()
      } catch (err: any) {
        console.error('[Auth Callback] Unexpected error:', err)
        setError(err?.message || 'An unexpected error occurred')
        setTimeout(() => {
          router.push(`/login?error=${encodeURIComponent(err?.message || 'callback_error')}`)
        }, 2000)
      }
    }

    handleCallback()
  }, [router, searchParams, supabase])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold mb-4">Authentication Failed</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-4" />
        <p className="text-gray-700 font-semibold">Completing sign in...</p>
        <p className="text-sm text-gray-500 mt-2">Please wait while we verify your account</p>
      </div>
    </div>
  )
}
