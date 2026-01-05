# 🎯 Complete Project Management System - Implementation Plan

## Overview

Transforming Clienter into a full **Client → Projects → Team Management** system.

## Architecture

```
Client
  └── Multiple Projects
        ├── Assigned Team Members
        ├── Project Tasks
        ├── Project Updates
        └── Team Payments/Expenses
```

## Database Schema Changes

### New Tables Created:

1. **projects** - Core project information
2. **project_team_members** - Team assignments to projects
3. **project_tasks** - Tasks within projects
4. **project_updates** - Project notes/updates

### Updated Tables:

1. **expenses** - Now links to `project_id` and `project_team_member_id`

## Step-by-Step Implementation

### Phase 1: Database Migration ✅

**File**: `supabase/migrations/20260105_create_projects_system.sql`

**Run this in Supabase SQL Editor**

This creates:

- Projects table
- Project team members table
- Project tasks table
- Project updates table
- Updates expenses to link to projects
- Creates comprehensive views

### Phase 2: TypeScript Types ✅

**File**: `src/types/database.ts`

Added:

- `Project` interface
- `ProjectTeamMember` interface
- `ProjectTask` interface
- `ProjectUpdate` interface
- Updated `Expense` interface with `project_id`
- New earning views interfaces

### Phase 3: Update Expenses Page (NEXT)

**Key Changes Needed in** `src/app/expenses/page.tsx`:

1. **Default to Team Payment**:

```typescript
const [newExpense, setNewExpense] = useState({
  expense_type: 'team' as ExpenseType, // Changed from 'other'
  // ...
})
```

2. **Add Projects State**:

```typescript
const [assignedProjects, setAssignedProjects] = useState<ProjectWithDetails[]>([])
```

3. **Fetch Assigned Projects** (only projects where user is assigned):

```typescript
const fetchAssignedProjects = async () => {
  if (!organization) return

  const { data, error } = await supabase
    .from('project_team_members')
    .select(
      `
      *,
      project:projects(
        *,
        client:clients(*)
      )
    `
    )
    .eq('team_member_id', user!.id)
    .eq('status', 'active')

  if (!error && data) {
    setAssignedProjects(data.map((d) => d.project))
  }
}
```

4. **Update Form to Show Projects Instead of Team Members**:

```tsx
{newExpense.expense_type === 'team' ? (
  <>
    <div>
      <label>Select Project *</label>
      <select
        required
        value={newExpense.project_id}
        onChange={(e) => {
          const project = assignedProjects.find(p => p.id === e.target.value)
          setNewExpense({
            ...newExpense,
            project_id: e.target.value,
            project_name: project?.name || ''
          })
        }}
      >
        <option value="">Select project</option>
        {assignedProjects.map((project) => (
          <option key={project.id} value={project.id}>
            {project.client.name} - {project.name}
          </option>
        ))}
      </select>
    </div>

    <div>
      <label>Total Cost *</label>
      <input
        type="number"
        required
        value={newExpense.total_amount}
        onChange={(e) => setNewExpense({ ...newExpense, total_amount: e.target.value })}
        placeholder="Total project cost"
      />
    </div>

    <div>
      <label>Initial Payment</label>
      <input
        type="number"
        value={newExpense.initial_payment}
        onChange={(e) => setNewExpense({ ...newExpense, initial_payment: e.target.value })}
        placeholder="Amount to pay now (optional)"
      />
    </div>
  </>
) : (
  // Other expense fields
)}
```

5. **Handle Initial Payment on Submit**:

```typescript
const handleAddExpense = async (e: React.FormEvent) => {
  e.preventDefault()

  if (newExpense.expense_type === 'team') {
    // Create expense
    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .insert([
        {
          user_id: user!.id,
          organization_id: organization?.organizationId || null,
          expense_type: 'team',
          project_id: newExpense.project_id,
          team_member_id: user!.id, // Current user for their own project
          total_amount: parseFloat(newExpense.total_amount),
          paid_amount: 0,
          payment_status: 'pending',
          description: newExpense.description || 'Team payment for project',
        },
      ])
      .select()

    if (!expenseError && expenseData) {
      // If initial payment, create payment record
      if (newExpense.initial_payment && parseFloat(newExpense.initial_payment) > 0) {
        await supabase.from('team_payment_records').insert([
          {
            expense_id: expenseData[0].id,
            amount: parseFloat(newExpense.initial_payment),
            payment_type: 'advance',
            payment_date: format(new Date(), 'yyyy-MM-dd'),
            notes: 'Initial payment',
            created_by: user!.id,
          },
        ])
      }

      fetchExpenses()
      setShowAddExpense(false)
      toast.success('Expense added successfully!')
    }
  }
}
```

### Phase 4: Create Projects Management Page

**New File**: `src/app/projects/page.tsx`

This page should:

1. List all projects for the organization
2. Show project status, budget, team members
3. Allow creating new projects
4. Link to project details

**New File**: `src/app/projects/[id]/page.tsx`

Project details page with:

- Project information
- Team members assigned
- Tasks list
- Updates/notes
- Financial summary

### Phase 5: Update Dashboard

**File**: `src/app/dashboard/page.tsx`

Changes needed:

1. Fetch team member's project earnings by project
2. Show monthly earnings grouped by month
3. Display only projects assigned to the user
4. Show project-wise breakdown

