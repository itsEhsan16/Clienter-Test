# OAuth PKCE Debugging Guide

## Current Issues Fixed

### 1. **406 Error on Profile Fetch**

- **Problem**: Missing `Accept` header in Supabase requests
- **Fix**: Added global headers to Supabase client configuration

### 2. **Code Verifier Missing**

- **Problem**: PKCE code verifier not being stored/retrieved correctly
- **Fix**:
  - Updated storage key to use Supabase's default format: `sb-{project-ref}-auth-token`
  - Added localStorage clearing before OAuth initiation
  - Added debugging logs to track verifier storage

### 3. **Multiple Session Expired Errors**

- **Problem**: Error state propagating and causing cascading failures
- **Fix**: Removed error state setting in profile fetch functions

## How to Test

### Step 1: Clear Browser State

```javascript
// Open browser console and run:
localStorage.clear()
sessionStorage.clear()
```

### Step 2: Check Current Storage Keys

```javascript
// Before login, check what keys exist:
Object.keys(localStorage).filter((k) => k.includes('sb-') || k.includes('supabase'))
```

### Step 3: Initiate OAuth Flow

1. Click "Sign in with Google"
2. Watch console logs for:
   - `[Login] Initiating Google OAuth with PKCE…`
   - `[Login] OAuth started, browser will redirect to Google`
3. After Google auth, you'll be redirected to `/auth/callback`

### Step 4: Monitor Callback

Watch for these logs:

- `[Auth Callback] Code verifier keys in storage:` - Should show keys
- `[Auth Callback] Exchanging code for session...`
- `[Auth Callback] Session created successfully`

## Expected Storage Keys

After successful OAuth flow, you should see:

```
sb-zviakkdqtmhqfkxjjqvn-auth-token
sb-zviakkdqtmhqfkxjjqvn-auth-token-code-verifier
```

## Common Issues

### Issue: "code verifier should be non-empty"

**Cause**: Code verifier was not stored during OAuth initiation
**Solution**:

1. Clear localStorage completely
2. Ensure no browser extensions are blocking storage
3. Try in incognito mode

### Issue: 406 on profile fetch

**Cause**: Missing Accept header
**Solution**: Already fixed in `supabase.ts` global headers config

### Issue: Multiple session_expired errors

**Cause**: AuthContext setting error states that trigger re-renders
**Solution**: Profile fetch errors are now only logged, not set in error state

## Manual Testing Checklist

- [ ] Clear browser storage
- [ ] Click "Sign in with Google"
- [ ] Check console for OAuth initiation logs
- [ ] Verify redirect to Google
- [ ] Complete Google authentication
- [ ] Check callback logs for code verifier
- [ ] Verify successful session exchange
- [ ] Confirm redirect to /dashboard
- [ ] Check that profile loads without 406 error

## Debugging Commands

```javascript
// Check Supabase client config
const supabase = createBrowserClient()
console.log(supabase)

// Check current session
const {
  data: { session },
} = await supabase.auth.getSession()
console.log('Session:', session)

// Check localStorage keys
console.log(
  'Storage keys:',
  Object.keys(localStorage).filter((k) => k.includes('sb-'))
)
```

## Next Steps If Still Failing

1. **Check Supabase Dashboard**:

   - Go to Authentication → URL Configuration
   - Verify Redirect URLs includes: `http://localhost:3000/auth/callback`
   - Ensure PKCE is enabled

2. **Check Google OAuth Settings**:

   - Verify authorized redirect URIs in Google Cloud Console
   - Should include: `https://zviakkdqtmhqfkxjjqvn.supabase.co/auth/v1/callback`

3. **Check Browser Network Tab**:

   - Look for the `/auth/v1/token?grant_type=pkce` request
   - Check request payload for `auth_code` and `code_verifier`
   - Verify both are present

4. **Enable Debug Mode**:
   - Add to `.env.local`: `NEXT_PUBLIC_SUPABASE_DEBUG=true`
   - Supabase client will log more details
