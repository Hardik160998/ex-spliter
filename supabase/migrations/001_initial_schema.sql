-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Trips
create table trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  base_currency text default '₹',
  created_at timestamptz default now()
);

-- Trip Members
create table trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'contributor' check (role in ('owner', 'contributor')),
  display_name text not null,
  source text not null default 'manual' check (source in ('manual', 'registered')),
  added_by uuid references auth.users(id),
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

-- Profiles
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  mobile text,
  avatar_url text,
  updated_at timestamptz default now()
);

-- Enable RLS
alter table trips enable row level security;
alter table trip_members enable row level security;
alter table expenses enable row level security;
alter table trip_invites enable row level security;
alter table profiles enable row level security;

-- trips: owner sees their own rows directly
create policy "members can view trips" on trips for select
  using (owner_id = auth.uid());

create policy "owner can insert trips" on trips for insert
  with check (owner_id = auth.uid());

create policy "owner can update trips" on trips for update
  using (owner_id = auth.uid());

-- trip_members: users see only their own rows
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

-- profiles: users can view and update their own profile
create policy "users can view their profile" on profiles for select
  using (id = auth.uid());

create policy "users can insert their profile" on profiles for insert
  with check (id = auth.uid());

create policy "users can update their profile" on profiles for update
  using (id = auth.uid());

-- Indexes
create index if not exists idx_trip_members_trip_id on trip_members(trip_id);
create index if not exists idx_expenses_trip_id on expenses(trip_id);

-- Function to get trip members
create or replace function get_trip_members(p_trip_id uuid)
returns table (
  id uuid,
  trip_id uuid,
  user_id uuid,
  role text,
  display_name text,
  source text,
  added_by uuid,
  created_at timestamptz
) language sql security definer as $$
  select tm.id, tm.trip_id, tm.user_id, tm.role, tm.display_name, tm.source, tm.added_by, tm.created_at
  from trip_members tm
  where tm.trip_id = p_trip_id;
$$;

-- RPC: add_manual_member
create or replace function add_manual_member(p_trip_id uuid, p_display_name text)
returns json language plpgsql security definer as $$
declare
  new_member record;
begin
  if not exists (
    select 1 from trips where id = p_trip_id and owner_id = auth.uid()
  ) then
    return json_build_object('error', 'Not authorized');
  end if;

  insert into trip_members (trip_id, user_id, role, display_name, source)
  values (p_trip_id, null, 'contributor', trim(p_display_name), 'manual')
  returning * into new_member;

  return json_build_object('success', true, 'member', json_build_object(
    'id', new_member.id,
    'display_name', new_member.display_name,
    'role', new_member.role,
    'source', new_member.source
  ));
end;
$$;

-- RPC: add_trip_member_by_email
create or replace function add_trip_member_by_email(p_trip_id uuid, p_email text)
returns json language plpgsql security definer as $$
declare
  target_user_id uuid;
  trip_owner_id uuid;
  target_display_name text;
begin
  select owner_id into trip_owner_id from trips where id = p_trip_id;
  if trip_owner_id != auth.uid() then
    return json_build_object('ok', false, 'error', 'Not authorized');
  end if;

  select id into target_user_id from auth.users where email = lower(p_email) limit 1;
  if target_user_id is null then
    return json_build_object('ok', false, 'error', 'User with this email not found. Ask them to sign up first.');
  end if;

  if exists (select 1 from trip_members where trip_id = p_trip_id and user_id = target_user_id) then
    return json_build_object('ok', false, 'error', 'Already a member');
  end if;

  select display_name into target_display_name from profiles where id = target_user_id;

  insert into trip_members (trip_id, user_id, role, display_name, source)
  values (p_trip_id, target_user_id, 'contributor',
          coalesce(target_display_name, split_part(p_email, '@', 1)),
          'registered')
  returning id into target_user_id;

  return json_build_object('ok', true, 'member_id', target_user_id);
exception
  when unique_violation then
    return json_build_object('ok', false, 'error', 'Already a member');
  when others then
    return json_build_object('ok', false, 'error', sqlerrm);
end;
$$;

-- RPC: link_manual_member
create or replace function link_manual_member(p_trip_id uuid, p_user_id uuid, p_email text)
returns json language plpgsql security definer as $$
declare
  manual_member record;
  profile_name text;
begin
  select * into manual_member
  from trip_members
  where trip_id = p_trip_id
    and user_id is null
    and source = 'manual'
    and lower(display_name) = lower(split_part(p_email, '@', 1))
  limit 1;

  if not found then
    return json_build_object('linked', false, 'reason', 'No matching manual member');
  end if;

  select display_name into profile_name from profiles where id = p_user_id;

  update trip_members
  set user_id = p_user_id,
      source = 'registered',
      display_name = coalesce(profile_name, manual_member.display_name)
  where id = manual_member.id;

  return json_build_object('linked', true, 'member_id', manual_member.id);
end;
$$;
