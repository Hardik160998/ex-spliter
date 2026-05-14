-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Trips
create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

-- Trip Members
create table trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'contributor' check (role in ('owner', 'contributor')),
  display_name text,
  created_at timestamptz default now(),
  unique(trip_id, user_id)
);

-- Expenses
create table expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid not null references trip_members(id) on delete cascade,
  description text not null,
  amount numeric(10,2) not null check (amount > 0),
  category text not null default 'Other',
  created_at timestamptz default now()
);

-- Trip Invites
create table trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  email text not null,
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz default now()
);

-- Enable RLS
alter table trips enable row level security;
alter table trip_members enable row level security;
alter table expenses enable row level security;
alter table trip_invites enable row level security;

-- trips: no subquery, owner sees their own rows directly
create policy "members can view trips" on trips for select
  using (owner_id = auth.uid());

create policy "owner can insert trips" on trips for insert
  with check (owner_id = auth.uid());

create policy "owner can update trips" on trips for update
  using (owner_id = auth.uid());

-- trip_members: no subquery, users see only their own rows
create policy "members can view trip_members" on trip_members for select
  using (user_id = auth.uid());

create policy "members can insert trip_members" on trip_members for insert
  with check (user_id = auth.uid());

-- expenses: trip_members policy has no subquery so this is safe
create policy "members can view expenses" on expenses for select
  using (member_id in (select id from trip_members where user_id = auth.uid()));

create policy "members can insert expenses" on expenses for insert
  with check (trip_id in (select trip_id from trip_members where user_id = auth.uid()));

-- trip_invites: owner can create
create policy "owner can create invites" on trip_invites for insert
  with check (trip_id in (select id from trips where owner_id = auth.uid()));
