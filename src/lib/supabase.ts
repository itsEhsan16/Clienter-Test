import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Environment variables - these get replaced at build time by Next.js
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create the Supabase client as a module-level singleton
// This ensures env vars are injected at build time, not runtime
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Enable auto token refresh to maintain session in production
    autoRefreshToken: true,
    // Disable automatic session detection in URL (we handle OAuth callback manually)
    detectSessionInUrl: false,
    // Keep session persisted in storage
    persistSession: true,
    // Use localStorage for browser-side persistence
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  cookies: {
    get(name: string) {
      if (typeof document === 'undefined') return undefined
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
      return undefined
    },
    set(name: string, value: string, options: any) {
      if (typeof document === 'undefined') return
      let cookie = `${name}=${value}`
      if (options?.maxAge) cookie += `; max-age=${options.maxAge}`
      cookie += `; path=/`
      if (options?.sameSite) cookie += `; samesite=${options.sameSite}`
      if (options?.secure) cookie += '; secure'
      document.cookie = cookie
    },
    remove(name: string, options: any) {
      if (typeof document === 'undefined') return
      this.set(name, '', { ...options, maxAge: 0 })
    },
  },
})

// For backward compatibility - return the singleton instance
export const createBrowserClient_LEGACY = () => supabase
