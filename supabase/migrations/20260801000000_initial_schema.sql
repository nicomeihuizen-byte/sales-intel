-- Initial schema: companies, deals, notes.
--
-- This file was `supabase/schema.sql` until the local-development setup
-- landed. It moved here unchanged in substance so the Supabase CLI can
-- apply it: `supabase db reset` replays every file in this folder in
-- filename order, which is what provisions a local database with the same
-- tables, indexes and RLS policies as the hosted project.
--
-- From here on, NEVER edit this file to change the schema. Add a new
-- migration instead (`npm run db:migration -- <name>`). Editing an applied
-- migration means the local database and the hosted one silently disagree,
-- and once real deal data lives locally there is no re-running this from
-- scratch to find out.
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

-- `create policy` has no `if not exists` form, so a bare create fails on
-- the second run and takes the whole migration with it. Dropping first
-- makes this file safe to replay, which `supabase db reset` does every
-- time it rebuilds the local database.
drop policy if exists "Users manage own companies" on companies;
drop policy if exists "Users manage own deals" on deals;
drop policy if exists "Users manage own notes" on notes;

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
