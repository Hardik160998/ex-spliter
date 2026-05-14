# TripSplit — Group Expense Tracker

A full-stack group expense tracker with trip history and email invitations.

**Tech Stack:** React + Vite, Tailwind CSS v4, Supabase (Auth, DB, Edge Functions)

---

## Setup

### 1. Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`
3. Deploy the two Edge Functions (see below)

### 2. Environment Variables

Edit `.env.local` with your Supabase project credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

Both values are found in **Project Settings → API**.

### 3. Deploy Edge Functions

Install the [Supabase CLI](https://supabase.com/docs/guides/cli), then:

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
| Auth | Email/password via Supabase Auth |
| Dashboard | Active Trips + History (completed trips) |
| Create Trip | Owner auto-added as first member |
| Invite Friend | Generates a unique 7-day invite link; invited user gets `contributor` role |
| Add Expense | Description, Amount, Payer (dropdown), Category |
| Trip Summary | Total spent + breakdown by category |
| Mark Complete | Owner can settle a trip, moves it to History |

## Database Schema

```
trips          → id, name, status, owner_id, created_at
trip_members   → id, trip_id, user_id, role, display_name
expenses       → id, trip_id, member_id, description, amount, category
trip_invites   → id, trip_id, email, token, expires_at, used_at
```

## Invite Flow

1. Trip owner clicks **Invite** → enters friend's email → gets a shareable link
2. Friend opens the link → signs in/up → `handle-invite` Edge Function runs
3. Friend is added to `trip_members` with `contributor` role
4. Friend can now open the trip and add expenses
