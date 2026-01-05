import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

/**
 * API Route: Create Team Member
 *
 * Owner can create team members with email/password without verification
 * Uses Supabase Admin API to bypass email confirmation
 */
export async function POST(req: NextRequest) {
  try {
    // Get the current user's session
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

    // Get user's organization membership and verify they're an owner/admin
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', session.user.id)
      .eq('status', 'active')
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only owners and admins can add team members' },
        { status: 403 }
      )
    }

    // Parse request body
    const { email, password, role, displayName, notes, monthlySalary } = await req.json()

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Email, password, and role are required' }, { status: 400 })
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
    }

    // Verify service role key is configured
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('[Team API] SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json(
        { error: 'Server configuration error: Missing service role key' },
        { status: 500 }
      )
    }

    // Create Supabase Admin client
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // Check if user with this email already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
    const emailExists = existingUsers?.users?.some((u) => u.email === email)

    if (emailExists) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }

    // Create the user with Admin API (no email verification required)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: displayName || email.split('@')[0],
      },
    })

    if (createError || !newUser.user) {
      console.error('[Team API] Error creating user:', createError)
      return NextResponse.json(
        { error: createError?.message || 'Failed to create user' },
        { status: 500 }
      )
    }

    console.log('[Team API] User created successfully:', newUser.user.id)

    // Manually create profile using Admin client (bypasses RLS)
    const { error: profileError } = await supabaseAdmin.from('profiles').upsert(
      {
        id: newUser.user.id,
        email: email,
        full_name: displayName || email.split('@')[0],
        currency: 'INR',
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      console.error('[Team API] Error creating profile:', profileError)
      // Try to clean up the user
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      return NextResponse.json(
        { error: 'Failed to create user profile: ' + profileError.message },
        { status: 500 }
      )
    }

    console.log('[Team API] Profile created successfully')

    // Add the new user to the organization
    const memberData: any = {
      organization_id: membership.organization_id,
      user_id: newUser.user.id,
      role,
      display_name: displayName || null,
      notes: notes || null,
      status: 'active',
    }

    // Add monthly_salary if provided (field may not exist in older schemas)
    if (monthlySalary) {
      memberData.monthly_salary = parseFloat(monthlySalary)
    }

    const { error: memberError } = await supabase.from('organization_members').insert(memberData)

    if (memberError) {
      console.error('[Team API] Error adding member to organization:', memberError)
      // User created but couldn't be added to org - we should ideally delete the user
      // But for now, return error
      return NextResponse.json(
        { error: 'User created but failed to add to organization: ' + memberError.message },
        { status: 500 }
      )
    }

    // Fetch the complete member data to return
    const { data: completeMemberData } = await supabase
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
      .eq('user_id', newUser.user.id)
      .single()

    return NextResponse.json(
      {
        success: true,
        member: completeMemberData,
        message: 'Team member created successfully',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[Team API] Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
