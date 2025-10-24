'use client'

import { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react'
import { User, type AuthChangeEvent, type Session } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
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
      const client = createClientComponentClient()
      return client
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize Supabase')
      return null
    }
  })

  const fetchProfile = async (userId: string) => {
    if (!supabase) return

    // Check cache first
    const cached = profileCacheRef.current.get(userId)
    if (cached) {
      setProfile(cached)
      return
    }

    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()

      if (error) {
        if (
          typeof error.message === 'string' &&
          error.message.includes("Could not find the table 'public.profiles'")
        ) {
          console.warn('[Auth] profiles table missing. Did you run supabase/schema.sql?')
        }
        setProfile(null)
        return
      }

      if (data) {
        const profileData = data as Profile
        profileCacheRef.current.set(userId, profileData)
        setProfile(profileData)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
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

    const initAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        }
      } catch (error) {
        console.error('[Auth] Init error:', error)
      } finally {
        setLoading(false)
        initializingRef.current = false
      }
    }

    initAuth()

    // Reduced timeout for faster failure recovery
    const timeout = setTimeout(() => {
      if (loading) {
        setLoading(false)
        initializingRef.current = false
      }
    }, 2000)

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        await fetchProfile(session.user.id)
      } else {
        setProfile(null)
        profileCacheRef.current.clear()
      }

      if (loading) {
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
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
