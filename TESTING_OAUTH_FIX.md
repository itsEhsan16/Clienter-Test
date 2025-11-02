# 🧪 OAuth PKCE Fix - Testing Guide

## ✅ Fix Applied - Ready to Test!

Your OAuth PKCE error has been fixed. The dev server is running at `http://localhost:3000`.

## 🚨 CRITICAL: Update Supabase Dashboard First!

Before testing, you **MUST** update your Supabase redirect URLs:

1. Go to: https://app.supabase.com
2. Select your project
3. Navigate to: **Authentication** → **URL Configuration**
4. Under **Redirect URLs**, add:
   ```
   http://localhost:3000/auth/callback
   http://localhost:3000/
   ```
5. Click **Save**

⚠️ **Without this step, OAuth will not work!**

## 📋 Testing Steps

### Step 1: Clear Browser State

1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Under **Local Storage**, find `http://localhost:3000`
4. Delete all items starting with `sb-`
5. Close DevTools

### Step 2: Test OAuth Login

1. Navigate to: `http://localhost:3000/login`
2. Click **"Continue with Google"** button
3. You'll be redirected to Google sign-in
4. Sign in with your Google account
5. Authorize the application

### Step 3: Verify Success

After authorization, you should see:

1. ✅ Redirected to `http://localhost:3000/auth/callback`
2. ✅ Loading screen: "Signing you in..."
3. ✅ Redirected to `http://localhost:3000/dashboard`
4. ✅ You're logged in!

### Step 4: Check Console (DevTools)

Open console (F12 → Console) and verify:

```
[Login] Initiating Google OAuth with PKCE…
[Supabase Client] Client created successfully
[Auth Callback] Starting OAuth callback handling...
[Auth Callback] Session created successfully for user: your-email@gmail.com
```

✅ **No errors about "code verifier"!**

## ❌ What Was Wrong (Before Fix)

```
[OAuth] API code exchange failed: invalid request: both auth code
and code verifier should be non-empty
```

This happened because:

- Callback was on **server** (`/api/auth/callback`)
- PKCE `code_verifier` is in **browser localStorage**
- Server couldn't access localStorage
- Result: ❌ PKCE validation failed

## ✅ What's Fixed (After Fix)

```
[Auth Callback] Session created successfully for user: ...
```

Now works because:

- Callback is on **client** (`/auth/callback`)
- Client has access to **browser localStorage**
- `code_verifier` is accessible
- Result: ✅ PKCE validation succeeds

## 🔍 Technical Changes Made

### 1. New Client-Side Callback Page

**Created**: `src/app/auth/callback/page.tsx`

- Runs in browser (client component)
- Has access to localStorage
- Calls `exchangeCodeForSession(window.location.href)`
- Handles PKCE flow correctly

### 2. Updated OAuth Redirect

**Modified**: `src/app/login/page.tsx`

```diff
- redirectTo: `${window.location.origin}/api/auth/callback`
+ redirectTo: `${window.location.origin}/auth/callback`
```

### 3. Optimized Supabase Client

**Modified**: `src/lib/supabase.ts`

- Only detects session in URL on callback page
- Prevents interference on other pages

## 🐛 Troubleshooting

### Still seeing PKCE error?

1. **Did you update Supabase redirect URLs?**

   - Must be EXACTLY: `http://localhost:3000/auth/callback`
   - No trailing slash!

2. **Clear localStorage completely**

   ```javascript
   // In browser console:
   localStorage.clear()
   ```

3. **Hard refresh the browser**

   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

4. **Check environment variables**
   - Ensure `.env.local` has correct values
   - Restart dev server if you changed them

### Redirect not working?

- Check browser console for errors
- Verify middleware isn't blocking (it should allow `/auth/callback`)
- Ensure Google OAuth is enabled in Supabase

### Session not persisting?

- Check that cookies are enabled
- Verify `/api/auth/set-session` endpoint exists
- Look for cookie-related errors in console

## 📊 Success Indicators

| Indicator                          | Status             |
| ---------------------------------- | ------------------ |
| No "code verifier" errors          | ✅ Should be fixed |
| Redirect to `/auth/callback` works | ✅ Should work     |
| Loading screen shows               | ✅ Should show     |
| Session created                    | ✅ Should work     |
| Redirected to dashboard            | ✅ Should work     |
| User stays logged in               | ✅ Should work     |

## 🎯 Next Steps

### For Local Development

- Test OAuth login/logout
- Test signing up with OAuth
- Verify session persists across refreshes

### For Production (Vercel)

1. Add production redirect URL to Supabase:

   ```
   https://your-app.vercel.app/auth/callback
   https://your-app.vercel.app/
   ```

2. Commit and push:

   ```bash
   git add .
   git commit -m "Fix OAuth PKCE error - client-side callback"
   git push
   ```

3. Verify on production after deployment

## 📚 Documentation

Full details in: `OAUTH_PKCE_FIXED.md`

---

**Status**: ✅ Fix deployed and ready to test
**Server**: Running at http://localhost:3000
**Action Required**: Update Supabase redirect URLs (see above)
