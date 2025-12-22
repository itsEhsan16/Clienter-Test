'use client'

import { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react'
import { User, type AuthChangeEvent, type Session } from '@supabase/supabase-js'
import { supabase as supabaseClient } from '@/lib/supabase'
import { Profile } from '@/types/database'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  supabase: any
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  supabase: null,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Prevent multiple simultaneous initializations
  const initializingRef = useRef(false)
  const initializedRef = useRef(false)

  // Profile cache
  const profileCacheRef = useRef<Map<string, Profile | number>>(new Map())

  // Track current user ID to prevent unnecessary updates
  const userIdRef = useRef<string | null>(null)

  // Use the module-level supabase client
  const supabase = supabaseClient

  const fetchProfile = async (userId: string) => {
    if (!supabase) return
    console.log('[Auth] Fetching profile for userId:', userId)

    // Check cache first with 5-minute TTL
    const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
    const cached = profileCacheRef.current.get(userId)
    const cacheTime = profileCacheRef.current.get(`${userId}_time`) as number | undefined

    if (cached && cacheTime && Date.now() - cacheTime < CACHE_TTL) {
      console.log('[Auth] Profile found in cache')
      if (typeof cached !== 'number') {
        setProfile(cached as Profile)
      }
      return
    }

    console.log('[Auth] Cache miss or expired, fetching fresh profile')

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('[Auth] Error fetching profile:', error)
        setProfile(null)
        return
      }

      if (data) {
        const profileData = data as Profile
        profileCacheRef.current.set(userId, profileData)
        profileCacheRef.current.set(`${userId}_time`, Date.now())
        setProfile(profileData)
      } else {
        console.warn('[Auth] No profile found for user:', userId)
        setProfile(null)
      }
    } catch (error) {
      console.error('[Auth] Profile fetch exception:', error)
      setProfile(null)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      profileCacheRef.current.delete(user.id)
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Prevent multiple simultaneous initializations
    if (initializingRef.current || initializedRef.current) {
      console.log('[Auth] Skipping initialization - already initialized or in progress')
      return
    }

    initializingRef.current = true

    const restoreSession = async () => {
      console.log('[Auth] Starting session restoration...')

      let attempts = 0
      const maxAttempts = 3
      const timers: Array<number> = []

      const tryOnce = async () => {
        attempts += 1
        try {
          const {
            data: { session },
            error: sessionError,
          } = await supabase.auth.getSession()

          console.log('[Auth] Session check:', {
            hasSession: !!session,
            userId: session?.user?.id,
            accessToken: session?.access_token ? 'present' : 'missing',
            error: sessionError,
            attempt: attempts,
          })

          if (sessionError) {
            console.error('[Auth] Session restoration error on attempt', attempts, sessionError)
          }

          if (session?.user && session.access_token) {
            console.log('[Auth] Session found for user:', session.user.email)
            // Only update if user ID changed to avoid unnecessary re-renders
            if (userIdRef.current !== session.user.id) {
              userIdRef.current = session.user.id
              setUser(session.user)
              await fetchProfile(session.user.id)
            } else {
              console.log('[Auth] Same user, skipping state update')
            }
            // done
            clearTimers()
            finishInit()
            return
          }

          if (attempts < maxAttempts) {
            // Backoff before retrying - short delays to allow cookies to propagate in production
            const delay = attempts * 500 // 500ms, 1000ms, ...
            const id = window.setTimeout(tryOnce, delay)
            timers.push(id)
            console.warn('[Auth] No session detected, retrying in', delay, 'ms')
            return
          }

          // No session after retries
          console.log('[Auth] No session found after retries')
          userIdRef.current = null
          setUser(null)
          setProfile(null)
          profileCacheRef.current.clear()
          finishInit()
        } catch (err) {
          console.error('[Auth] restoreSession error:', err)
          if (attempts < maxAttempts) {
            const id = window.setTimeout(tryOnce, 500)
            timers.push(id)
            return
          }
          userIdRef.current = null
          setUser(null)
          setProfile(null)
          profileCacheRef.current.clear()
          finishInit()
        }
      }

      const clearTimers = () => timers.forEach((t) => clearTimeout(t))

      const finishInit = () => {
        setLoading(false)
        initializedRef.current = true
        initializingRef.current = false
      }

      tryOnce()

      // cleanup function in case the effect unmounts
      return () => clearTimers()
    }

    const cleanupRestore = restoreSession()

    // Timeout for faster failure recovery
    const timeoutId = setTimeout(() => {
      if (loading && initializingRef.current) {
        console.warn('[Auth] Session restoration timeout - marking as initialized')
        setLoading(false)
        initializedRef.current = true
        initializingRef.current = false
      }
    }, 10000)

    // Listen for auth state changes - this is critical for catching session updates
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log(
        '[Auth] onAuthStateChange event:',
        event,
        'has session:',
        !!session,
        'userId:',
        session?.user?.id
      )

      try {
        const prevUserId = userIdRef.current

        // If there's a user in the session
        if (session?.user) {
          // Only update if the user identity actually changed
          if (userIdRef.current !== session.user.id) {
            console.log('[Auth] User identity changed via state change:', session.user.email)
            userIdRef.current = session.user.id
            setUser(session.user)
            await fetchProfile(session.user.id)
          } else {
            // Same user id - ignore to avoid unnecessary re-renders/refetches
            console.log('[Auth] onAuthStateChange: same user id, ignoring')
          }
        } else {
          // Only treat an absent session as a sign-out if the event indicates explicit sign-out
          if (event === 'SIGNED_OUT') {
            console.log('[Auth] User explicitly signed out')
            userIdRef.current = null
            setUser(null)
            setProfile(null)
            profileCacheRef.current.clear()
          } else {
            // For other transient events (token refresh, etc.), avoid clearing user immediately
            console.log('[Auth] Transient auth event without session, ignoring to avoid flash')
          }
        }
      } catch (err) {
        console.error('[Auth] Error handling auth state change:', err)
      }

      if (loading) {
        setLoading(false)
        initializedRef.current = true
        initializingRef.current = false
      }
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeoutId)
    }
  }, [])

  // Manual token refresh without triggering state updates
  useEffect(() => {
    if (!supabase || !user) return

    // Refresh token every 50 minutes (tokens typically last 1 hour)
    const refreshInterval = setInterval(async () => {
      try {
        console.log('[Auth] Manually refreshing token in background...')
        const { data, error } = await supabase.auth.refreshSession()

        if (error) {
          console.error('[Auth] Token refresh error:', error)
          // If refresh fails, user might need to re-authenticate
          if (
            error.message.includes('refresh_token_not_found') ||
            error.message.includes('invalid')
          ) {
            console.warn('[Auth] Invalid token, clearing session')
            userIdRef.current = null
            setUser(null)
            setProfile(null)
            profileCacheRef.current.clear()
          }
        } else if (data.session) {
          console.log('[Auth] Token refreshed successfully')
          // Don't update state - just keep the session alive in storage
        }
      } catch (err) {
        console.error('[Auth] Token refresh exception:', err)
      }
    }, 50 * 60 * 1000) // 50 minutes

    return () => clearInterval(refreshInterval)
  }, [supabase, user?.id])

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
    } catch (e) {
      // no-op
    }
    userIdRef.current = null
    setUser(null)
    setProfile(null)
    profileCacheRef.current.clear()
  }

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ user, profile, loading, supabase, signOut, refreshProfile }),
    [user, profile, loading]
  )

  // Show error if Supabase is not configured
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mb-4">
              <span className="text-6xl">⚠️</span>
            </div>
            <h1 className="text-3xl font-bold text-red-600 mb-4">Supabase Not Configured</h1>
            <p className="text-gray-700 mb-6">{error}</p>
            <div className="bg-gray-50 rounded-lg p-6 text-left">
              <h2 className="font-semibold text-lg mb-3">Quick Setup:</h2>
              <ol className="space-y-2 text-sm text-gray-600">
                <li>
                  1. Create a file named{' '}
                  <code className="bg-gray-200 px-2 py-1 rounded">.env.local</code> in the root
                  directory
                </li>
                <li>2. Add your Supabase credentials:</li>
              </ol>
              <pre className="bg-gray-800 text-green-400 p-4 rounded mt-3 text-sm overflow-x-auto">
                {`NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here`}
              </pre>
              <ol className="space-y-2 text-sm text-gray-600 mt-3" start={3}>
                <li>
                  3. Get your credentials from:{' '}
                  <a
                    href="https://app.supabase.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    https://app.supabase.com
                  </a>
                </li>
                <li>
                  4. Restart the dev server:{' '}
                  <code className="bg-gray-200 px-2 py-1 rounded">npm run dev</code>
                </li>
              </ol>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-800">
                  📖 See <strong>AUTH_README.md</strong> for detailed setup instructions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
