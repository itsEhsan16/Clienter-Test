# 🚀 Quick Setup Guide - Multi-Tenant Features

## You're seeing Team and Tasks links now!

The Team and Tasks pages are now visible in your sidebar. However, to make them **fully functional**, you need to run the database migrations.

---

## ⚡ Quick Setup (5 minutes)

### Step 1: Add Service Role Key

Add this to your `.env.local` file:

```env
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Where to find it:**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the **`service_role`** key (NOT the anon key)
5. Paste it in `.env.local`

### Step 2: Run Database Migrations

**Option A: Using Supabase Dashboard (Easiest)**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy and paste the content from `supabase/migrations/20260104_create_multi_tenant_structure.sql`
6. Click **Run**
7. Repeat for `supabase/migrations/20260104_migrate_existing_data_to_orgs.sql`

**Option B: Using Supabase CLI**

```bash
# If you have Supabase CLI installed
supabase db push
```

### Step 3: Restart Your Dev Server

```bash
# Stop the server (Ctrl+C)
# Start it again
npm run dev
```

### Step 4: Reload the Page

Refresh your browser at `localhost:3000/dashboard`

---

## ✅ What Will Happen After Migrations

1. **Your account will be auto-converted to an Organization Owner**
2. **An organization will be created** (named "Talagana Rajesh's Agency")
3. **All your existing data** (clients, meetings, expenses) will be linked to your organization
4. **You'll see your organization name and "Owner" badge** in the sidebar
5. **Team and Tasks pages will be fully functional**

---

## 🎯 Test the Features

### As Owner (You):

1. ✅ Go to `/team` → Add a team member
2. ✅ Go to `/tasks` → Create a task and assign it
3. ✅ See organization name in sidebar
4. ✅ See "Owner" badge

### As Team Member (Create One):

1. Create team member from `/team` page
2. Logout
3. Login with team member credentials
4. See their role badge (e.g., "Developer")
5. View only their assigned tasks
6. Team and Expenses links hidden for them

---

## 📁 Migration Files Location

```
d:\professional\clienter\
├── supabase/
│   └── migrations/
│       ├── 20260104_create_multi_tenant_structure.sql   ← Run this first
│       └── 20260104_migrate_existing_data_to_orgs.sql    ← Run this second
```

---

## 🐛 Troubleshooting

### "Add Team Member" button is disabled?

- Migrations haven't been run yet. Follow Step 2 above.

### "Database Setup Required" yellow banner?

- This means migrations aren't run. It's normal before setup.

### Can't create team member - "Service role key not found"?

- Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (Step 1)
- Restart dev server

### Still seeing old data structure?

- Make sure both migration files were run successfully
- Check Supabase Dashboard → Table Editor → You should see `organizations`, `organization_members`, `tasks`, `payments` tables

---

## 🎉 What You Get After Setup

### For Owners/Admins:

- ✅ Manage team members
- ✅ Assign roles (Designer, Developer, Editor, etc.)
- ✅ Create and assign tasks
- ✅ Track team member payments
- ✅ View all analytics
- ✅ Full control over everything

### For Team Members:

- ✅ View assigned tasks
- ✅ Update task status (Assigned → In Progress → Completed)
- ✅ View their earnings/payments
- ✅ Access shared clients and meetings
- ✅ See organization they belong to

---

## 📚 Complete Documentation

For detailed information, see:

- [MULTI_TENANT_IMPLEMENTATION_GUIDE.md](MULTI_TENANT_IMPLEMENTATION_GUIDE.md)

---

## 💡 Pro Tip

You can test both owner and team member views by:

1. Creating a team member from `/team` page
2. Opening an **incognito/private browser window**
3. Logging in as the team member
4. Comparing the two views side-by-side

---

**Need Help?** Check the console (F12 → Console tab) for any errors and error messages will guide you.
