import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET /api/projects/[id]/payments - Fetch all payments for a project
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

    const { data: payments, error } = await supabase
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
      console.error('Error fetching payments:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ payments }, { status: 200 })
  } catch (error: any) {
    console.error('Error in GET /api/projects/[id]/payments:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/projects/[id]/payments - Add a new payment to project
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

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { amount, payment_date, payment_type = 'regular', notes } = body

    // Validate required fields
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }

    // Verify project exists
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', params.id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create payment (trigger will auto-update project.total_paid)
    const { data: payment, error } = await supabase
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
      console.error('Error creating payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ payment }, { status: 201 })
  } catch (error: any) {
    console.error('Error in POST /api/projects/[id]/payments:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/payments/[payment_id] - Delete a payment
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

    // Get payment_id from URL search params
    const { searchParams } = new URL(request.url)
    const payment_id = searchParams.get('payment_id')

    if (!payment_id) {
      return NextResponse.json({ error: 'payment_id is required' }, { status: 400 })
    }

    // Delete payment (trigger will auto-update project.total_paid)
    const { error } = await supabase
      .from('project_payments')
      .delete()
      .eq('id', payment_id)
      .eq('project_id', params.id)

    if (error) {
      console.error('Error deleting payment:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Payment deleted successfully' }, { status: 200 })
  } catch (error: any) {
    console.error('Error in DELETE /api/projects/[id]/payments:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
