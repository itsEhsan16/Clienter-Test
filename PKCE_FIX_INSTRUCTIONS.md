# PKCE OAuth Fix - Instructions

## Problem

The Google OAuth sign-in was failing with the error:

```
oauth_failed: invalid request: both auth code and code verifier should be non-empty
```

This error occurs when the PKCE (Proof Key for Code Exchange) code verifier is missing from localStorage when the OAuth callback tries to exchange the authorization code for a session.

## Root Causes Fixed

### 1. **Storage Key Inconsistency**

- **Issue**: The storage key was changing between OAuth initiation and callback
- **Fix**: Changed from `supabase.auth.token` to `sb-auth-token` for consistency

### 2. **React Strict Mode Double Execution**

- **Issue**: In development, React Strict Mode runs effects twice, causing the callback to process twice and potentially clearing the code verifier
- **Fix**: Added `isProcessing` flag to prevent double execution

### 3. **Missing Debug Logging**

- **Issue**: Hard to diagnose where the code verifier was being lost
- **Fix**: Added comprehensive logging for:
  - Code verifier storage operations (GET/SET/REMOVE)
  - LocalStorage contents during callback
  - OAuth initiation steps

### 4. **Old Auth Data Interference**

- **Issue**: Old auth tokens/verifiers could interfere with new OAuth flows
- **Fix**: Clear old auth data before initiating new OAuth flow

## Changes Made

### `src/lib/supabase.ts`

- Added custom storage wrapper with debug logging
- Changed storage key to `sb-auth-token`
- Logs all code-verifier related operations

### `src/app/auth/callback/page.tsx`

- Added `isProcessing` flag to prevent double execution
- Added localStorage debugging on callback
- Displays all auth-related keys in console

### `src/app/login/page.tsx`

- Clear old auth data before OAuth initiation
- Added verification that code verifier is stored
- Enhanced logging for OAuth flow

## Testing Instructions

### 1. Clear Browser Storage

Before testing, completely clear your browser's localStorage:

```javascript
// Open browser console and run:
localStorage.clear()
```

### 2. Test OAuth Flow

1. Navigate to `/login`
2. Click "Google" button
3. **Monitor console logs** - you should see:
   ```
   [Login] Initiating Google OAuth with PKCE…
   [Login] Clearing old auth keys: [...]
   [Storage] SET code-verifier: ...
   [Login] OAuth started successfully
   [Login] Auth keys after OAuth init: ["sb-auth-token-code-verifier"]
   ```
4. Complete Google sign-in
5. You'll be redirected to `/auth/callback`
6. **Monitor console logs** - you should see:
   ```
   [Auth Callback] LocalStorage keys: [...]
   [Auth Callback] Auth-related keys: ["sb-auth-token-code-verifier", ...]
   [Storage] GET code-verifier: FOUND
   [Auth Callback] Exchanging code for session...
   [Auth Callback] Session created successfully
   ```
7. You should be redirected to `/dashboard`

### 3. What to Look For

#### ✅ Success Indicators:

- `[Storage] SET code-verifier` appears when clicking Google button
- `[Storage] GET code-verifier: FOUND` appears in callback
- No 400 errors in Network tab
- Successfully redirected to dashboard

#### ❌ Failure Indicators:

- `[Storage] GET code-verifier: MISSING` in callback
- 400 Bad Request error to `/auth/v1/token?grant_type=pkce`
- Error message about "code verifier should be non-empty"
- Redirected back to login with error

## Troubleshooting

### If code verifier is still missing:

1. **Check Browser Compatibility**

   - Ensure localStorage is enabled
   - Try in incognito/private mode
   - Try a different browser

2. **Check Supabase Configuration**

   - Verify PKCE is enabled in Supabase dashboard
   - Check that redirect URL is configured: `http://localhost:3000/auth/callback`

3. **Check for Browser Extensions**

   - Disable ad blockers
   - Disable privacy extensions that might block localStorage

4. **Network Issues**
   - Check if OAuth redirect happens too quickly
   - Verify no network errors during OAuth initiation

### Additional Debugging

If issues persist, check the console for:

- All `[Storage]` logs - verify SET happens before GET
- All `[Auth Callback]` logs - verify code and keys are present
- Network tab - check for any failed requests

## Production Deployment

Before deploying to production:

1. **Remove or reduce debug logging** (optional)

   - The `[Storage]` logs can be removed or made conditional
   - Keep the `[Auth Callback]` logs for troubleshooting

2. **Update Supabase Redirect URLs**

   - Add your production URL to Supabase dashboard
   - Update in both "Authentication > URL Configuration" sections

3. **Verify Environment Variables**

   - Ensure `NEXT_PUBLIC_SUPABASE_URL` is set
   - Ensure `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set

4. **Test in Production**
   - Test OAuth flow after deployment
   - Monitor logs in Vercel dashboard

## Notes

- The `isProcessing` flag is crucial in development due to React Strict Mode
- The code verifier must persist in localStorage between page loads
- The storage key must match between OAuth initiation and callback
- Supabase automatically handles code verifier generation and validation

## Support

If you continue to experience issues:

1. Check Supabase Auth logs in your dashboard
2. Verify your OAuth provider configuration
3. Ensure you're using the latest `@supabase/ssr` package
