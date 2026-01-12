'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function DiagnosticsPage() {
  const { user, profile, supabase, organization } = useAuth()
  const [envCheck, setEnvCheck] = useState<any>(null)
  const [dbTest, setDbTest] = useState<any>(null)
  const [authTest, setAuthTest] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    // Check environment variables
    fetch('/api/env-check')
      .then((res) => res.json())
      .then(setEnvCheck)
      .catch((err) => setEnvCheck({ error: err.message }))

    // Test database connection
    if (supabase) {
      supabase
        .from('profiles')
        .select('count')
        .then(({ data, error }: any) => {
          setDbTest({ success: !error, error: error?.message, data })
        })
    }

    // Test auth session
    if (supabase) {
      supabase.auth.getSession().then(({ data, error }: any) => {
        setAuthTest({
          success: !error,
          error: error?.message,
          hasSession: !!data?.session,
          userId: data?.session?.user?.id,
        })
      })
    }
  }, [supabase])

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🔍 Diagnostics Dashboard</h1>

        {/* Environment Variables */}
        <div className="card p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Environment Variables</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(envCheck, null, 2)}
          </pre>
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              Client-side check:
              <br />
              URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ SET' : '❌ NOT SET'}
              <br />
              Key:{' '}
              {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
                ? `✅ SET (${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length} chars)`
                : '❌ NOT SET'}
            </p>
          </div>
        </div>

        {/* Auth Status */}
        <div className="card p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Authentication Status</h2>
          <div className="space-y-2">
            <p>User: {user ? `✅ ${user.email} (${user.id})` : '❌ Not logged in'}</p>
            <p>Profile: {profile ? `✅ ${profile.email}` : '❌ No profile'}</p>
            <p>Supabase Client: {supabase ? '✅ Initialized' : '❌ Not initialized'}</p>
          </div>
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Auth Test Result:</h3>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(authTest, null, 2)}
            </pre>
          </div>
        </div>

        {/* Database Connection */}
        <div className="card p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Database Connection</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(dbTest, null, 2)}
          </pre>
        </div>

        {/* Browser Info */}
        <div className="card p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Browser Info</h2>
          {isClient ? (
            <div className="space-y-2 text-sm">
              <p>User Agent: {navigator.userAgent}</p>
              <p>Location: {window.location.href}</p>
              <p>Cookies Enabled: {navigator.cookieEnabled ? '✅ Yes' : '❌ No'}</p>
            </div>
          ) : (
            <p>Loading browser info...</p>
          )}
        </div>

        {/* Manual Tests */}
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-4">Manual Tests</h2>
          <div className="space-y-4">
            <button
              onClick={async () => {
                if (!supabase || !user) {
                  alert('No supabase client or user')
                  return
                }
                const { data, error } = await supabase
                  .from('clients')
                  .select('*')
                  .eq('organization_id', organization?.organizationId)
                console.log('Manual clients fetch:', { data, error })
                alert(
                  error ? `Error: ${error.message}` : `Success! Found ${data?.length || 0} clients`
                )
              }}
              className="btn-primary"
            >
              Test Fetch Clients
            </button>

            <button
              onClick={async () => {
                if (!supabase) {
                  alert('No supabase client')
                  return
                }
                const {
                  data: { session },
                  error,
                } = await supabase.auth.getSession()
                console.log('Manual session check:', { session, error })
                alert(
                  error
                    ? `Error: ${error.message}`
                    : session
                    ? `Session exists for ${session.user.email}`
                    : 'No session found'
                )
              }}
              className="btn-secondary ml-4"
            >
              Test Get Session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
