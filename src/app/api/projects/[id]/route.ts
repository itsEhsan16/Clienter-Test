import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// GET /api/projects/[id] - Fetch single project with details
export async function GET(request: Request, { params }: { params: { id: string } }) {
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

    // Verify organization membership
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', session.user.id)
      .single()

    if (!orgMember) {
      return NextResponse.json({ error: 'User not part of any organization' }, { status: 403 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Project Details API] Missing SUPABASE_SERVICE_ROLE_KEY')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    console.log('[Project Details API] Creating admin client for project:', params.id)
    console.log(
      '[Project Details API] Service role key present:',
      !!process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
      }
    )

    // Fetch project - service role bypasses RLS
    const { data: project, error } = await supabaseAdmin
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
      .eq('id', params.id)
      .single()

    if (error) {
      console.error('[Project Details API] Error fetching project:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Fetch team members separately to avoid RLS issues
    const { data: teamMembers, error: teamError } = await supabaseAdmin
      .from('project_team_members')
      .select(
        `
        *,
        profiles (
          full_name,
          email
        )
      `
      )
      .eq('project_id', params.id)

    if (teamError) {
      console.error('[Project Details API] Error fetching team members:', teamError)
      // Don't fail the whole request, just set empty array
      project.project_team_members = []
    } else {
      project.project_team_members = teamMembers || []
    }

    // Authorization: ensure project belongs to user's org OR user is assigned to it
    if (
      project.organization_id !== orgMember.organization_id &&
      !(project.project_team_members || []).some((m: any) => m.team_member_id === session.user.id)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ project }, { status: 200 })
  } catch (error: any) {
    console.error('Error in GET /api/projects/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/projects/[id] - Update project
export async function PUT(request: Request, { params }: { params: { id: string } }) {
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

    // Verify organization membership
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', session.user.id)
      .single()

    if (!orgMember) {
      return NextResponse.json({ error: 'User not part of any organization' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, status, budget, order, deadline } = body

    // Validate name only when it is being updated
    if (name !== undefined && name.trim() === '') {
      return NextResponse.json({ error: 'Project name cannot be empty' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['new', 'ongoing', 'completed']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
    }

    if (deadline !== undefined && deadline !== null && Number.isNaN(Date.parse(deadline))) {
      return NextResponse.json({ error: 'Invalid deadline value' }, { status: 400 })
    }

    // Use admin client to bypass RLS
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Project Update API] Missing SUPABASE_SERVICE_ROLE_KEY')
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

    // Verify project exists and user has permission
    const { data: existingProject } = await supabaseAdmin
      .from('projects')
      .select('id, organization_id')
      .eq('id', params.id)
      .single()

    if (!existingProject) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (existingProject.organization_id !== orgMember.organization_id) {
      return NextResponse.json({ error: 'Not authorized to update this project' }, { status: 403 })
    }

    // Build update object - only include fields that exist in database
    const updateData: any = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (status !== undefined) updateData.status = status
    if (budget !== undefined) updateData.budget = budget ? parseFloat(budget) : null
    if (order !== undefined) updateData.order = order
    if (deadline !== undefined) updateData.deadline = deadline || null

    // Update project using admin client
    const { data: project, error } = await supabaseAdmin
      .from('projects')
      .update(updateData)
      .eq('id', params.id)
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
      console.error('[Project Update API] Error updating project:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ project }, { status: 200 })
  } catch (error: any) {
    console.error('[Project Update API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/projects/[id] - Delete project
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
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

    // Delete project (cascade will handle related records)
    const { error } = await supabase.from('projects').delete().eq('id', params.id)

    if (error) {
      console.error('Error deleting project:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Project deleted successfully' }, { status: 200 })
  } catch (error: any) {
    console.error('Error in DELETE /api/projects/[id]:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
