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

    console.log('[Teammate Projects API] Fetching projects for user:', session.user.id)

    // Get projects assigned to this user with expenses/payments data
    const { data: assignments, error } = await supabaseAdmin
      .from('project_team_members')
      .select(
        `
        id,
        project_id,
        team_member_id,
        allocated_budget,
        status,
        assigned_at,
        projects (
          id,
          name,
          description,
          status,
          budget,
          created_at,
          clients (
            name
          )
        )
      `
      )
      .eq('team_member_id', session.user.id)
      // use assigned_at (exists) instead of created_at to avoid column errors
      .order('assigned_at', { ascending: false })

    if (error) {
      console.error('[Teammate Projects API] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!assignments || assignments.length === 0) {
      console.log('[Teammate Projects API] No projects found')
      return NextResponse.json({ projects: [] }, { status: 200 })
    }

    // Get expenses/payments for this team member across all their projects
    const { data: expenses, error: expensesError } = await supabaseAdmin
      .from('expenses')
      .select('project_id, project_team_member_id, paid_amount, total_amount')
      .eq('team_member_id', session.user.id)
      .eq('expense_type', 'team')

    if (expensesError) {
      console.error('[Teammate Projects API] Expenses error:', expensesError)
    }

    // Calculate total_paid for each assignment from expenses
    const assignmentsWithPayments = assignments.map((assignment: any) => {
      // Sum up all payments for this specific project assignment. First prefer linking by project_team_member_id,
      // and fall back to project_id for legacy expenses that may not have project_team_member_id populated.
      const projectExpenses = (expenses || []).filter(
        (exp) =>
          exp.project_team_member_id === assignment.id ||
          (exp.project_team_member_id === null && exp.project_id === assignment.project_id)
      )

      const total_paid = projectExpenses.reduce((sum, exp) => sum + (exp.paid_amount || 0), 0)

      console.log('[Teammate Projects API] Assignment:', {
        id: assignment.id,
        project: assignment.projects?.name,
        allocated_budget: assignment.allocated_budget,
        total_paid,
        expense_count: projectExpenses.length,
      })

      return {
        ...assignment,
        // ensure role exists for UI even if column not present in DB
        role: assignment.role ?? null,
        total_paid,
      }
    })

    console.log('[Teammate Projects API] Returning', assignmentsWithPayments.length, 'projects')

    return NextResponse.json({ projects: assignmentsWithPayments || [] }, { status: 200 })
  } catch (error: any) {
    console.error('[Teammate Projects API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
