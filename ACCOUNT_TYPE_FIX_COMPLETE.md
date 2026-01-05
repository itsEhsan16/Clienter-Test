# COMPLETE AUTH FIX - Account Type Separation

## 🔴 The Problem

Team members created by agency owners could:

1. Login via `/team-login` but get redirected to `/login`
2. Login successfully via `/login` (owner's page) and access owner features
3. There was no distinction in the authentication system between owners and team members
4. Both types shared the same `auth.users` table without role differentiation

**Root Cause:** No `account_type` field in the `profiles` table to distinguish between owners and team members at the authentication level.

---

## ✅ The Solution

### 1. **Database Level Changes**

#### Added `account_type` Column to Profiles Table

```sql
CREATE TYPE account_type AS ENUM ('owner', 'team_member');
ALTER TABLE profiles ADD COLUMN account_type account_type DEFAULT 'owner' NOT NULL;
CREATE INDEX idx_profiles_account_type ON profiles(account_type);
```

**Purpose:** Store account type directly in profiles for fast, reliable authentication checks.

#### Updated Existing Data

- All existing users set to `'owner'` by default
- Users in `organization_members` who are NOT organization owners are marked as `'team_member'`

#### Updated `handle_new_user()` Trigger

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, currency, account_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'INR',
    'owner'  -- All signups are owners
  );
  RETURN NEW;
END;
$$;
```

**Purpose:** Automatically set `account_type='owner'` for all new signups via `/signup` or `/login`.

---

### 2. **API Level Changes**

#### Team Member Creation (`/api/team/create-member`)

```typescript
const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
  id: newUser.user.id,
  email: email,
  full_name: displayName || email.split('@')[0],
  currency: 'INR',
  account_type: 'team_member', // ✅ Mark as team member
})
```

**Purpose:** When owners create team members, explicitly set `account_type='team_member'` in the profiles table.

---

### 3. **Login Page Changes**

#### Owner Login (`/login`)

```typescript
// Check account_type BEFORE allowing login
const { data: profile } = await supabase
  .from('profiles')
  .select('account_type')
  .eq('id', data.user.id)
  .single()

// Reject team members
if (profile.account_type === 'team_member') {
  await supabase.auth.signOut()
  setError('Team members must use the team login page.')
  setTimeout(() => router.push('/team-login'), 2000)
  return
}
```

#### Team Login (`/team-login`)

```typescript
// Check account_type BEFORE allowing login
const { data: profile } = await supabase
  .from('profiles')
  .select('account_type')
  .eq('id', data.user.id)
  .single()

// Reject owners
if (profile.account_type === 'owner') {
  await supabase.auth.signOut()
  toast.error('Agency owners must use the main login page')
  setTimeout(() => router.push('/login'), 1500)
  return
}
```

**Purpose:** Enforce strict login separation at the page level IMMEDIATELY after authentication.

---

### 4. **Middleware Changes**

Updated middleware to use `account_type` from profiles instead of checking `organization_members`:

```typescript
// Get account_type from profiles (more reliable)
const { data: profile } = await supabase
  .from('profiles')
  .select('account_type')
  .eq('id', session.user.id)
  .maybeSingle()

const accountType = profile?.account_type

// Route based on account_type
if (accountType === 'owner' && isTeamMemberPath) {
  return NextResponse.redirect(new URL('/dashboard', req.url))
}

if (accountType === 'team_member' && isOwnerPath) {
  return NextResponse.redirect(new URL('/teammate/dashboard', req.url))
}
```

**Purpose:** Prevent owners from accessing team member routes and vice versa at the routing level.

---

### 5. **Type System Updates**

#### `database.ts`

```typescript
export type AccountType = 'owner' | 'team_member'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  timezone: string
  default_reminder_minutes: number
  currency: string
  account_type: AccountType // ✅ Added
  created_at: string
  updated_at: string
}
```

---

## 🔒 Security Flow

### Owner Signup/Login Flow

1. User signs up via `/signup` → Creates auth.users entry
2. `handle_new_user()` trigger fires → Creates profile with `account_type='owner'`
3. User logs in via `/login` → Checks `account_type='owner'` → ✅ Allowed
4. Middleware routes to `/dashboard` and owner-only areas

### Team Member Creation Flow

1. Owner creates team member via UI → Calls `/api/team/create-member`
2. API uses Admin SDK to create auth.users entry (no email verification)
3. API creates profile with `account_type='team_member'` ⚠️ **Critical**
4. API adds entry to `organization_members` table

### Team Member Login Flow

1. Team member logs in via `/team-login` → Authenticates with Supabase
2. Login page checks `account_type='team_member'` → ✅ Allowed
3. If `account_type='owner'` → ❌ Rejected, redirected to `/login`
4. Middleware routes to `/teammate/dashboard` and team member areas

### Cross-Login Prevention

- Owner tries `/team-login` → ❌ Rejected immediately after auth
- Team member tries `/login` → ❌ Rejected immediately after auth
- Middleware enforces routing rules based on `account_type`

---

## 📝 Migration Instructions

### Option 1: Run Individual Migrations (Recommended)

```bash
# In Supabase SQL Editor, run in order:
1. supabase/migrations/20260105_add_account_type_to_profiles.sql
2. supabase/migrations/20260105_update_user_creation_trigger_with_account_type.sql
```

### Option 2: Run Complete Fix (All-in-One)

```bash
# In Supabase SQL Editor:
supabase/APPLY_ACCOUNT_TYPE_FIX.sql
```

### Verification Queries

```sql
-- Check account_type distribution
SELECT account_type, COUNT(*) as count
FROM profiles
GROUP BY account_type;

