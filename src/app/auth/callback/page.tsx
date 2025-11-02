import { redirect } from 'next/navigation'

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const code = (searchParams?.code as string) || null
  const error = (searchParams?.error as string) || null
  const error_description = (searchParams?.error_description as string) || null

  console.log('[Auth Callback Page] Received:', { 
    hasCode: !!code, 
    error, 
    error_description 
  })

  if (error) {
    console.error('[Auth Callback Page] OAuth error:', error, error_description)
    redirect(`/login?error=${encodeURIComponent(error_description || error)}`)
  }

  if (!code) {
    console.error('[Auth Callback Page] No code present in callback URL')
    redirect('/login?error=no_code')
  }

  // Delegate to API route that exchanges the code and sets cookies server-side
  console.log('[Auth Callback Page] Redirecting to API route with code')
  redirect(`/api/auth/callback?code=${encodeURIComponent(code)}`)
}
