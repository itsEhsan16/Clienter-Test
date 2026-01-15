'use client'

import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { User, type AuthChangeEvent, type Session } from '@supabase/supabase-js'
import { supabase as supabaseClient } from '@/lib/supabase'
import { Profile, MemberRole } from '@/types/database'
import { getOrgMembership, type OrgMembership } from '@/lib/rbac-helpers'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  organization: OrgMembership | null
  loading: boolean
  profileLoading: boolean
  profileError: string | null
  supabase: any
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshOrganization: () => Promise<void>
  retryProfileFetch: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  organization: null,
  loading: true,
  profileLoading: false,
  profileError: null,
  supabase: null,
  signOut: async () => {},
  refreshProfile: async () => {},
  refreshOrganization: async () => {},
  retryProfileFetch: async () => {},
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
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const initRef = useRef(false)
  const userIdRef = useRef<string | null>(null)
  const supabase = supabaseClient

  // Simple profile fetch - no blocking, no complex retry
  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase || !userId) return

    setProfileLoading(true)
    setProfileError(null)

    try {
      console.log('[Auth] Fetching profile for:', userId)
      
      // Simple query with reasonable timeout using Promise.race
      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error('Profile query timed out') }), 10000)
      )

      const queryPromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      const { data, error } = await Promise.race([queryPromise, timeoutPromise])

      if (error) {
        console.error('[Auth] Profile fetch error:', error.message)
        setProfileError(error.message)
        setProfile(null)
      } else if (data) {
        console.log('[Auth] Profile loaded:', data.full_name || data.email)
        setProfile(data as Profile)
        setProfileError(null)
      } else {
        console.log('[Auth] No profile found, creating one...')
        // Try to create profile
        const { data: { session } } = await supabase.auth.getSession()
        const email = session?.user?.email
        const name = session?.user?.user_metadata?.full_name || 
                     session?.user?.user_metadata?.name || 
                     email?.split('@')[0]

        if (email) {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: userId,
              email,
              full_name: name,
              currency: 'INR',
              timezone: 'UTC',
              default_reminder_minutes: 15,
              account_type: 'owner',
            })
            .select()
            .single()

          if (createError) {
            console.error('[Auth] Profile creation error:', createError.message)
            setProfileError('Failed to create profile')
          } else if (newProfile) {
            console.log('[Auth] Profile created:', newProfile.full_name)
            setProfile(newProfile as Profile)
            setProfileError(null)
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.error('[Auth] Profile fetch timed out')
        setProfileError('Profile loading timed out. Click retry.')
      } else {
        console.error('[Auth] Profile fetch exception:', err)
        setProfileError(err?.message || 'Failed to load profile')
      }
    } finally {
      setProfileLoading(false)
    }
  }, [supabase])

  // Simple organization fetch
  const fetchOrganization = useCallback(async (userId: string) => {
    if (!userId) return

    try {
      console.log('[Auth] Fetching organization for:', userId)
      const org = await getOrgMembership(userId)
      if (org) {
        console.log('[Auth] Organization loaded:', org.organizationName)
        setOrganization(org)
      } else {
        console.log('[Auth] No organization found')
        setOrganization(null)
      }
    } catch (err) {
      console.error('[Auth] Organization fetch error:', err)
      setOrganization(null)
    }
  }, [])

  // Retry function
  const retryProfileFetch = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id)
      await fetchOrganization(user.id)
    }
  }, [user?.id, fetchProfile, fetchOrganization])

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id)
    }
  }, [user?.id, fetchProfile])

  const refreshOrganization = useCallback(async () => {
    if (user?.id) {
      await fetchOrganization(user.id)
    }
  }, [user?.id, fetchOrganization])

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut()
    }
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
    } catch (e) {}
    
    userIdRef.current = null
    setUser(null)
    setProfile(null)
    setOrganization(null)
  }, [supabase])

  // Main auth initialization - SIMPLE and NON-BLOCKING
  useEffect(() => {
    if (!supabase || initRef.current) return
    initRef.current = true

    const initAuth = async () => {
      console.log('[Auth] Initializing...')

      try {
        // Get session - this is fast
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error) {
          console.error('[Auth] Session error:', error)
          setLoading(false)
          return
        }

        if (session?.user) {
          console.log('[Auth] Session found:', session.user.email)
          userIdRef.current = session.user.id
          setUser(session.user)
          
          // Mark auth as ready IMMEDIATELY - don't wait for profile
          setLoading(false)

          // Fetch profile and org in background (non-blocking)
          fetchProfile(session.user.id)
          fetchOrganization(session.user.id)
        } else {
          console.log('[Auth] No session found')
          setLoading(false)
        }
      } catch (err) {
        console.error('[Auth] Init error:', err)
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        console.log('[Auth] Auth state changed:', event, session?.user?.email)

        if (event === 'SIGNED_IN' && session?.user) {
          if (userIdRef.current !== session.user.id) {
            userIdRef.current = session.user.id
            setUser(session.user)
            setLoading(false)
            
            // Background fetch
            fetchProfile(session.user.id)
            fetchOrganization(session.user.id)
          }
        } else if (event === 'SIGNED_OUT') {
          userIdRef.current = null
          setUser(null)
          setProfile(null)
          setOrganization(null)
          setLoading(false)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Just update user object if needed
          setUser(session.user)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile, fetchOrganization])

  const contextValue = useMemo(
    () => ({
      user,
      profile,
      organization,
      loading,
      profileLoading,
      profileError,
      supabase,
      signOut,
      refreshProfile,
      refreshOrganization,
      retryProfileFetch,
    }),
    [user, profile, organization, loading, profileLoading, profileError, supabase, signOut, refreshProfile, refreshOrganization, retryProfileFetch]
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}
