# 🚀 Quick Start Guide - Team Member System

## ⚡ Step-by-Step Implementation

### 1. Run the Database Migration

**Option A: Using Supabase Dashboard**

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste this SQL:

```sql
ALTER TABLE organization_members
ADD COLUMN IF NOT EXISTS password_for_sharing TEXT;

COMMENT ON COLUMN organization_members.password_for_sharing IS 'Plain text password for sharing with team members - not used for auth, just for reference';
```

5. Click **Run** or press `Ctrl + Enter`
6. You should see "Success. No rows returned"

**Option B: Using Supabase CLI** (if you have it set up)

```bash
cd d:\professional\clienter
supabase db push
```

### 2. Test as Owner

1. **Start your development server** (if not already running):

   ```bash
   npm run dev
   ```

2. **Open browser**: `http://localhost:3001`

3. **Login** as owner at `/login`

4. **Navigate to Team page**: Click "Team" in sidebar or go to `/team`

5. **Create a team member**:

   - Click **"Add Team Member"** button
   - Fill in the form:
     - Email: `designer@test.com`
     - Password: `password123`
     - Role: Select "Designer"
     - Display Name: `John Designer`
     - Notes: `UI/UX specialist` (optional)
   - Click **Create**

6. **View team member details**:

   - Click on the newly created team member row
   - You should see:
     - ✅ Stats (tasks, projects, earnings)
     - ✅ Credentials card with email, password, and login URL
     - ✅ Copy buttons for easy sharing

7. **Copy the credentials**:
   - Click "Copy All Credentials" button
   - Or individually copy email, password, and login URL

### 3. Test as Team Member

1. **Open a new incognito/private window**

2. **Go to the team login URL**:

   - `http://localhost:3001/team-login`
   - Or use the URL you copied from the credentials card

3. **Login with team member credentials**:

   - Email: `designer@test.com`
   - Password: `password123`

4. **Verify team member dashboard**:

   - ✅ Should land on `/team-dashboard`
   - ✅ See personalized greeting
   - ✅ See stats: Active Tasks, Completed Tasks, Projects, Earnings
   - ✅ Different sidebar (no Clients, Expenses, Team management)
   - ✅ Only see "Dashboard", "My Tasks", "My Projects", "Team"

5. **Test restrictions**:
   - Try accessing `/dashboard` → should redirect to `/team-dashboard`
   - Try accessing `/clients` → should redirect to `/team-dashboard`
   - Try accessing `/team` → should redirect to `/team-dashboard`

### 4. Test Role-Based Routing

**As Team Member** (in incognito window):

- ✅ Can access: `/team-dashboard`, `/tasks`, `/projects`
- ❌ Cannot access: `/dashboard`, `/clients`, `/expenses`, `/team`
- ✅ Trying to access `/login` → redirects to `/team-login`

**As Owner** (in regular window):

- ✅ Can access: `/dashboard`, `/clients`, `/team`, `/expenses`, etc.
- ❌ Cannot access: `/team-dashboard`
- ✅ Trying to access `/team-login` → redirects to `/login`

## 🎯 Expected Behavior

### Owner Experience:

1. Logs in at `/login`
2. Can create team members with credentials
3. Can view team member details and copy credentials
4. Can share credentials via email/Slack/etc.
5. Sees full agency dashboard with revenue metrics

### Team Member Experience:

1. Receives credentials from owner
2. Logs in at `/team-login`
3. Sees personalized dashboard with their own:
   - Active and completed tasks
   - Assigned projects
   - Individual earnings
4. Can manage their own tasks and view projects
5. Cannot access owner-only features

## 📊 What You Should See

### Team Member Dashboard (`/team-dashboard`)

```
┌─────────────────────────────────────────┐
│ Welcome back, John Designer!            │
│ Here's what's happening with your work  │
├─────────────────────────────────────────┤
│ [Active Tasks: 0]  [Completed: 0]       │
│ [Projects: 0]      [Earnings: ₹0]       │
├─────────────────────────────────────────┤
│ Your Active Tasks │ Your Projects       │
│ (Empty state)     │ (Empty state)       │
└─────────────────────────────────────────┘
```

### Team Member Detail Page (`/team/[memberId]`)

```
┌─────────────────────────────────────────┐
│ ← Back to Team                          │
├─────────────────────────────────────────┤
│ [Avatar] John Designer                  │
│          Designer | Joined 1/5/2026     │
├─────────────────────────────────────────┤
│ Stats:                                  │
│ • Active Tasks: 0                       │
│ • Completed Tasks: 0                    │
│ • Projects: 0                           │
│ • Total Earnings: ₹0                    │
├─────────────────────────────────────────┤
│ 🔐 Login Credentials                    │
│ Email: designer@test.com [📋]           │
│ Password: password123 [📋]              │
│ Login URL: http://localhost:3001/...   │
│ [Copy All Credentials]                  │
└─────────────────────────────────────────┘
```

## 🐛 Troubleshooting

### Issue: "Column password_for_sharing does not exist"

**Solution**: Run the database migration (see Step 1)

### Issue: Team member can't login

**Check**:

1. Is the team member created in Supabase Auth?
   - Go to Supabase Dashboard → Authentication → Users
2. Does the organization_members record exist?
   - Go to Supabase Dashboard → Table Editor → organization_members

### Issue: Redirecting to wrong dashboard

**Solution**:

1. Clear browser cache and cookies
2. Log out completely
3. Close all browser tabs
4. Try again in a fresh incognito window

### Issue: Stats showing 0

**This is expected** when:

- No tasks have been assigned yet
- No projects have been created
- No payments have been recorded

## ✅ Success Checklist

- [ ] Migration ran successfully
- [ ] Created a team member from `/team` page
- [ ] Clicked on team member row and saw detail page
- [ ] Saw credentials card with email, password, and login URL
- [ ] Copied credentials successfully
- [ ] Logged in as team member at `/team-login`
- [ ] Saw team member dashboard (not owner dashboard)
- [ ] Verified team member sidebar shows correct navigation
- [ ] Confirmed team member cannot access owner-only pages
- [ ] Confirmed owner cannot access `/team-dashboard`

## 🎉 Next Steps

Once everything is working:

1. **Share credentials with real team members**
2. **Assign tasks to team members**
3. **Add team members to projects**
4. **Record payments for team members**
5. **Watch the stats update in real-time!**

---

**Need Help?** Check the main documentation: [TEAM_MEMBER_SYSTEM_COMPLETE.md](TEAM_MEMBER_SYSTEM_COMPLETE.md)
