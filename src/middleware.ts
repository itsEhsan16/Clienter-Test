import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Cache for session checks (in-memory, per request cycle)
const sessionCache = new WeakMap<NextRequest, boolean>()

async function inferRoleFromMembership(
  supabase: ReturnType<typeof createServerClient>,
  userId: string
): Promise<string | null> {
  try {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role, status')
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle()

    if (!membership) return null
    return membership.role === 'owner' ? 'owner' : 'team_member'
  } catch (error) {
    console.error('[Middleware] Failed to infer role from membership:', error)
    return null
  }
}

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
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('id', session.user.id)
          .maybeSingle()

        let accountType = profile?.account_type
        if (accountType !== 'team_member' && accountType !== 'owner') {
          accountType = await inferRoleFromMembership(supabase, session.user.id)
        }

        // Handle legacy profiles marked as owner but membership is team role
        if (accountType === 'owner') {
          const inferred = await inferRoleFromMembership(supabase, session.user.id)
          if (inferred === 'team_member') {
            accountType = 'team_member'
          }
        }

        if (accountType === 'owner') {
          return NextResponse.redirect(new URL('/dashboard', req.url))
        }

        // Default team member (or unknown) away from auth pages
        return NextResponse.redirect(new URL('/teammate/dashboard', req.url))
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

      // Get account_type from profiles (more reliable than organization_members)
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_type')
          .eq('id', session.user.id)
          .maybeSingle()

        userRole = profile?.account_type || null

        if (userRole !== 'team_member' && userRole !== 'owner') {
          userRole = await inferRoleFromMembership(supabase, session.user.id)
        }

        if (userRole === 'owner') {
          const inferred = await inferRoleFromMembership(supabase, session.user.id)
          if (inferred === 'team_member') {
            userRole = 'team_member'
          }
        }

        console.log('[Middleware] Session found:', {
          userId: session.user.id,
          email: session.user.email,
          userRole,
        })
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
  console.log('[Middleware] Protected path check:', {
    pathname,
    hasSession,
    userRole,
    isProtectedPath,
    isTeamMemberPath,
    isOwnerPath,
  })

  if (isProtectedPath && !hasSession) {
    console.log('[Middleware] No session, redirecting to login')
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
    if (userRole === 'team_member' && isOwnerPath) {
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
