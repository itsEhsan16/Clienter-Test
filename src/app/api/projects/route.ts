import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// GET /api/projects - Fetch all projects for user's organization(s)
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

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get URL search params for filtering
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const client_id = searchParams.get('client_id')

    // Get user's organization (verify they're part of an org)
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', session.user.id)
      .single()

    if (!orgMember) {
      return NextResponse.json({ error: 'User not part of any organization' }, { status: 403 })
    }

    // Use service-role admin client to avoid RLS recursion when aggregating team members
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Projects API] Missing SUPABASE_SERVICE_ROLE_KEY')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      }
    )

    // Build admin query for projects in this organization
    let projQuery = supabaseAdmin
      .from('projects')
      .select(
        `
        *,
        clients (
          id,
          name,
          phone
        )
      `
      )
      .eq('organization_id', orgMember.organization_id)
      .order('order', { ascending: true })
      .order('created_at', { ascending: false })

    if (status && status !== 'all') {
      projQuery = projQuery.eq('status', status)
    }

    if (client_id) {
      projQuery = projQuery.eq('client_id', client_id)
    }

    const { data: projects, error } = await projQuery

    if (error) {
      console.error('Error fetching projects (admin):', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If there are projects, fetch team member counts for them via admin client
    const projectIds = (projects || []).map((p: any) => p.id)
    let counts: Record<string, number> = {}
    if (projectIds.length > 0) {
      const { data: members, error: memErr } = await supabaseAdmin
        .from('project_team_members')
        .select('project_id')
        .in('project_id', projectIds)

      if (memErr) {
        console.error('Error fetching project team members (admin):', memErr)
        return NextResponse.json({ error: memErr.message }, { status: 500 })
      }

      counts = (members || []).reduce((acc: any, m: any) => {
        acc[m.project_id] = (acc[m.project_id] || 0) + 1
        return acc
      }, {})
    }

    const projectsWithCount = (projects || []).map((project: any) => ({
      ...project,
      team_member_count: counts[project.id] || 0,
    }))

    return NextResponse.json({ projects: projectsWithCount }, { status: 200 })
  } catch (error: any) {
    console.error('Error in GET /api/projects:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/projects - Create a new project
export async function POST(request: Request) {
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

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { client_id, name, description, status = 'new', budget, start_date, deadline } = body

    // Validate required fields
    if (!client_id || !name) {
      return NextResponse.json({ error: 'client_id and name are required' }, { status: 400 })
    }

    // Get user's organization
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', session.user.id)
      .single()

    if (!orgMember) {
      return NextResponse.json({ error: 'User not part of any organization' }, { status: 403 })
    }

    // Get the highest order number for the status
    const { data: maxOrderProject } = await supabase
      .from('projects')
      .select('order')
      .eq('status', status)
      .eq('organization_id', orgMember.organization_id)
      .order('order', { ascending: false })
      .limit(1)
      .single()

    const newOrder = maxOrderProject ? maxOrderProject.order + 1 : 0

    // Create project
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        client_id,
        organization_id: orgMember.organization_id,
        name,
        description,
        status,
        budget: budget ? parseFloat(budget) : null,
        start_date,
        deadline,
        order: newOrder,
        created_by: session.user.id,
      })
      .select(
        `
        *,
        clients (
          id,
          name,
          phone
        )
      `
      )
      .single()

    if (error) {
      console.error('Error creating project:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ project }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/projects:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
