# OAuth PKCE Authentication Fix

## Issues Identified

From the console errors, three main issues were causing the authentication failures:

1. **406 Error on Profile Fetch**

   - Error: `Failed to load resource: the server responded with a status of 406 ()`
   - Cause: Missing `Accept` header in Supabase API requests

2. **Code Verifier Missing**

   - Error: `AuthApiError: invalid request: both auth code and code verifier should be non-empty`
   - Cause: PKCE code verifier not being properly stored or retrieved from localStorage

3. **Cascading Errors**
   - Multiple `session_expired` errors appearing
   - Cause: Error states in AuthContext causing re-renders and retry loops

## Changes Made

### 1. Fixed Supabase Client Configuration (`src/lib/supabase.ts`)

**Added global headers:**

```typescript
global: {
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
}
```

**Fixed storage key format:**

```typescript
const projectRef = supabaseUrl.split('//')[1].split('.')[0]
const storageKey = `sb-${projectRef}-auth-token`
```

This ensures the storage key matches Supabase's default format: `sb-zviakkdqtmhqfkxjjqvn-auth-token`

### 2. Updated Login Flow (`src/app/login/page.tsx`)

**Added comprehensive localStorage clearing:**

```typescript
// Clear all Supabase-related localStorage keys
if (typeof window !== 'undefined') {
  const keys = Object.keys(localStorage)
  keys.forEach((key) => {
    if (key.startsWith('sb-') || key.includes('supabase')) {
      localStorage.removeItem(key)
    }
  })
}
```

This ensures no stale PKCE code verifiers from previous failed attempts.

### 3. Enhanced Callback Error Handling (`src/app/auth/callback/page.tsx`)

**Added debugging for code verifier:**

```typescript
const storageKeys = Object.keys(localStorage).filter((k) => k.includes('code-verifier'))
console.log('[Auth Callback] Code verifier keys in storage:', storageKeys)
```

**Improved error handling:**

```typescript
if (
  exchangeError.message.includes('code verifier') ||
  exchangeError.message.includes('invalid request')
) {
  console.log('[Auth Callback] Code verifier missing, clearing auth state...')
  await supabase.auth.signOut()

  // Clear all Supabase-related localStorage
  if (typeof window !== 'undefined') {
    const keys = Object.keys(localStorage)
    keys.forEach((key) => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        localStorage.removeItem(key)
      }
    })
  }

  router.push('/login?error=session_expired&details=Please%20try%20logging%20in%20again')
  return
}
```

### 4. Fixed AuthContext Error Propagation (`src/contexts/AuthContext.tsx`)

**Removed error state setting in profile operations:**

- `ensureProfile()` - Only logs errors, doesn't set error state
- `fetchProfile()` - Only logs errors, doesn't set error state
- `restoreSession()` - Only logs session errors, doesn't set error state

This prevents cascading errors and unnecessary re-renders.

## Testing Instructions

### 1. Clear Browser State

```javascript
// In browser console:
localStorage.clear()
sessionStorage.clear()
```

### 2. Attempt OAuth Login

1. Navigate to http://localhost:3001/login
2. Click "Sign in with Google"
3. Watch the console for logs

### 3. Expected Console Output

**On Login Page:**

```
[Supabase Client] Initializing with URL: SET
[Supabase Client] Anon Key: SET (length: 208)
[Supabase Client] Using storage key: sb-zviakkdqtmhqfkxjjqvn-auth-token
[Login] Initiating Google OAuth with PKCE…
[Login] OAuth started, browser will redirect to Google
```

**On Callback Page:**

```
[Auth Callback] Received: { hasCode: true, error: null, errorDescription: null }
[Auth Callback] Code verifier keys in storage: ['sb-zviakkdqtmhqfkxjjqvn-auth-token-code-verifier']
[Auth Callback] Exchanging code for session...
[Auth Callback] Session created successfully for: user@example.com
```

**Profile Fetch (no 406 error):**

```
[Auth] Fetching profile for userId: 7ef9c206-8d94-4ea8-b3dc-7133532ab95e
[Auth] Supabase profile fetch result: { data: {...}, error: null }
```

## Verification Checklist

- [ ] No 406 errors on profile fetch
- [ ] Code verifier is present in localStorage during callback
- [ ] No "code verifier should be non-empty" errors
- [ ] No cascading session_expired errors
- [ ] Successful redirect to /dashboard after auth
- [ ] Profile data loads correctly

## If Issues Persist

### Check Supabase Dashboard Settings

1. **Authentication → URL Configuration**

   - Site URL: `http://localhost:3000` or `http://localhost:3001`
   - Redirect URLs:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3001/auth/callback`

2. **Authentication → Providers → Google**

   - Enabled: ✅
   - Skip nonce check: ✅ (for PKCE)
   - Client ID and Secret configured

3. **Google Cloud Console**
   - Authorized redirect URIs must include:
     - `https://zviakkdqtmhqfkxjjqvn.supabase.co/auth/v1/callback`

### Additional Debugging

Add to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_DEBUG=true
```

This enables verbose logging from Supabase client.

## Technical Details

### PKCE Flow

1. **Initiation** (`/login`):

   - User clicks "Sign in with Google"
   - Supabase generates code verifier and challenge
   - Stores verifier in localStorage: `sb-{project}-auth-token-code-verifier`
   - Redirects to Google with challenge

2. **Callback** (`/auth/callback`):

   - Receives authorization code from Google
   - Retrieves code verifier from localStorage
   - Exchanges code + verifier for session
   - Stores session tokens in localStorage

3. **Session Management**:
   - Access token stored in: `sb-{project}-auth-token`
   - Auto-refresh enabled
   - Session persisted across page reloads

### Storage Keys Used

- `sb-zviakkdqtmhqfkxjjqvn-auth-token` - Main session storage
- `sb-zviakkdqtmhqfkxjjqvn-auth-token-code-verifier` - PKCE verifier (temporary)

## Related Files Modified

- `src/lib/supabase.ts` - Client configuration
- `src/app/login/page.tsx` - OAuth initiation
- `src/app/auth/callback/page.tsx` - OAuth callback handling
- `src/contexts/AuthContext.tsx` - Error propagation fixes

## References

- [Supabase PKCE Flow](https://supabase.com/docs/guides/auth/server-side/pkce-flow)
- [OAuth 2.0 PKCE](https://oauth.net/2/pkce/)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/auth-signinwithoauth)
