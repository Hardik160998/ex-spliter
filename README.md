# TripSplit — Group Expense Tracker

A full-stack group expense tracker with trip history and direct member management.

**Tech Stack:** React + Vite, Tailwind CSS, Supabase (Auth, Postgres, RLS)

---

## Setup

### 1. Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. In **SQL Editor**, run migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_add_trip_member_by_email.sql` (adds `add_trip_member_by_email` RPC for owners adding members by email)

### 2. Environment Variables

Edit `.env.local` with your Supabase project credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Both values are found in **Project Settings → API**.

### 3. Run Locally

```bash
npm install
npm run dev
```

---

## Features

| Feature | Details |
|---|---|
| Auth | Email/password via Supabase Auth |
| Dashboard | Active Trips + History (completed trips) |
| Create Trip | Owner auto-added as first member |
| Add member | Trip owner enters a member’s signup email; Postgres RPC `add_trip_member_by_email` adds them as `contributor` if `auth.users` has that email |
| Add Expense | Description, Amount, Payer (dropdown), Category |
| Trip Summary | Total spent + breakdown by category |
| Mark Complete | Owner can settle a trip, moves it to History |

## Database Schema

```
trips          → id, name, status, owner_id, base_currency, created_at
trip_members   → id, trip_id, user_id, role, display_name
expenses       → id, trip_id, member_id, description, amount, category
profiles       → id, display_name, mobile, avatar_url
```

(`trip_invites` may still exist from older migrations but is unused.)

## Add member flow

1. Trip owner opens the trip and clicks **+ Member**.
2. They enter the email address the person used to sign up for TripSplit.
3. The `add_trip_member_by_email` database function checks you are the owner, resolves the email in `auth.users`, and inserts `trip_members` with role `contributor`.
4. That user sees the trip on their dashboard (no invite link).
