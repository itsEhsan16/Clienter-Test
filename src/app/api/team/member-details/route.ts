import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * API Route: Get Team Member Details
 * Returns member info, stats, and credentials
 */
export async function GET(req: NextRequest) {
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

    // Get member ID from query params
    const { searchParams } = new URL(req.url)
    const memberId = searchParams.get('memberId')

    if (!memberId) {
      return NextResponse.json({ error: 'Member ID required' }, { status: 400 })
    }

    // Get current user's organization
    const { data: currentUserMember } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', session.user.id)
      .single()

    if (!currentUserMember) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Get the team member details
    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .select(
        `
        *,
        profile:user_id (
          id,
          email,
          full_name,
          created_at
        )
      `
      )
      .eq('id', memberId)
      .eq('organization_id', currentUserMember.organization_id)
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Get member stats
    // Total tasks
    const { count: totalTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', member.user_id)

    // Completed tasks
    const { count: completedTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', member.user_id)
      .eq('status', 'completed')

    // Active tasks
    const { count: activeTasks } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', member.user_id)
      .in('status', ['assigned', 'in_progress'])

    // Projects (from project_team_members if exists)
    let totalProjects = 0
    try {
      const { count: projectCount } = await supabase
        .from('project_team_members')
        .select('*', { count: 'exact', head: true })
        .eq('team_member_id', member.user_id)
        .eq('status', 'active')
      totalProjects = projectCount || 0
    } catch (error) {
      // Table might not exist yet
      totalProjects = 0
    }

    // Total earnings and payment history from expenses (owner's payments to this member)
    const { data: expensePayments, error: paymentsError } = await supabase
      .from('expenses')
      .select(
        `
        id,
        title,
        amount,
        total_amount,
        paid_amount,
        date,
        project_id,
        expense_type,
        project:projects!project_id(
          id,
          name
        )
      `
      )
      .eq('team_member_id', member.user_id)
      .eq('organization_id', currentUserMember.organization_id)
      .eq('expense_type', 'team')
      .order('date', { ascending: false })

    if (paymentsError) {
      console.error('[Member Details API] Payments error:', paymentsError)
    }

    const payments = (expensePayments || []).map((row: any) => ({
      id: row.id,
      amount: Number(row.paid_amount ?? row.total_amount ?? row.amount ?? 0),
      payment_type: 'expense',
      payment_date: row.date,
      expense_id: row.id,
      title: row.title || 'Payment',
      project_id: row.project?.id || row.project_id,
      project_name: row.project?.name || 'Unknown project',
    }))

    const totalEarnings = payments.reduce((sum, payment) => sum + payment.amount, 0)

    const stats = {
      totalTasks: totalTasks || 0,
      completedTasks: completedTasks || 0,
      activeTasks: activeTasks || 0,
      totalProjects: totalProjects || 0,
      totalEarnings,
    }

    return NextResponse.json({
      member,
      stats,
      payments,
    })
  } catch (error: any) {
    console.error('[Member Details API] Error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
