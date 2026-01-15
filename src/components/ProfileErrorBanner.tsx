'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { AlertCircle, RefreshCw, LogOut, Loader2 } from 'lucide-react'

interface ProfileErrorBannerProps {
  /** Custom error message to display (overrides the default from auth context) */
  errorMessage?: string
  /** Whether to show the sign out option */
  showSignOut?: boolean
  /** Callback when retry is clicked */
  onRetry?: () => void
  /** Callback when retry completes successfully */
  onRetrySuccess?: () => void
}

/**
 * A banner component that displays when there's an error loading the user profile.
 * Provides retry functionality with loading state and optional sign out.
 */
export function ProfileErrorBanner({
  errorMessage,
  showSignOut = true,
  onRetry,
  onRetrySuccess,
}: ProfileErrorBannerProps) {
  const { profileError, profileLoading, retryProfileFetch, signOut, profile } = useAuth()
  const [isRetrying, setIsRetrying] = useState(false)

  // Don't render if there's no error or profile is loaded
  const displayError = errorMessage || profileError
  if (!displayError || profile) {
    return null
  }

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      if (onRetry) {
        onRetry()
      }
      await retryProfileFetch()
      // Check if retry was successful
      // Note: profile state will be updated by retryProfileFetch
      if (onRetrySuccess) {
        // Give a small delay for state to propagate
        setTimeout(() => {
          onRetrySuccess()
        }, 100)
      }
    } catch (err) {
      console.error('[ProfileErrorBanner] Retry failed:', err)
    } finally {
      setIsRetrying(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      // Redirect to login will happen via auth state change
      window.location.href = '/login'
    } catch (err) {
      console.error('[ProfileErrorBanner] Sign out failed:', err)
    }
  }

  const isLoading = isRetrying || profileLoading

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-lg p-4 mb-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-semibold text-yellow-800">Unable to Load Profile</h3>
          <p className="mt-1 text-sm text-yellow-700">{displayError}</p>
          <p className="mt-2 text-xs text-yellow-600">
            Some features may be limited until your profile is loaded.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleRetry}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg 
                bg-yellow-100 text-yellow-800 hover:bg-yellow-200 
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors duration-200"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Loading Profile
                </>
              )}
            </button>
            {showSignOut && (
              <button
                onClick={handleSignOut}
                disabled={isLoading}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg 
                  text-yellow-700 hover:bg-yellow-100 
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-200"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out & Try Again
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * A minimal inline version of the error banner for use in smaller spaces
 */
export function ProfileErrorInline() {
  const { profileError, profileLoading, retryProfileFetch, profile } = useAuth()
  const [isRetrying, setIsRetrying] = useState(false)

  if (!profileError || profile) {
    return null
  }

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await retryProfileFetch()
    } finally {
      setIsRetrying(false)
    }
  }

  const isLoading = isRetrying || profileLoading

  return (
    <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-50 px-3 py-2 rounded-lg">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">Profile not loaded</span>
      <button
        onClick={handleRetry}
        disabled={isLoading}
        className="text-yellow-700 hover:text-yellow-800 font-medium disabled:opacity-50"
      >
        {isLoading ? 'Retrying...' : 'Retry'}
      </button>
    </div>
  )
}
