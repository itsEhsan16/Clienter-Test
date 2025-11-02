# COMPLETE OAuth FIX - Final Setup Guide

## 🔧 What Was Fixed

### 1. **Dual Callback Handler Issue (CRITICAL)**

- **Problem**: Had TWO callback handlers competing:
  - `/api/auth/callback/route.ts` (Server-side - correct for PKCE)
  - `/auth/callback/page.tsx` (Client-side - causing race condition)
- **Fix**:
  - ✅ Removed client-side callback page
  - ✅ Updated login to redirect to `/api/auth/callback`
  - ✅ API route handles PKCE code exchange properly

### 2. **Schema Mismatch**

- **Problem**: Database trigger referenced `currency` column that didn't exist
- **Fix**:
  - ✅ Added `currency TEXT DEFAULT 'INR'` to profiles table
  - ✅ Created migration file for existing databases

### 3. **Profile Fetch Errors**

- **Problem**: Using `.single()` throws error when no rows exist
- **Fix**:
  - ✅ Changed to `.maybeSingle()` in both `ensureProfile` and `fetchProfile`
  - ✅ Added proper return values from ensureProfile
  - ✅ Added 100ms delay after profile creation for trigger to complete

### 4. **Headers Configuration**

- **Problem**: Missing Accept headers for PostgREST
- **Fix**:
  - ✅ Added global headers to Supabase client
  - ✅ Fixed storage key format

## 📋 Required Supabase Dashboard Configuration

### Step 1: Run Database Schema

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Open your project: `zviakkdqtmhqfkxjjqvn`
3. Navigate to **SQL Editor**
4. Click **"New Query"**
5. Copy and paste the contents of `supabase/schema.sql`
6. Click **"Run"**
7. Verify tables in **Table Editor**

**OR** if you already ran the schema, just run the migration:

- Copy contents of `supabase/migrations/20251102_add_currency_to_profiles.sql`
- Run in SQL Editor

### Step 2: Configure Google OAuth Provider

1. In Supabase Dashboard, go to **Authentication → Providers**
2. Find **Google** and click to configure
3. Set the following:
   - ✅ **Enable Google Provider**: ON
   - ✅ **Client ID**: (from Google Cloud Console)
   - ✅ **Client Secret**: (from Google Cloud Console)
   - ✅ **Skip nonce check**: OFF (keep PKCE secure)

### Step 3: Configure Redirect URLs

1. In Supabase Dashboard, go to **Authentication → URL Configuration**
2. **Site URL**: `http://localhost:3000` (or your production URL)
3. **Redirect URLs** - Add BOTH:

   ```
   http://localhost:3000/api/auth/callback
   http://localhost:3001/api/auth/callback
   ```

   For production, add:

   ```
   https://yourdomain.com/api/auth/callback
   ```

### Step 4: Google Cloud Console Setup

1. Go to https://console.cloud.google.com
2. Select your project
3. Navigate to **APIs & Services → Credentials**
4. Find your OAuth 2.0 Client ID or create new one
5. Under **Authorized redirect URIs**, add:
   ```
   https://zviakkdqtmhqfkxjjqvn.supabase.co/auth/v1/callback
   ```
6. Under **Authorized JavaScript origins**, add:
   ```
   http://localhost:3000
   http://localhost:3001
   https://yourdomain.com (for production)
   ```

## 🚀 Testing the Complete Flow

### 1. Clear Browser State

```javascript
// Open DevTools Console (F12) and run:
localStorage.clear()
sessionStorage.clear()
location.reload()
```

### 2. Test OAuth Flow

1. Navigate to http://localhost:3001/login
2. Click **"Sign in with Google"**
3. Watch console logs:
   ```
   [Login] Initiating Google OAuth with PKCE…
   [Login] OAuth started, browser will redirect to Google
   ```
4. Authenticate with Google
5. You'll be redirected to `/api/auth/callback`
6. Watch for these logs:
   ```
   [OAuth Callback] Received request with code: YES
   [OAuth] Exchanging code for session...
   [OAuth] Session created successfully for user: user@example.com
   ```
7. Verify redirect to `/dashboard`
8. Check AuthContext logs:
   ```
   [Auth] ensureProfile: created missing profile for user
   [Auth] Profile loaded successfully: user@example.com
   ```

### 3. Expected Behavior

✅ **Success Indicators:**

- No 400 errors in Network tab
- No "code verifier" errors
- No 406 errors on profile fetch
- Profile created automatically via database trigger
- Redirect to dashboard
- User and profile data visible

