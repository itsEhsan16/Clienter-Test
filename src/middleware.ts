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
  const isTeamMemberPath = pathname.startsWith('/teammate')

  const isOwnerPath =
    !isTeamMemberPath &&
    (pathname.startsWith('/dashboard') ||
      pathname.startsWith('/clients') ||
      pathname.startsWith('/meetings') ||
      pathname.startsWith('/settings') ||
      pathname.startsWith('/team') ||
      pathname.startsWith('/expenses') ||
      pathname.startsWith('/tasks') ||
      pathname.startsWith('/projects'))

  const isProtectedPath = isOwnerPath || isTeamMemberPath

  const isAuthPage = pathname === '/login' || pathname === '/signup'
  const isTeamAuthPage = pathname === '/team-login'

  // Allow unauthenticated access to login pages
  // Only check session to redirect if already logged in
  if (isAuthPage || isTeamAuthPage) {
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

      // If already logged in, redirect to appropriate dashboard
      if (session) {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()

        const userRole = membership?.role

        if (userRole === 'owner') {
          return NextResponse.redirect(new URL('/dashboard', req.url))
        } else if (userRole) {
          return NextResponse.redirect(new URL('/teammate/dashboard', req.url))
        }
      }
    } catch (error) {
      console.error('[Middleware] Error checking session for auth page:', error)
    }

    // Allow access to login page
    return res
  }

  // Check cache first
  let hasSession = sessionCache.get(req)
  let userRole: string | null = null

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

      // Get user role if session exists
      if (session) {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle()

        userRole = membership?.role || null
      }
    } catch (error) {
      console.error('[Middleware] Session check error:', error)
      hasSession = false
    }
  }

  // Legacy teammate paths: normalize to /teammate/*
  if (pathname.startsWith('/team-dashboard')) {
    return NextResponse.redirect(new URL('/teammate/dashboard', req.url))
  }

  // Redirect logic
  if (isProtectedPath && !hasSession) {
    // If trying to access team dashboard without session, redirect to team login
    if (isTeamMemberPath) {
      return NextResponse.redirect(new URL('/team-login', req.url))
    }
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Role-based routing when user is logged in
  if (hasSession && userRole) {
    // Owner trying to access teammate area -> redirect to owner dashboard
    if (userRole === 'owner' && isTeamMemberPath) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Team member trying to access owner-only pages -> send to equivalent teammate page
    if (userRole !== 'owner' && isOwnerPath) {
      if (pathname.startsWith('/tasks')) {
        return NextResponse.redirect(new URL('/teammate/tasks', req.url))
      }
      if (pathname.startsWith('/projects')) {
        return NextResponse.redirect(new URL('/teammate/projects', req.url))
      }
      return NextResponse.redirect(new URL('/teammate/dashboard', req.url))
    }
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
