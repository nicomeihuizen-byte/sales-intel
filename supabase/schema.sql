-- Sales Intelligence: Stalled-Deal Detection
-- Phase 2 schema: companies, deals, notes.
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query).
--
-- Ownership model: every row belongs to the auth.users row that created it
-- (user_id). Row Level Security enforces that a user can only see and
-- modify their own data. There is no cross-user sharing yet - that's the
-- multi-tenancy work called out as post-MVP in the README.

create extension if not exists "pgcrypto";

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Foreign keys are not indexed automatically in Postgres; without these,
-- every notes-for-a-deal or deals-for-a-company lookup is a sequential scan.
create index if not exists deals_company_id_idx on deals (company_id);
create index if not exists notes_deal_id_idx on notes (deal_id);
create index if not exists companies_user_id_idx on companies (user_id);
create index if not exists deals_user_id_idx on deals (user_id);
create index if not exists notes_user_id_idx on notes (user_id);

-- Row Level Security: a user can only see and modify their own rows.
-- App-level auth checks are not a substitute for this - it's the second,
-- database-enforced layer (see AGENTS.md).
alter table companies enable row level security;
alter table deals enable row level security;
alter table notes enable row level security;

create policy "Users manage own companies" on companies
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own deals" on deals
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage own notes" on notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
