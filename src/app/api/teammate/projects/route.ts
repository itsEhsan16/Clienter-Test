import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// GET /api/teammate/projects - Get projects assigned to current team member
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
        db: { schema: 'public' },
      }
    )

    // Get projects assigned to this user
    const { data: assignments, error } = await supabaseAdmin
      .from('project_team_members')
      .select(
        `
        *,
        projects (
          id,
          name,
          description,
          status,
          budget,
          total_paid,
          created_at,
          clients (
            name
          )
        )
      `
      )
      .eq('team_member_id', session.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Teammate Projects API] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ projects: assignments || [] }, { status: 200 })
  } catch (error: any) {
    console.error('[Teammate Projects API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
