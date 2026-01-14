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

// GET /api/projects/[id]/payments - Fetch all payments for a project
export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const {
      data: { session },
    } = await getAuthSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client to bypass RLS
    const supabaseAdmin = createAdminClient()

    // Fetch payments using admin client (bypasses RLS)
    const { data: payments, error } = await supabaseAdmin
      .from('project_payments')
      .select(
        `
        *,
        creator:profiles!created_by (
          full_name,
          email
        )
      `
      )
      .eq('project_id', params.id)
      .order('payment_date', { ascending: false })

    if (error) {
      console.error('[Payments API] Error fetching payments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ payments: payments || [] }, { status: 200 })
  } catch (error: any) {
    console.error('[Payments API] Error in GET:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/projects/[id]/payments - Add a new payment to project
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const {
      data: { session },
    } = await getAuthSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount, payment_date, payment_type = 'regular', notes } = body

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }

    // Use admin client
    const supabaseAdmin = createAdminClient()

    // Create payment
    const { data: payment, error } = await supabaseAdmin
      .from('project_payments')
      .insert({
        project_id: params.id,
        amount: parseFloat(amount),
        payment_date: payment_date || new Date().toISOString().split('T')[0],
        payment_type,
        notes,
        created_by: session.user.id,
      })
      .select(
        `
        *,
        creator:profiles!created_by (
          full_name,
          email
        )
      `
      )
      .single()

    if (error) {
      console.error('[Payments API] Error creating payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update project total_paid
    const { data: totalData } = await supabaseAdmin
      .from('project_payments')
      .select('amount')
      .eq('project_id', params.id)

    const newTotal = (totalData || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

    await supabaseAdmin.from('projects').update({ total_paid: newTotal }).eq('id', params.id)

    return NextResponse.json({ payment }, { status: 201 })
  } catch (error: any) {
    console.error('[Payments API] Error in POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/payments - Delete a payment
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const {
      data: { session },
    } = await getAuthSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get payment_id from URL search params
    const { searchParams } = new URL(request.url)
    const payment_id = searchParams.get('payment_id')

    if (!payment_id) {
      return NextResponse.json({ error: 'payment_id is required' }, { status: 400 })
    }

    // Use admin client
    const supabaseAdmin = createAdminClient()

    // Delete payment
    const { error } = await supabaseAdmin
      .from('project_payments')
      .delete()
      .eq('id', payment_id)
      .eq('project_id', params.id)

    if (error) {
      console.error('[Payments API] Error deleting payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Update project total_paid
    const { data: totalData } = await supabaseAdmin
      .from('project_payments')
      .select('amount')
      .eq('project_id', params.id)

    const newTotal = (totalData || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0)

    await supabaseAdmin.from('projects').update({ total_paid: newTotal }).eq('id', params.id)

    return NextResponse.json({ message: 'Payment deleted successfully' }, { status: 200 })
  } catch (error: any) {
    console.error('[Payments API] Error in DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
