import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// GET /api/projects/[id]/team - Get team members for a project
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

    // Get project to verify ownership
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('organization_id')
      .eq('id', params.id)
      .single()

    if (!project || project.organization_id !== orgMember.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get team members for this project
    const { data: teamMembers, error } = await supabaseAdmin
      .from('project_team_members')
      .select(
        `
        *,
        profiles (
          id,
          email,
          full_name
        )
      `
      )
      .eq('project_id', params.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Project Team API] Error fetching team members:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ teamMembers: teamMembers || [] }, { status: 200 })
  } catch (error: any) {
    console.error('[Project Team API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/projects/[id]/team - Add team member to project
export async function POST(request: Request, { params }: { params: { id: string } }) {
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

    // Verify organization membership
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', session.user.id)
      .single()

    if (!orgMember) {
      return NextResponse.json({ error: 'User not part of any organization' }, { status: 403 })
    }

    const body = await request.json()
    const { team_member_id, allocated_budget, role } = body

    if (!team_member_id) {
      return NextResponse.json({ error: 'Team member ID is required' }, { status: 400 })
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

    // Verify project exists and user has permission
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('id, organization_id')
      .eq('id', params.id)
      .single()

    if (!project || project.organization_id !== orgMember.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify team member is in the same organization
    const { data: memberOrg } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', team_member_id)
      .eq('organization_id', orgMember.organization_id)
      .single()

    if (!memberOrg) {
      return NextResponse.json({ error: 'Team member not found in organization' }, { status: 404 })
    }

    // Check if already assigned
    const { data: existing } = await supabaseAdmin
      .from('project_team_members')
      .select('id')
      .eq('project_id', params.id)
      .eq('team_member_id', team_member_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Team member already assigned to project' },
        { status: 409 }
      )
    }

    // Build insert payload (include optional fields)
    const insertPayload: any = {
      project_id: params.id,
      team_member_id,
      allocated_budget: allocated_budget ? parseFloat(allocated_budget) : null,
      status: 'active',
      total_paid: 0,
    }

    if (role) insertPayload.role = role

    // Try insert; if DB reports missing column(s), remove them and retry once
    let assignment: any = null
    let insertError: any = null

    try {
      const resp = await supabaseAdmin
        .from('project_team_members')
        .insert(insertPayload)
        .select(
          `
        *,
        profiles (
          id,
          email,
          full_name
        )
      `
        )
        .single()

      assignment = resp.data
      insertError = resp.error
    } catch (e: any) {
      insertError = e
    }

    // If insert failed due to missing column (e.g., role), try again without that column
    if (
      insertError &&
      /could not find the|column "\w+" does not exist/i.test(insertError.message || '')
    ) {
      console.warn(
        '[Project Team API] Insert failed due to missing column, retrying without optional fields',
        insertError.message
      )
      // Remove optional fields that might be missing
      delete insertPayload.role
      delete insertPayload.allocated_budget

      try {
        const resp2 = await supabaseAdmin
          .from('project_team_members')
          .insert(insertPayload)
          .select(
            `
        *,
        profiles (
          id,
          email,
          full_name
        )
      `
          )
          .single()

        assignment = resp2.data
        insertError = resp2.error
      } catch (e2: any) {
        insertError = e2
      }
    }

    if (insertError) {
      console.error('[Project Team API] Error adding team member:', insertError)
      // If it's the known schema cache error, return actionable guidance
      const msg = insertError.message || ''
      if (
        /Could not find the 'role' column|could not find the|column "\w+" does not exist/i.test(msg)
      ) {
        return NextResponse.json(
          {
            error:
              "Database schema missing column (e.g., 'role' or 'allocated_budget'). Please run the migration `supabase/migrations/20260111_add_project_team_member_columns.sql` in your Supabase SQL editor and retry.",
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        { error: insertError.message || 'Failed to assign team member' },
        { status: 500 }
      )
    }

    return NextResponse.json({ assignment }, { status: 201 })
  } catch (error: any) {
    console.error('[Project Team API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH /api/projects/[id]/team - Update team member assignment (allocated_budget, role, status)
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

    // Verify organization membership
    const { data: orgMember } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', session.user.id)
      .single()

    if (!orgMember) {
      return NextResponse.json({ error: 'User not part of any organization' }, { status: 403 })
    }

    const body = await request.json()
    const { assignmentId, allocated_budget, role, status } = body

    if (!assignmentId) {
      return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 })
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

    // Verify project ownership
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('organization_id')
      .eq('id', params.id)
      .single()

    if (!project || project.organization_id !== orgMember.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify assignment belongs to project
    const { data: existing } = await supabaseAdmin
      .from('project_team_members')
      .select('id')
      .eq('id', assignmentId)
      .eq('project_id', params.id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Assignment not found for this project' }, { status: 404 })
    }

    const updateData: any = { updated_at: new Date().toISOString() }
    if (allocated_budget !== undefined)
      updateData.allocated_budget = allocated_budget ? parseFloat(allocated_budget) : null
    if (role !== undefined) updateData.role = role || null
    if (status !== undefined) updateData.status = status

    const { data: updated, error } = await supabaseAdmin
      .from('project_team_members')
      .update(updateData)
      .eq('id', assignmentId)
      .select(`*, profiles ( id, email, full_name )`)
      .single()

    if (error) {
      console.error('[Project Team API] Error updating team member:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ assignment: updated }, { status: 200 })
  } catch (error: any) {
    console.error('[Project Team API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/team/[memberId] - Remove team member from project
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const assignmentId = searchParams.get('assignmentId')

    if (!assignmentId) {
      return NextResponse.json({ error: 'Assignment ID is required' }, { status: 400 })
    }

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

    // Verify project ownership
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('organization_id')
      .eq('id', params.id)
      .single()

    if (!project || project.organization_id !== orgMember.organization_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Remove team member
    const { error } = await supabaseAdmin
      .from('project_team_members')
      .delete()
      .eq('id', assignmentId)
      .eq('project_id', params.id)

    if (error) {
      console.error('[Project Team API] Error removing team member:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Team member removed successfully' }, { status: 200 })
  } catch (error: any) {
    console.error('[Project Team API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
