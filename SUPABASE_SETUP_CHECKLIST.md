# ✅ Supabase Dashboard Setup Checklist

Complete these steps in your Supabase Dashboard to finish the OAuth setup.

## 🔗 Dashboard URL

https://app.supabase.com/project/zviakkdqtmhqfkxjjqvn

---

## Step 1: Database Schema

### Option A: First Time Setup

- [ ] Go to **SQL Editor**
- [ ] Click **"New Query"**
- [ ] Copy all contents from `supabase/schema.sql`
- [ ] Paste into query editor
- [ ] Click **"Run"** button
- [ ] Wait for success message
- [ ] Go to **Table Editor** and verify these tables exist:
  - [ ] profiles
  - [ ] clients
  - [ ] meetings
  - [ ] reminders

### Option B: Already Have Schema (Just Add Currency)

- [ ] Go to **SQL Editor**
- [ ] Click **"New Query"**
- [ ] Copy contents from `supabase/migrations/20251102_add_currency_to_profiles.sql`
- [ ] Paste and click **"Run"**
- [ ] Verify success message

### Verify Trigger

- [ ] In SQL Editor, run this query:

```sql
SELECT trigger_name
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';
```

- [ ] Should return 1 row with trigger name

---

## Step 2: Google OAuth Provider

- [ ] Go to **Authentication** → **Providers**
- [ ] Scroll to find **Google** provider
- [ ] Click to expand Google settings
- [ ] Toggle **"Enable Sign in with Google"** to ON
- [ ] Enter your **Google Client ID**
- [ ] Enter your **Google Client Secret**
- [ ] **IMPORTANT:** Keep "Skip nonce check" OFF (unchecked)
- [ ] Click **"Save"**

**Don't have Google credentials?** See [Google Cloud Console Setup](#google-cloud-console-setup) below.

---

## Step 3: Redirect URLs

- [ ] Go to **Authentication** → **URL Configuration**
- [ ] Find **"Site URL"** field
- [ ] Set to: `http://localhost:3000`
- [ ] Scroll to **"Redirect URLs"** section
- [ ] Click **"Add URL"** and add:
  - [ ] `http://localhost:3000/api/auth/callback`
  - [ ] `http://localhost:3001/api/auth/callback`
- [ ] Click **"Save"**

**For Production:** Add your production URL too (e.g., `https://yourdomain.com/api/auth/callback`)

---

## Step 4: Google Cloud Console Setup

If you haven't set up Google OAuth yet:

### Create OAuth Credentials

- [ ] Go to https://console.cloud.google.com
- [ ] Select your project (or create new one)
- [ ] Navigate to **APIs & Services** → **Credentials**
- [ ] Click **"Create Credentials"** → **"OAuth client ID"**
- [ ] Choose **"Web application"**
- [ ] Name it: "Clienter App"

### Configure OAuth Client

- [ ] Under **"Authorized JavaScript origins"**, add:

  - [ ] `http://localhost:3000`
  - [ ] `http://localhost:3001`
  - [ ] (Your production domain for later)

- [ ] Under **"Authorized redirect URIs"**, add:

  - [ ] `https://zviakkdqtmhqfkxjjqvn.supabase.co/auth/v1/callback`

- [ ] Click **"Create"**
- [ ] Copy the **Client ID**
- [ ] Copy the **Client Secret**
- [ ] Go back to Supabase and paste these in Google provider settings

---

## Step 5: Test the Setup

### Quick Test

- [ ] Open: http://localhost:3001/oauth-test.html
- [ ] Click **"Clear All Storage"**
- [ ] Click **"Check Supabase Config"**
- [ ] All status indicators should be green
- [ ] Click **"Open Login Page"**

### Full OAuth Test

- [ ] On login page, click **"Sign in with Google"**
- [ ] Select your Google account
- [ ] Grant permissions if asked
- [ ] Should redirect to `/dashboard`
- [ ] Check console - no errors
- [ ] Open DevTools → Application → Local Storage
- [ ] Should see: `sb-zviakkdqtmhqfkxjjqvn-auth-token`

### Verify Profile Creation

- [ ] In Supabase Dashboard, go to **Table Editor**
- [ ] Click **"profiles"** table
- [ ] Should see your profile with:
  - [ ] Your email
  - [ ] User ID matching auth.users
  - [ ] Currency set to 'INR'
  - [ ] Created timestamp

---

## ✅ Success Criteria

When everything is working, you should see:

- ✅ Google login button works
- ✅ Redirects to Google authentication
- ✅ Returns to your app after auth
- ✅ Redirects to /dashboard
- ✅ No errors in browser console
- ✅ Profile created in database
- ✅ User data visible on dashboard
- ✅ Session persists on page reload

---

## 🐛 Troubleshooting

### Error: "redirect_uri_mismatch"

**Fix:** Check Google Cloud Console has this exact URL:

```
https://zviakkdqtmhqfkxjjqvn.supabase.co/auth/v1/callback
```

### Error: "Invalid redirect URL"

**Fix:** Add your callback URL to Supabase redirect allow list

### Error: Profile not created

**Fix:** Check database trigger exists (Step 1 verify section)

### Error: 406 on profile fetch

**Fix:** Run the currency migration (Step 1 Option B)

### Error: "Code verifier should be non-empty"

**Fix:** Clear browser localStorage and try again

---

## 📞 Need Help?

1. Check console logs in browser DevTools
2. Check Supabase logs: Dashboard → Logs → Auth
3. Use test helper: http://localhost:3001/oauth-test.html
4. Review full docs: `COMPLETE_OAUTH_FIX.md`

---

## 🎉 All Done!

Once all checkboxes are checked, your OAuth authentication is fully configured and working!

**Next Steps:**

- Test login/logout flow
- Test session persistence
- Deploy to production
- Update production URLs in both Supabase and Google Cloud Console
