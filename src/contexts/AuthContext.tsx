'use client'

import { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react'
import { User, type AuthChangeEvent, type Session } from '@supabase/supabase-js'
import { createBrowserClient } from '@/lib/supabase'
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
  const initializingRef = useRef(false)
  const profileCacheRef = useRef<Map<string, Profile>>(new Map())

  const [supabase] = useState(() => {
    try {
      const client = createBrowserClient()
      console.log('[AuthContext] Supabase client initialized')
      return client
    } catch (err) {
      console.error('[AuthContext] Failed to initialize Supabase:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize Supabase')
      return null
    }
  })

  // Helper to ensure profile exists for user
  const ensureProfile = async (userId: string, email: string) => {
    if (!supabase) return false
    try {
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle() // Use maybeSingle instead of single to avoid error on 0 rows

      console.log('[Auth] ensureProfile: fetch result', { userId, existingProfile, fetchError })

      if (fetchError) {
        console.error('[Auth] ensureProfile: error fetching profile', fetchError)
        return false
      }

      if (!existingProfile) {
        console.log('[Auth] ensureProfile: Creating new profile for user', userId)
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([{ id: userId, email, full_name: '', currency: 'INR' }])
        if (insertError) {
          console.error('[Auth] ensureProfile: error inserting profile', insertError)
          return false
        } else {
          console.log('[Auth] ensureProfile: created missing profile for user', userId)
          return true
        }
      } else {
        // Profile exists
        console.log('[Auth] ensureProfile: Profile already exists', existingProfile.id)
        // Check for ID mismatch
        if (existingProfile.id !== userId) {
          console.error('[Auth] Profile ID mismatch:', {
            authUserId: userId,
            profileId: existingProfile.id,
          })
        }
        return true
      }
    } catch (err) {
      console.error('[Auth] ensureProfile: error', err)
      return false
    }
  }

  const fetchProfile = async (userId: string) => {
    if (!supabase) return
    console.log('[Auth] Fetching profile for userId:', userId)

    // Check cache first
    const cached = profileCacheRef.current.get(userId)
    if (cached) {
      console.log('[Auth] Profile found in cache:', cached)
      setProfile(cached)
      return
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle() // Use maybeSingle to avoid error on 0 rows

      console.log('[Auth] Supabase profile fetch result:', { data, error })

      if (error) {
        // Don't set error state for profile fetch failures - just log them
        if (
          typeof error.message === 'string' &&
          error.message.includes("Could not find the table 'public.profiles'")
        ) {
          console.warn('[Auth] profiles table missing. Did you run supabase/schema.sql?')
        } else {
          console.error('[Auth] Error fetching profile:', error)
        }
        setProfile(null)
        return
      }

      if (data) {
        const profileData = data as Profile
        profileCacheRef.current.set(userId, profileData)
        setProfile(profileData)
        // Check for ID mismatch
        if (profileData.id !== userId) {
          console.error('[Auth] Profile ID mismatch:', {
            authUserId: userId,
            profileId: profileData.id,
          })
        }
      } else {
        console.warn('[Auth] No profile data found for user:', userId)
        setProfile(null)
      }
    } catch (error) {
      console.error('[Auth] Error fetching profile:', error)
      setProfile(null)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      // Clear cache for this user
      profileCacheRef.current.delete(user.id)
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    if (!supabase || initializingRef.current) {
      if (!supabase) setLoading(false)
      return
    }

    initializingRef.current = true

    const restoreSession = async () => {
      try {
        console.log('[Auth] Starting session restoration...')

        // First, wait a moment for any pending auth state changes from callback
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Try to restore session from cookies
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        console.log(
          '[Auth] restoreSession: session exists?',
          !!session,
          'userId:',
          session?.user?.id,
          'error:',
          sessionError
        )

        if (sessionError) {
          console.error('[Auth] Session restoration failed:', sessionError)
          setUser(null)
          setProfile(null)
          profileCacheRef.current.clear()
          setLoading(false)
          initializingRef.current = false
          return
        }

        if (session?.user) {
          console.log('[Auth] Session found for user:', session.user.email)
          setUser(session.user)
          const profileEnsured = await ensureProfile(session.user.id, session.user.email || '')
          if (profileEnsured) {
            // Small delay to let database trigger complete if profile was just created
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
          await fetchProfile(session.user.id)
        } else {
          console.log('[Auth] No session found during restoration')
          setUser(null)
          setProfile(null)
          profileCacheRef.current.clear()
        }
      } catch (error) {
        console.error('[Auth] restoreSession error:', error)
        setUser(null)
        setProfile(null)
        profileCacheRef.current.clear()
      } finally {
        setLoading(false)
        initializingRef.current = false
      }
    }

    restoreSession()

    // Timeout for faster failure recovery (3 seconds on Vercel)
    const timeoutId = setTimeout(() => {
      if (loading && initializingRef.current) {
        console.warn('[Auth] Session restoration timeout - marking as initialized')
        setLoading(false)
        initializingRef.current = false
      }
    }, 3000)

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
        if (session?.user) {
          console.log('[Auth] User authenticated via state change:', session.user.email)
          setUser(session.user)
          const profileEnsured = await ensureProfile(session.user.id, session.user.email || '')
          if (profileEnsured) {
            // Small delay to let database trigger complete if profile was just created
            await new Promise((resolve) => setTimeout(resolve, 100))
          }
          await fetchProfile(session.user.id)
        } else {
          console.log('[Auth] User logged out via state change')
          setUser(null)
          setProfile(null)
          profileCacheRef.current.clear()
        }
      } catch (err) {
        console.error('[Auth] Error handling auth state change:', err)
      }

      if (loading) {
        setLoading(false)
        initializingRef.current = false
      }
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeoutId)
    }
  }, [supabase])

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
    } catch (e) {
      // no-op
    }
    setUser(null)
    setProfile(null)
    profileCacheRef.current.clear()
  }

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({ user, profile, loading, supabase, signOut, refreshProfile }),
    [user, profile, loading, supabase]
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