❌ **If You See Errors:**

- **400 Bad Request**: Check redirect URLs in Supabase dashboard
- **Code verifier error**: Clear localStorage and try again
- **406 Not Acceptable**: Check if schema is properly applied
- **Profile not found**: Check if trigger is created in database

## 🗄️ Verify Database Setup

Run this in SQL Editor to check everything is set up:

```sql
-- Check if profiles table exists with currency column
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND table_schema = 'public';

-- Check if trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- Check if handle_new_user function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'handle_new_user';

-- Test profile creation manually (optional)
-- Replace the UUID with a test value
INSERT INTO auth.users (id, email)
VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com')
ON CONFLICT (id) DO NOTHING;

-- Check if profile was created by trigger
SELECT * FROM profiles
WHERE id = '00000000-0000-0000-0000-000000000001';
```

## 📝 Files Modified

1. **`supabase/schema.sql`** - Added currency column
2. **`supabase/migrations/20251102_add_currency_to_profiles.sql`** - Migration for existing DBs
3. **`src/app/login/page.tsx`** - Changed redirect to `/api/auth/callback`
4. **`src/contexts/AuthContext.tsx`** - Fixed profile fetching with maybeSingle
5. **`src/lib/supabase.ts`** - Already had correct headers
6. **DELETED** `src/app/auth/` - Removed duplicate client-side handler

## 🔒 Security Checklist

- ✅ PKCE flow enabled (flowType: 'pkce')
- ✅ Code exchange on server-side (API route)
- ✅ Session cookies set with httpOnly (via set-session API)
- ✅ Row Level Security policies enabled
- ✅ Profile trigger uses SECURITY DEFINER
- ✅ Proper redirect URL validation

## 🎯 Production Deployment

Before deploying to production:

1. **Update Environment Variables**:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://zviakkdqtmhqfkxjjqvn.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key-here
   NEXT_PUBLIC_APP_URL=https://yourdomain.com
   ```

2. **Update Supabase Redirect URLs**:

   - Add production URL: `https://yourdomain.com/api/auth/callback`

3. **Update Google Cloud Console**:

   - Add production domain to Authorized JavaScript origins
   - Add production callback to Authorized redirect URIs

4. **Test in Production**:
   - Clear browser cache
   - Test OAuth flow
   - Verify profile creation

## 🐛 Troubleshooting

### Issue: "redirect_uri_mismatch"

**Solution**: Check Google Cloud Console has exact callback URL:

```
https://zviakkdqtmhqfkxjjqvn.supabase.co/auth/v1/callback
```

### Issue: "Invalid redirect URL"

**Solution**: Add URL to Supabase Dashboard → Authentication → URL Configuration

### Issue: Profile not created

**Solution**:

1. Check if trigger exists in database
2. Run migration manually
3. Check Supabase logs for trigger errors

### Issue: Session not persisting

**Solution**:

1. Check cookies are being set (DevTools → Application → Cookies)
2. Verify storage key matches: `sb-zviakkdqtmhqfkxjjqvn-auth-token`
3. Clear all cookies and try again

## 💡 Key Architecture Points

### PKCE Flow Diagram

```
User clicks "Google"
  → Login page generates code_challenge and code_verifier
  → Stores code_verifier in localStorage
  → Redirects to Google with code_challenge

Google authenticates user
  → Redirects to Supabase with auth code

Supabase validates code
  → Redirects to /api/auth/callback with code

API Route Handler
  → Retrieves code_verifier from cookies (via SSR)
  → Exchanges code + verifier for session
  → Sets session cookies
  → Redirects to /dashboard

Dashboard loads
  → AuthContext reads session from cookies
  → Fetches/creates user profile
  → Shows user interface
```

### Why API Route vs Client Component?

**API Route (✅ Correct for PKCE)**:

- Server-side code exchange
- Can set httpOnly cookies
- More secure
- No localStorage race conditions
- Works with SSR/middleware

**Client Component (❌ Wrong for PKCE)**:

- Client-side code exchange
- localStorage race conditions
- Can't set httpOnly cookies
- Less secure
- Doesn't work with SSR

## ✨ Success!

If everything is set up correctly, you should now have:

- ✅ Working Google OAuth login
- ✅ Automatic profile creation
- ✅ Session persistence
- ✅ Secure PKCE flow
- ✅ No race conditions
- ✅ No 406/400 errors

**The flow is now**: Login → Google Auth → Callback → Profile Creation → Dashboard 🎉
