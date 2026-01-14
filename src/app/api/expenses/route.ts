import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Helper to create admin client that bypasses RLS
function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
      db: { schema: 'public' },
    }
  )
}

// Helper to get authenticated session
async function getAuthSession() {
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
  return supabase.auth.getSession()
}

// POST /api/expenses - Create a new expense
export async function POST(request: Request) {
  try {
    // Check authentication
    const {
      data: { session },
    } = await getAuthSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      description,
      amount,
      expense_type,
      date,
      project_id,
      project_team_member_id,
      team_member_id,
      total_amount,
      paid_amount,
      organization_id,
    } = body

    // Validate required fields
    if (!title || !amount || !expense_type || !organization_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (expense_type === 'team' && (!project_id || !team_member_id)) {
      return NextResponse.json(
        { error: 'Team expenses require project_id and team_member_id' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS
    const supabaseAdmin = createAdminClient()

    // Prepare expense data
    const expenseData: any = {
      title,
      description,
      amount: parseFloat(amount),
      expense_type,
      date: date || new Date().toISOString().split('T')[0],
      user_id: session.user.id,
      organization_id,
    }

    // Add team-specific fields
    if (expense_type === 'team') {
      expenseData.project_id = project_id
      expenseData.project_team_member_id = project_team_member_id
      expenseData.team_member_id = team_member_id
      expenseData.total_amount = total_amount ? parseFloat(total_amount) : null
      expenseData.paid_amount = paid_amount ? parseFloat(paid_amount) : 0
      // Don't set payment_status - let DB default and triggers handle it
    }

    // Create expense
    const { data: expense, error: expenseError } = await supabaseAdmin
      .from('expenses')
      .insert(expenseData)
      .select()
      .single()

    if (expenseError) {
      console.error('[Expenses API] Error creating expense:', expenseError)
      return NextResponse.json({ error: expenseError.message }, { status: 500 })
    }

    // If team payment with initial amount, create payment record
    if (expense_type === 'team' && paid_amount && parseFloat(paid_amount) > 0) {
      const { error: paymentError } = await supabaseAdmin.from('team_payment_records').insert({
        expense_id: expense.id,
        created_by: session.user.id,
        amount: parseFloat(paid_amount),
        payment_date: date || new Date().toISOString().split('T')[0],
        payment_type: 'regular',
        notes: 'Initial payment',
      })

      if (paymentError) {
        console.error('[Expenses API] Error creating payment record:', paymentError)
        // Don't fail the whole operation, just log it
      }
    }

    return NextResponse.json({ expense }, { status: 201 })
  } catch (error: any) {
    console.error('[Expenses API] Error in POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
