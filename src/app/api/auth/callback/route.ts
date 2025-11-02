import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')

  console.log('[OAuth Callback] Received request with code:', code ? 'YES' : 'NO')

  try {
    if (!code) {
      console.error('[OAuth] No code present in API callback')
      return NextResponse.redirect(new URL('/login?error=no_code', req.url))
    }

    // Create response first so we can set cookies on it
    const response = NextResponse.redirect(new URL('/dashboard', req.url))

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, {
                ...options,
                path: '/',
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
              })
            })
          },
        },
      }
    )

    console.log('[OAuth] Exchanging code for session...')
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('[OAuth] API code exchange failed:', error.message, error)
      return NextResponse.redirect(
        new URL('/login?error=oauth_failed&details=' + encodeURIComponent(error.message), req.url)
      )
    }

    if (!data.session) {
      console.error('[OAuth] No session returned after code exchange')
      return NextResponse.redirect(new URL('/login?error=no_session', req.url))
    }

    console.log('[OAuth] Session created successfully for user:', data.session.user.email)

    // Return response with cookies already set
    return response
  } catch (e: any) {
    console.error('[OAuth] API callback error:', e?.message || e, e)
    return NextResponse.redirect(
      new URL(
        '/login?error=unexpected_error&details=' + encodeURIComponent(e?.message || 'Unknown'),
        req.url
      )
    )
  }
}
