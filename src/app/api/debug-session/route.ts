import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const cookieStore = cookies()

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
      error,
    } = await supabase.auth.getSession()

    return NextResponse.json({
      hasSession: !!session,
      userId: session?.user?.id || null,
      userEmail: session?.user?.email || null,
      hasAccessToken: !!session?.access_token,
      error: error?.message || null,
      envVarsSet: {
        supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      },
      cookies: cookieStore.getAll().map((c) => ({ name: c.name, hasValue: !!c.value })),
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err.message || 'Unknown error',
        stack: err.stack,
      },
      { status: 500 }
    )
  }
}
