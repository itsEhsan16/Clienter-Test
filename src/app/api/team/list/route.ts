import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// GET /api/team/list - Get all team members in organization for selection
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

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .single()

    if (!orgMember) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
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

    // Get all active team members in organization (excluding owner)
    const { data: members, error } = await supabaseAdmin
      .from('organization_members')
      .select(
        `
        user_id,
        role,
        profiles (
          id,
          email,
          full_name
        )
      `
      )
      .eq('organization_id', orgMember.organization_id)
      .eq('status', 'active')
      .neq('role', 'owner')

    if (error) {
      console.error('[Team List API] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Format response
    const teamMembers = (members || []).map((m: any) => ({
      id: m.user_id,
      email: m.profiles?.email,
      full_name: m.profiles?.full_name,
      role: m.role,
    }))

    return NextResponse.json({ teamMembers }, { status: 200 })
  } catch (error: any) {
    console.error('[Team List API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