-- Verify team members
SELECT p.email, p.account_type, om.role
FROM profiles p
LEFT JOIN organization_members om ON p.id = om.user_id
ORDER BY p.account_type, p.email;

-- Check for missing account_types (should be 0)
SELECT COUNT(*)
FROM profiles
WHERE account_type IS NULL;
```

---

## 🧪 Testing Checklist

### Owner Tests

- [ ] Owner can sign up via `/signup`
- [ ] Owner can login via `/login`
- [ ] Owner CANNOT login via `/team-login`
- [ ] Owner can access `/dashboard`, `/clients`, `/team`, etc.
- [ ] Owner CANNOT access `/teammate/*` routes

### Team Member Tests

- [ ] Team member can be created by owner
- [ ] Team member receives `account_type='team_member'` in profile
- [ ] Team member can login via `/team-login`
- [ ] Team member CANNOT login via `/login`
- [ ] Team member can access `/teammate/dashboard`, `/teammate/tasks`
- [ ] Team member CANNOT access owner routes (`/dashboard`, `/clients`, etc.)

### Edge Cases

- [ ] Existing users are correctly classified
- [ ] New signups get `account_type='owner'`
- [ ] OAuth signups get `account_type='owner'`
- [ ] Middleware redirects work correctly
- [ ] No infinite redirect loops

---

## 🚀 Deployment Steps

1. **Apply Database Migrations**

   ```bash
   # Run in Supabase SQL Editor
   supabase/APPLY_ACCOUNT_TYPE_FIX.sql
   ```

2. **Deploy Code Changes**

   ```bash
   git add .
   git commit -m "fix: Add account_type separation for owners and team members"
   git push origin main
   ```

3. **Verify on Production**

   - Test owner login at `/login`
   - Test team member login at `/team-login`
   - Verify cross-login prevention works
   - Check that existing users can still login

4. **Monitor for Issues**
   - Check Vercel logs for auth errors
   - Monitor Supabase logs for RLS policy violations
   - Test with multiple users simultaneously

---

## 📚 Files Modified

### Database

- `supabase/migrations/20260105_add_account_type_to_profiles.sql` (new)
- `supabase/migrations/20260105_update_user_creation_trigger_with_account_type.sql` (new)
- `supabase/APPLY_ACCOUNT_TYPE_FIX.sql` (new, all-in-one)

### Backend

- `src/app/api/team/create-member/route.ts` (modified)

### Frontend

- `src/app/login/page.tsx` (modified)
- `src/app/team-login/page.tsx` (modified)
- `src/middleware.ts` (modified)
- `src/contexts/AuthContext.tsx` (modified)

### Types

- `src/types/database.ts` (modified)

---

## 🔍 Troubleshooting

### Issue: "Unable to verify account type"

**Cause:** Profile doesn't have `account_type` field.
**Fix:** Run migration SQL to add the column.

### Issue: Team member can still login via `/login`

**Cause:** Profile has `account_type='owner'` instead of `'team_member'`.
**Fix:** Manually update the profile:

```sql
UPDATE profiles
SET account_type = 'team_member'
WHERE email = 'teammember@example.com';
```

### Issue: Owner gets rejected at `/login`

**Cause:** Profile has `account_type='team_member'`.
**Fix:** Update to owner:

```sql
UPDATE profiles
SET account_type = 'owner'
WHERE email = 'owner@example.com';
```

### Issue: New signups get wrong account_type

**Cause:** Trigger not updated.
**Fix:** Run the trigger update migration.

---

## ✨ Summary

This fix implements a **secure, database-level separation** between agency owners and team members by:

1. ✅ Adding `account_type` enum to profiles table
2. ✅ Setting all new signups as `'owner'` by default
3. ✅ Marking team members as `'team_member'` when created by owners
4. ✅ Enforcing login page restrictions based on `account_type`
5. ✅ Preventing cross-login at both page and middleware levels
6. ✅ Using reliable, fast database queries instead of complex joins

**Result:** Clean separation, no mixups, secure authentication! 🎉
