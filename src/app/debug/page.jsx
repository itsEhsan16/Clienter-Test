'use client'

import { useEffect, useState, useMemo } from 'react'
import { createBrowserClient_LEGACY } from '@/lib/supabase'

export default function DebugPage() {
  const [envStatus, setEnvStatus] = useState({})
  const [connectionTest, setConnectionTest] = useState(null)
  const [authTest, setAuthTest] = useState(null)

  const supabase = useMemo(() => {
    try {
      return createBrowserClient_LEGACY()
    } catch (err) {
      return null
    }
  }, [])

  useEffect(() => {
    console.log('[Debug] useEffect running, supabase:', !!supabase)
    if (!supabase) {
      console.log('[Debug] Supabase client creation failed')
      setConnectionTest({
        success: false,
        error: {
          message: 'Failed to create Supabase client',
          details: 'Check environment variables',
        },
      })
      setAuthTest({
        success: false,
        error: 'Failed to create Supabase client',
      })
      return
    }
    console.log('[Debug] Calling checkEnvironment')
    checkEnvironment()
  }, [supabase])

  const checkEnvironment = async () => {
    console.log('[Debug] checkEnvironment started')
    try {
      // Check environment variables
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      console.log('[Debug] Env vars - URL exists:', !!supabaseUrl, 'Key exists:', !!supabaseKey)

      setEnvStatus({
        url: {
          exists: !!supabaseUrl,
          value: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING',
          length: supabaseUrl?.length || 0,
        },
        key: {
          exists: !!supabaseKey,
          value: supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'MISSING',
          length: supabaseKey?.length || 0,
        },
        nodeEnv: process.env.NODE_ENV,
        isProduction: process.env.NODE_ENV === 'production',
      })

      // Test Supabase connection
      console.log('[Debug] Testing Supabase connection...')
      const { data, error } = await supabase
        .from('clients')
        .select('count', { count: 'exact', head: true })

      console.log('[Debug] Connection test result:', { data, error })

      setConnectionTest({
        success: !error,
        error: error
          ? {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint,
            }
          : null,
      })

      // Test auth
      console.log('[Debug] Testing auth...')
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession()

      console.log('[Debug] Auth test result:', { session: !!session, error: authError })

      setAuthTest({
        success: !authError,
        hasSession: !!session,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        error: authError ? authError.message : null,
      })

      console.log('[Debug] checkEnvironment completed successfully')
    } catch (err) {
      console.error('[Debug] checkEnvironment error:', err)
      setConnectionTest({
        success: false,
        error: {
          message: err.message || 'Unknown error',
          stack: err.stack,
        },
      })
      setAuthTest({
        success: false,
        error: err.message || 'Unknown error',
      })
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🔍 Environment Debug Page</h1>

        {/* Environment Variables */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">📋 Environment Variables</h2>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm">NEXT_PUBLIC_SUPABASE_URL</span>
                <span
                  className={`px-3 py-1 rounded text-sm ${
                    envStatus.url?.exists ? 'bg-green-600' : 'bg-red-600'
                  }`}
                >
                  {envStatus.url?.exists ? '✓ EXISTS' : '✗ MISSING'}
                </span>
              </div>
              <div className="bg-gray-900 p-3 rounded font-mono text-xs overflow-x-auto">
                {envStatus.url?.value}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Length: {envStatus.url?.length} characters
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-sm">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
                <span
                  className={`px-3 py-1 rounded text-sm ${
                    envStatus.key?.exists ? 'bg-green-600' : 'bg-red-600'
                  }`}
                >
                  {envStatus.key?.exists ? '✓ EXISTS' : '✗ MISSING'}
                </span>
              </div>
              <div className="bg-gray-900 p-3 rounded font-mono text-xs overflow-x-auto">
                {envStatus.key?.value}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Length: {envStatus.key?.length} characters
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">NODE_ENV</span>
                <span className="px-3 py-1 rounded text-sm bg-blue-600">{envStatus.nodeEnv}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Connection Test */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🔌 Supabase Connection Test</h2>

          {connectionTest ? (
            <div>
              <div
                className={`p-4 rounded mb-4 ${
                  connectionTest.success
                    ? 'bg-green-600/20 border border-green-600'
                    : 'bg-red-600/20 border border-red-600'
                }`}
              >
                <div className="font-semibold mb-2">
                  {connectionTest.success ? '✓ Connection Successful' : '✗ Connection Failed'}
                </div>
                {connectionTest.error && (
                  <div className="text-sm space-y-2">
                    <div>
                      <strong>Message:</strong> {connectionTest.error.message}
                    </div>
                    {connectionTest.error.code && (
                      <div>
                        <strong>Code:</strong> {connectionTest.error.code}
                      </div>
                    )}
                    {connectionTest.error.details && (
                      <div>
                        <strong>Details:</strong> {connectionTest.error.details}
                      </div>
                    )}
                    {connectionTest.error.hint && (
                      <div>
                        <strong>Hint:</strong> {connectionTest.error.hint}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="animate-pulse">Testing...</div>
          )}
        </div>

        {/* Auth Test */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🔐 Authentication Test</h2>

          {authTest ? (
            <div>
              <div
                className={`p-4 rounded mb-4 ${
                  authTest.success
                    ? 'bg-green-600/20 border border-green-600'
                    : 'bg-red-600/20 border border-red-600'
                }`}
              >
                <div className="font-semibold mb-2">
                  {authTest.success ? '✓ Auth Working' : '✗ Auth Failed'}
                </div>
                <div className="text-sm space-y-2">
                  <div>
                    <strong>Has Session:</strong> {authTest.hasSession ? 'Yes' : 'No'}
                  </div>
                  {authTest.userId && (
                    <div>
                      <strong>User ID:</strong> {authTest.userId}
                    </div>
                  )}
                  {authTest.userEmail && (
                    <div>
                      <strong>Email:</strong> {authTest.userEmail}
                    </div>
                  )}
                  {authTest.error && (
                    <div className="text-red-400">
                      <strong>Error:</strong> {authTest.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="animate-pulse">Testing...</div>
          )}
        </div>

        {/* Window Location */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🌐 Current Environment</h2>
          <div className="space-y-2 text-sm">
            <div>
              <strong>Origin:</strong>{' '}
              {typeof window !== 'undefined' ? window.location.origin : 'N/A'}
            </div>
            <div>
              <strong>Hostname:</strong>{' '}
              {typeof window !== 'undefined' ? window.location.hostname : 'N/A'}
            </div>
            <div>
              <strong>Protocol:</strong>{' '}
              {typeof window !== 'undefined' ? window.location.protocol : 'N/A'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">🔄 Actions</h2>
          <div className="space-y-3">
            <button
              onClick={checkEnvironment}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
            >
              🔄 Rerun Tests
            </button>
            <button
              onClick={() => {
                const debugInfo = {
                  envStatus,
                  connectionTest,
                  authTest,
                  timestamp: new Date().toISOString(),
                  userAgent: navigator.userAgent,
                }
                navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
                alert('Debug info copied to clipboard!')
              }}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
            >
              📋 Copy Debug Info
            </button>
          </div>
        </div>

        <div className="mt-8 p-4 bg-yellow-600/20 border border-yellow-600 rounded-lg">
          <p className="text-sm text-yellow-200">
            <strong>⚠️ Security Note:</strong> Delete this page before going to production! It
            exposes sensitive configuration information.
          </p>
        </div>
      </div>
    </div>
  )
}