```typescript
// Fetch project-wise earnings
const { data: projectEarnings } = await supabase
  .from('team_member_project_earnings')
  .select('*')
  .eq('team_member_id', user.id)

// Fetch monthly earnings
const { data: monthlyEarnings } = await supabase
  .from('team_member_monthly_earnings')
  .select('*')
  .eq('team_member_id', user.id)
  .order('month', { ascending: false })
  .limit(6)
```

### Phase 6: Update Clients Page

**File**: `src/app/clients/page.tsx`

Changes:

1. Show list of projects per client
2. Add button to create new project for client
3. Link to project details

### Phase 7: Update Navigation

**File**: `src/components/Sidebar.tsx`

Add Projects link:

```tsx
<Link href="/projects">
  <Briefcase className="w-5 h-5" />
  Projects
</Link>
```

## UI/UX Flow

### For Agency Owner:

1. **Onboard Client** → Go to Clients → Add New Client
2. **Create Project** → From client details → Add Project
3. **Assign Team** → In project details → Assign team members with budgets
4. **Add Payments** → Go to Expenses → Add team payment → Select project → Record payment
5. **Track Progress** → Project details shows tasks, updates, financial summary

### For Team Member:

1. **View Assigned Projects** → Dashboard shows their projects
2. **See Tasks** → Project details shows their tasks
3. **Track Earnings** → Dashboard shows:
   - Total earnings across all projects
   - Per-project breakdown
   - Monthly revenue history
   - Pending payments
4. **Add Updates** → Can add notes/updates to projects they're assigned to

## Data Flow

```
Client Created
  └──> Project Created (linked to client)
        └──> Team Members Assigned (with allocated budgets)
              └──> Expenses Created (for team payments)
                    └──> Payment Records Added
                          └──> Auto-updates:
                                - project_team_members.total_paid
                                - projects.total_paid
                                - expense.paid_amount
                                - expense.payment_status
```

## Key Features

### ✅ Project Management

- Create multiple projects per client
- Track project status, budget, deadlines
- Assign team members with specific roles and budgets
- Task management within projects
- Project updates/notes system

### ✅ Team Assignment

- Assign specific team members to projects
- Set allocated budget per team member per project
- Track payment status per team member
- Team members see only their assigned projects

### ✅ Payment Tracking

- Record payments against specific projects
- Support for initial payment + multiple installments
- Auto-calculate paid/pending amounts
- Payment history with dates and types

### ✅ Earnings Dashboard

- Project-wise earnings for each team member
- Monthly revenue breakdown
- Combined totals across all projects
- Pending payments visibility

### ✅ Security (RLS)

- Team members can only see their assigned projects
- Owners/admins can see all projects
- Proper access control on all tables
- Secure payment recording

## Testing Checklist

After implementation:

- [ ] Run database migration successfully
- [ ] Create a new client
- [ ] Create a project for that client
- [ ] Assign team member to project with budget
- [ ] (As owner) Add team payment for that project
- [ ] Record initial payment
- [ ] Record additional installment
- [ ] Verify amounts auto-update
- [ ] (As team member) Login and see project in dashboard
- [ ] Verify earnings show correctly
- [ ] Check monthly breakdown
- [ ] Create project task
- [ ] Add project update
- [ ] Verify team member can see tasks and updates
- [ ] Test project filters and search
- [ ] Verify pending amounts are correct
- [ ] Check that team member can't see other projects

## Migration Strategy

### For Existing Data:

**Option 1: Auto-migrate (Safe)**
The migration includes a commented-out section that can auto-create one project per existing client. To enable:

1. Uncomment the INSERT statement at the end of the migration
2. Run the migration
3. All existing clients get a default project
4. You can then assign team members manually

**Option 2: Manual (Recommended)**

1. Run migration (creates empty projects table)
2. Keep existing expenses as "other" type
3. Start fresh with new client → project flow
4. Migrate old data gradually through UI

## File Structure

```
src/
├── app/
│   ├── clients/
│   │   ├── page.tsx (updated)
│   │   └── [id]/
│   │       └── page.tsx (show projects list)
│   ├── projects/ (NEW)
│   │   ├── page.tsx (projects list)
│   │   ├── new/
│   │   │   └── page.tsx (create project)
│   │   └── [id]/
│   │       ├── page.tsx (project details)
│   │       ├── tasks/
│   │       │   └── page.tsx (project tasks)
│   │       └── team/
│   │           └── page.tsx (manage team)
│   ├── expenses/
│   │   └── page.tsx (updated with projects)
│   └── dashboard/
│       └── page.tsx (updated with project earnings)
├── components/
│   └── Sidebar.tsx (add Projects link)
└── types/
    └── database.ts (updated) ✅
```

## Next Steps

1. ✅ Run database migration
2. ✅ Update types
3. Update expenses page with project dropdown
4. Create projects management pages
5. Update dashboard with project earnings
6. Update clients page to show projects
7. Test complete flow

## Summary

This transforms Clienter into a comprehensive project management system where:

- Clients have multiple projects
- Projects are assigned to team members
- Payments are tracked per project
- Team members see only their projects
- Complete task and update management
- Detailed earnings tracking

Everything is interconnected and synced automatically! 🚀
