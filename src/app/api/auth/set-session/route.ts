import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const startTime = Date.now()

  try {
    const { access_token, refresh_token, expires_at, expires_in } = await req.json()

    console.log('🔐 [Set Session] Received request', {
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
      timestamp: new Date().toISOString(),
    })

    if (!access_token || !refresh_token) {
      console.error('❌ [Set Session] Missing tokens')
      return NextResponse.json({ ok: false, error: 'Missing tokens' }, { status: 400 })
    }

    const expiresInSeconds = typeof expires_in === 'number' ? expires_in : 60 * 60 * 24 * 7
    const cookieOptions = {
      path: '/',
      maxAge: expiresInSeconds,
      sameSite: 'lax' as const,
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
    }

    const res = NextResponse.json({ ok: true })
    res.cookies.set('sb-access-token', access_token, cookieOptions)
    res.cookies.set('sb-refresh-token', refresh_token, cookieOptions)

    const duration = Date.now() - startTime
    console.log(`✅ [Set Session] Cookies set successfully (${duration}ms)`)

    return res
  } catch (err: any) {
    const duration = Date.now() - startTime
    console.error(`❌ [Set Session] Error after ${duration}ms:`, err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to set session' },
      { status: 500 }
    )
  }
}
