# Quick Start Guide - Deploy Your Project Management System

## 🚀 5-Minute Deployment

### Step 1: Apply Database Migration (2 minutes)

1. Open your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `SIMPLE_PROJECTS_MIGRATION.sql`
5. Paste into the editor
6. Click **Run** (or press Ctrl+Enter)
7. Wait for "Success" message

**What this does:**

- Creates `projects` table
- Creates `project_team_members` table
- Adds `project_id` to `expenses` table
- Sets up Row Level Security
- Creates helpful views (`my_assigned_projects`, `project_summary`)
- Adds auto-update triggers

### Step 2: Verify Installation (1 minute)

Run this in SQL Editor to verify:

```sql
-- Test 1: Check tables exist
SELECT COUNT(*) FROM projects;
SELECT COUNT(*) FROM project_team_members;

-- Test 2: Check views work
SELECT * FROM my_assigned_projects LIMIT 1;
SELECT * FROM project_summary LIMIT 1;

-- Test 3: Test trigger
SELECT update_project_totals();
```

If all queries run without errors, you're good! ✅

### Step 3: Deploy Frontend (2 minutes)

Your code is already updated. Just deploy:

```bash
# If using Vercel
vercel deploy

# Or if running locally
npm run build
npm start
```

### Step 4: Test the System (3 minutes)

#### As Owner/Admin:

1. **Create a Client**

   - Go to Clients → Add New Client
   - Fill in: Name, Email, Phone

2. **Create a Project**
   - Click on the client
   - Click **"New Project"** button
   - Fill in:
     - Name: "Website Redesign"
     - Budget: 10000
     - Select the client
   - Assign team members:
     - Click **"Add Member"**
     - Select team member
     - Set Allocated Budget: 5000
   - Click **"Create Project"**

#### As Team Member:

3. **View Your Projects**

   - Navigate to **Projects**
   - Should see only projects you're assigned to

4. **Record a Payment**

   - Go to **Expenses**
   - Click **"Add Expense"**
   - Verify "Team Payment" is selected by default ✅
   - Select your project from dropdown ✅
   - Enter:
     - Title: "Phase 1 Development"
     - Total Cost: 3000
     - Initial Payment: 1000
   - Click **"Add Expense"**

5. **Add More Payments**

   - Find the expense in the list
   - Click **"Add Payment"**
   - Enter amount: 1000
   - Select payment type: "Milestone"
   - Click **"Record Payment"**
   - Repeat to add final payment

6. **Check Dashboard**
   - Go to **Dashboard**
   - Scroll to "My Project Earnings" section
   - Should see:
     - Total Projects: 1
     - Total Earned: 5000 (your allocated budget)
     - Total Received: 2000 (payments so far)
     - Pending: 3000
     - Recent payments listed

---

## ✅ Success Checklist

After deployment, verify these work:

### Navigation

- [ ] "Projects" link appears in sidebar
- [ ] Projects page loads without errors
- [ ] Can create new project
- [ ] Can view project details

### Expenses

- [ ] "Team Payment" is default selection
- [ ] Project dropdown shows only assigned projects
- [ ] Has two fields: "Total Cost" and "Initial Payment"
- [ ] Can add payment records
- [ ] Payment history displays correctly

### Dashboard

- [ ] Team earnings section appears (if assigned to projects)
- [ ] Shows correct project count
- [ ] Displays allocated budget
- [ ] Shows received amount
- [ ] Lists recent payments

### Auto-Updates

- [ ] Adding payment updates expense paid_amount
- [ ] Payment status changes (pending → partial → completed)
- [ ] Project total_paid updates
- [ ] Team member total_paid updates

---

## 🎯 Quick Feature Tour

### For Owners/Admins

**Projects Page** (`/projects`)

- See all organization projects
- Stats: Total projects, In progress, Budget, Paid
- Search and filter by status
- Click project to see details

