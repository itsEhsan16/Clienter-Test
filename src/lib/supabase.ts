import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Singleton instance
let supabaseInstance: SupabaseClient | null = null

export const createBrowserClient = () => {
  // Return existing instance if available
  if (supabaseInstance) {
    return supabaseInstance
  }

  // Check if environment variables are set
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log('[Supabase Client] Initializing with URL:', supabaseUrl ? 'SET' : 'MISSING')
  console.log(
    '[Supabase Client] Anon Key:',
    supabaseKey ? 'SET (length: ' + supabaseKey.length + ')' : 'MISSING'
  )

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE NOT CONFIGURED!')
    console.error('Please create .env.local file with:')
    console.error('NEXT_PUBLIC_SUPABASE_URL=your-supabase-url')
    console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key')
    throw new Error('Supabase environment variables are not configured. See console for details.')
  }

  if (supabaseUrl.includes('your-project') || supabaseKey.includes('your-')) {
    console.error('❌ SUPABASE CREDENTIALS ARE PLACEHOLDER VALUES!')
    console.error('Please update .env.local with your actual Supabase credentials')
    throw new Error('Please update Supabase credentials in .env.local')
  }

  console.log('[Supabase Client] Creating new browser client with @supabase/ssr')

  // Use @supabase/ssr's createBrowserClient - it handles PKCE properly
  supabaseInstance = createBrowserSupabaseClient(supabaseUrl, supabaseKey, {
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

  console.log('[Supabase Client] Client created successfully')
  return supabaseInstance
}

// Reset the singleton (useful for testing or re-initialization)
export const resetSupabaseClient = () => {
  supabaseInstance = null
}
