'use client'

import { createContext, useContext, useEffect, useState, useRef, useMemo } from 'react'
import { User, type AuthChangeEvent, type Session } from '@supabase/supabase-js'
import { supabase as supabaseClient } from '@/lib/supabase'
import { Profile, MemberRole } from '@/types/database'
import { getOrgMembership, type OrgMembership } from '@/lib/rbac-helpers'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  organization: OrgMembership | null
  loading: boolean
  supabase: any
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshOrganization: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  organization: null,
  loading: true,
  supabase: null,
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshOrganization: async () => {},
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
  const [organization, setOrganization] = useState<OrgMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Prevent multiple simultaneous initializations
  const initializingRef = useRef(false)
  const initializedRef = useRef(false)

  // Profile cache - separate Maps for data and timestamps
  const profileCacheRef = useRef<Map<string, Profile>>(new Map())
  const cacheTimestampRef = useRef<Map<string, number>>(new Map())

  // Track current user ID to prevent unnecessary updates
  const userIdRef = useRef<string | null>(null)

  // Use the module-level supabase client
  const supabase = supabaseClient

  const fetchProfile = async (userId: string) => {
    if (!supabase) {
      console.error('[Auth] Cannot fetch profile - supabase client is null')
      return
    }
    console.log('[Auth] ========== FETCHPROFILE CALLED ==========')
    console.log('[Auth] Fetching profile for userId:', userId)

    // Check cache first with 5-minute TTL
    const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
    const cached = profileCacheRef.current.get(userId)
    const cacheTime = cacheTimestampRef.current.get(userId)

    if (cached && cacheTime && Date.now() - cacheTime < CACHE_TTL) {
      console.log('[Auth] Profile found in cache:', cached.full_name)
      setProfile(cached)
      return
    }

    console.log('[Auth] Cache miss or expired, fetching fresh profile')

    try {
      console.log('[Auth] Starting Supabase query for profile...')
      const queryStartTime = Date.now()

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Profile query timeout after 8 seconds')), 8000)
      )

      const queryPromise = supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]).catch(
        (timeoutError) => {
          console.error('[Auth] Query timeout or race error:', timeoutError)
          return { data: null, error: timeoutError }
        }
      )

      const queryDuration = Date.now() - queryStartTime
      console.log(`[Auth] Profile query completed in ${queryDuration}ms`)

      if (error) {
        console.error('[Auth] Error fetching profile:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          userId,
        })
        console.error('[Auth] Full error object:', error)

        // Check if it's an RLS policy error
        if (error.message?.includes('row-level security') || error.code === '42501') {
          console.error('[Auth] RLS POLICY ERROR: User cannot read their own profile!')
        }

        // Check if it's a timeout
        if (error.message?.includes('timeout')) {
          console.error('[Auth] TIMEOUT ERROR: Profile query took too long!')
        }

        setProfile(null)
        return
      }

      if (data) {
        console.log('[Auth] Profile data received successfully:', {
          hasFullName: !!data.full_name,
          fullName: data.full_name,
          userId: data.id,
          allFields: Object.keys(data),
        })
        let profileData = data as Profile

        // If profile has no full_name, try to get it from user metadata (OAuth)
        if (!profileData.full_name) {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession()
            const userMetadata = session?.user?.user_metadata
            const nameFromMetadata = userMetadata?.full_name || userMetadata?.name

            if (nameFromMetadata) {
              console.log(
                '[Auth] Updating profile with name from OAuth metadata:',
                nameFromMetadata
              )
              // Update the profile in the database
              const { data: updatedProfile, error: updateError } = await supabase
                .from('profiles')
                .update({ full_name: nameFromMetadata })
                .eq('id', userId)
                .select()
                .single()

              if (!updateError && updatedProfile) {
                profileData = updatedProfile as Profile
                console.log('[Auth] Profile updated with OAuth name:', profileData.full_name)
              }
            }
          } catch (metadataError) {
            console.error('[Auth] Error updating profile from metadata:', metadataError)
          }
        }

        profileCacheRef.current.set(userId, profileData)
        cacheTimestampRef.current.set(userId, Date.now())
        console.log('[Auth] Setting profile state with:', profileData.full_name)
        setProfile(profileData)
        console.log('[Auth] Profile state updated successfully')
      } else {
        console.warn('[Auth] No profile data returned for user:', userId)
        console.log('[Auth] Profile row may not exist in database - attempting to create it...')

        // Attempt to create the profile - get email from session
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession()
          const userEmail = session?.user?.email
          const userMetadata = session?.user?.user_metadata
          // Get name from OAuth metadata, fallback to email prefix
          const fullName = userMetadata?.full_name || userMetadata?.name || userEmail?.split('@')[0]

          if (userEmail) {
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                email: userEmail,
                full_name: fullName,
                currency: 'INR',
                timezone: 'UTC',
                default_reminder_minutes: 15,
              })
              .select()
              .single()

            if (insertError) {
              console.error('[Auth] Failed to create profile:', insertError)
              setProfile(null)
            } else if (newProfile) {
              console.log('[Auth] Profile created successfully:', newProfile)
              const profileData = newProfile as Profile
              profileCacheRef.current.set(userId, profileData)
              cacheTimestampRef.current.set(userId, Date.now())
              setProfile(profileData)
            }
          } else {
            console.error('[Auth] Cannot create profile - no email available')
            setProfile(null)
          }
        } catch (createError) {
          console.error('[Auth] Exception creating profile:', createError)
          setProfile(null)
        }
      }
    } catch (error: any) {
      console.error('[Auth] Profile fetch exception:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        userId,
      })
      console.log('[Auth] Setting profile to null due to exception')
      setProfile(null)
    }
    console.log('[Auth] fetchProfile function completed')
  }

  const refreshProfile = async () => {
    if (user) {
      console.log('[Auth] Refreshing profile for user:', user.id)
      profileCacheRef.current.delete(user.id)
      cacheTimestampRef.current.delete(user.id)
      await fetchProfile(user.id)
    }
  }

  const fetchOrganization = async (userId: string) => {
    console.log('[Auth] Fetching organization membership for userId:', userId)
    try {
      const orgMembership = await getOrgMembership(userId)
      if (orgMembership) {
        console.log(
          '[Auth] Organization membership loaded:',
          orgMembership.organizationName,
          orgMembership.role
        )
        setOrganization(orgMembership)
      } else {
        console.warn('[Auth] No organization membership found for user')
        setOrganization(null)
      }
    } catch (err) {
      console.error('[Auth] Error fetching organization membership:', err)
      setOrganization(null)
    }
  }

  const refreshOrganization = async () => {
    if (user) {
      console.log('[Auth] Refreshing organization for user:', user.id)
      await fetchOrganization(user.id)
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
              console.log('[Auth] Fetching profile during session restoration...')
              try {
                await fetchProfile(session.user.id)
                await fetchOrganization(session.user.id)
                console.log(
                  '[Auth] Profile and organization fetch completed during session restoration'
                )
              } catch (profileError) {
                console.error(
                  '[Auth] Profile/organization fetch failed during session restoration:',
                  profileError
                )
                // Continue anyway - user can still use the app without profile
              }
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
          setOrganization(null)
          profileCacheRef.current.clear()
          cacheTimestampRef.current.clear()
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
          setOrganization(null)
          profileCacheRef.current.clear()
          cacheTimestampRef.current.clear()
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
            console.log('[Auth] Calling fetchProfile from onAuthStateChange...')
            await fetchProfile(session.user.id)
            await fetchOrganization(session.user.id)
            console.log(
              '[Auth] fetchProfile and fetchOrganization call completed from onAuthStateChange'
            )
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
            setOrganization(null)
            profileCacheRef.current.clear()
            cacheTimestampRef.current.clear()
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
            setOrganization(null)
            profileCacheRef.current.clear()
            cacheTimestampRef.current.clear()
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
    setOrganization(null)
    profileCacheRef.current.clear()
    cacheTimestampRef.current.clear()
  }

  // Debug effect to track profile changes
  useEffect(() => {
    console.log('[Auth] Profile state changed:', {
      hasProfile: !!profile,
      fullName: profile?.full_name,
      profileId: profile?.id,
    })
    console.table({
      'Profile Loaded': !!profile,
      'Profile Name': profile?.full_name || 'N/A',
      'Profile Email': profile?.email || 'N/A',
    })
  }, [profile])

  // Debug effect to track user changes
  useEffect(() => {
    console.log('[Auth] User state changed:', {
      hasUser: !!user,
      email: user?.email,
      userId: user?.id,
    })
    console.table({
      'User Loaded': !!user,
      'User Email': user?.email || 'N/A',
      'User ID': user?.id || 'N/A',
    })
  }, [user])

  // Debug effect to track loading state
  useEffect(() => {
    console.log('[Auth] Loading state changed:', loading)
    console.table({
      'Auth Loading': loading,
      'Has User': !!user,
      'Has Profile': !!profile,
      'App Ready': !loading && !!user,
    })
  }, [loading, user, profile])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      user,
      profile,
      organization,
      loading,
      supabase,
      signOut,
      refreshProfile,
      refreshOrganization,
    }),
    [user, profile, organization, loading]
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
