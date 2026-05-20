# TripSplit — Group Expense Tracker

A modern group expense tracker with trip history, email invitations, and support for manual (offline) members.

**Tech Stack:** React + Vite, Tailwind CSS, Supabase (Auth, Postgres, RLS, Edge Functions)

---

## Setup

### 1. Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. In **SQL Editor**, run migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_manual_members.sql`
   - `supabase/migrations/20260518000000_add_expense_update.sql`
   - `supabase/migrations/20260518000001_add_delete_policies.sql`
3. Deploy the two edge functions (see below)

### 2. Environment Variables

Edit `.env.local` with your Supabase project credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Both values are found in **Project Settings → API**.

### 3. Deploy Edge Functions

```bash
supabase login
supabase link --project-ref your-project-id
supabase functions deploy create-invite
supabase functions deploy handle-invite
```

### 4. Run Locally

```bash
npm install
npm run dev
```

---

## Features

| Feature | Details |
|---|---|
| Auth | Email/password signup and sign-in via Supabase Auth |
| Profile | Display name, mobile, avatar upload |
| Dashboard | Active trips + completed trip history |
| Create Trip | Owner auto-added as first member with `base_currency` |
| Add Member | Trip owner can add registered members by email OR manual members by name (no account needed) |
| Invite Friend | Trip owner enters email → `create-invite` sends an actual email with an invite link |
| Accept Invite | Invited user clicks link from email → logs in/signs up → automatically joins the trip as `contributor` |
| Add Expense | Description, amount, payer dropdown (shows all members), category |
| Paid By Any Member | Logged-in user can add an expense on behalf of any trip member |
| Trip Summary | Total spent + breakdown by category |
| Members Tab | See all members and their individual totals (Manual / Registered badges) |
| Settle Up | Smart settlement suggestions (who owes whom) |
| Mark Complete | Owner can complete/reopen a trip |

---

## Database Schema

```
trips            → id, name, status, owner_id, base_currency, created_at
trip_members     → id, trip_id, user_id (nullable), role, display_name, source ('manual' | 'registered'), added_by
expenses         → id, trip_id, member_id, description, amount, category
trip_invites     → id, trip_id, email, token, expires_at, used_at
profiles         → id, display_name, mobile, avatar_url
```

---

## Invite Flow

1. **Trip owner** clicks **Invite** in the trip header and enters a friend's email
2. `create-invite` edge function:
   - Inserts a `trip_invites` row
   - Sends an invite email via Supabase Auth SMTP
3. Friend clicks the link in their email → opens TripSplit → signs in or signs up
4. `handle-invite` edge function adds them to the trip as `contributor`
5. If the manual member with a matching display name already exists in the trip, their record is upgraded to `registered` automatically
6. Friend can view the trip and add expenses immediately

---

## Manual Members

### What are Manual Members?
Members added by name only — no account or email required. Perfect for family or friends who don't use the app.

### Adding Manual Members
1. Create a trip → expand **Members** section
2. Type a name (e.g. "Raj") and click **+ Add**
3. They appear immediately in the trip member list with a **Manual** badge

### Adding Expenses on Behalf of Others
When adding an expense, use the **Paid By** dropdown to select any member (manual or registered).

### Member Upgrade (Manual → Registered)
If a manual member later signs up via invite:
1. Their name in the trip matches their email prefix (e.g. "Raj" matches `raj@email.com`)
2. On invite redemption, the `link_manual_member` function finds and upgrades their record
3. All their expenses and history are preserved
4. No duplicate member entries

