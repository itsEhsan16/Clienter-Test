import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Cache for session checks (in-memory, per request cycle)
const sessionCache = new WeakMap<NextRequest, boolean>()

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Fast path: Don't interfere with callbacks, API routes, or static files
  if (
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico')
  ) {
    console.log('[Middleware] Skipping auth check for:', pathname)
    return NextResponse.next()
  }

  // Define protected and auth paths
  const isProtectedPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/clients') ||
    pathname.startsWith('/meetings') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/team') ||
    pathname.startsWith('/tasks') ||
    pathname.startsWith('/expenses')

  const isAuthPage = pathname === '/login' || pathname === '/signup'

  // Check cache first
  let hasSession = sessionCache.get(req)

  if (hasSession === undefined) {
    // Only create Supabase client if needed
    const res = NextResponse.next()
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
              res.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      hasSession = !!session
      sessionCache.set(req, hasSession)
    } catch (error) {
      console.error('[Middleware] Session check error:', error)
      hasSession = false
    }
  }

  // Redirect logic
  if (isProtectedPath && !hasSession) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (isAuthPage && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
