import { createClient } from '@supabase/supabase-js'
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
  console.log(
    '[Supabase Client] Environment:',
    typeof window !== 'undefined' ? 'browser' : 'server'
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

  console.log('[Supabase Client] Creating new client instance')

  // Extract project ref from URL for storage key
  const projectRef = supabaseUrl.split('//')[1].split('.')[0]
  const storageKey = `sb-${projectRef}-auth-token`

  console.log('[Supabase Client] Using storage key:', storageKey)

  // Create client with proper PKCE storage configuration
  supabaseInstance = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Only detect session in URL on the callback page to prevent interference elsewhere
      detectSessionInUrl:
        typeof window !== 'undefined' && window.location.pathname.includes('/auth/callback'),
      flowType: 'pkce',
      // Ensure storage is configured properly - critical for OAuth PKCE flow
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: storageKey,
    },
    global: {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
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