**Create Project** (`/projects/new`)

- Select client
- Set budget and timeline
- Assign team members
- Set individual allocated budgets

**Project Details** (`/projects/[id]`)

- View budget progress
- See assigned team members
- Check recent payments
- Quick link to add payments

### For Team Members

**My Projects** (`/projects`)

- See only assigned projects
- View allocated budget per project
- Check payment status

**Record Payments** (`/expenses`)

- Default: Team Payment ✅
- Dropdown: Only assigned projects ✅
- Two fields: Total Cost + Initial Payment ✅
- Add installments over time

**View Earnings** (`/dashboard`)

- Total projects assigned
- Total allocated budget (earned)
- Amount received so far
- Pending payments
- Recent payment records

---

## 🔧 Configuration

### Default Values

The system uses these defaults (can be customized):

**New Expense Form:**

- `expense_type`: "team" (Team Payment)
- `date`: Current date
- `payment_type` for initial: "advance"

**New Project:**

- `status`: "planning"
- Team members: None (must assign manually)

**Project Status Options:**

- planning
- in_progress
- on_hold
- completed
- cancelled

**Payment Types:**

- advance (initial payment)
- milestone (payment for reaching milestone)
- regular (standard installment)
- final (last payment)

---

## 📊 Key Queries

### For Reports

```sql
-- Total earnings by team member
SELECT
  p.full_name,
  SUM(ptm.allocated_budget) as total_allocated,
  SUM(ptm.total_paid) as total_received,
  SUM(ptm.allocated_budget - ptm.total_paid) as pending
FROM project_team_members ptm
JOIN profiles p ON p.id = ptm.team_member_id
GROUP BY p.full_name;

-- Project summary with client
SELECT
  pr.name as project_name,
  c.name as client_name,
  c.company_name,
  pr.budget,
  pr.total_paid,
  pr.status,
  COUNT(ptm.id) as team_members
FROM projects pr
JOIN clients c ON c.id = pr.client_id
LEFT JOIN project_team_members ptm ON ptm.project_id = pr.id
GROUP BY pr.id, c.id;

-- Monthly revenue per team member
SELECT
  p.full_name,
  date_trunc('month', tpr.payment_date) as month,
  SUM(tpr.amount) as monthly_earnings
FROM team_payment_records tpr
JOIN profiles p ON p.id = tpr.team_member_id
GROUP BY p.full_name, month
ORDER BY month DESC, p.full_name;
```

---

## 🆘 Common Issues

### "No projects found" for team member

**Fix:** Assign them to a project:

```sql
INSERT INTO project_team_members (project_id, team_member_id, allocated_budget)
VALUES ('<project_id>', '<user_id>', 5000.00);
```

### "Total Cost" and "Initial Payment" fields missing

**Fix:** Make sure you're running the new expenses page. Check file exists:

```
src/app/expenses/page.tsx (not page.tsx.old or page.tsx.backup)
```

### Payment doesn't update project total

**Fix:** Trigger might not be working. Manually run:

```sql
SELECT update_project_totals();
```

### Can't see "Projects" in navigation

**Fix:** Clear browser cache or hard refresh (Ctrl+Shift+R)

---

## 🎉 You're All Set!

Your complete project management system is now live with:

✅ Client management  
✅ Project tracking  
✅ Team assignments  
✅ Budget allocations  
✅ Payment tracking  
✅ Installment support  
✅ Auto-synced totals  
✅ Team earnings dashboard

Everything works together seamlessly. Enjoy! 🚀

---

## 📚 Documentation

For detailed information, see:

- `COMPLETE_PROJECT_SYSTEM_GUIDE.md` - Full feature documentation
- `PROJECT_MANAGEMENT_IMPLEMENTATION.md` - Technical implementation details
- `SIMPLE_PROJECTS_MIGRATION.sql` - Database schema

For questions or issues, refer to the Troubleshooting section in the Complete Guide.
