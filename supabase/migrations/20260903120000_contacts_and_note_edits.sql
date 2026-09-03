-- Contacts, and editable notes.
--
-- Two separate needs that landed together after the first real day of use:
-- a company is a relationship with people in it, not just a name on a
-- deal, and a note typed in a hurry needs correcting afterwards.

-- Notes gain an updated_at. created_at deliberately stays untouched when a
-- note is edited: lib/ai.ts reasons about the GAPS between note dates, so
-- letting a typo fix move a note to today would silently rewrite the
-- momentum history of the deal it belongs to.
alter table notes
  add column if not exists updated_at timestamptz not null default now();

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  role text,
  email text,
  phone text,
  linkedin_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only `name` is required. A prospect often starts as a name and a
-- LinkedIn profile with no email yet, and a form that refuses that is a
-- form you work around instead of using.

create index if not exists contacts_company_id_idx on contacts (company_id);
create index if not exists contacts_user_id_idx on contacts (user_id);

alter table contacts enable row level security;

drop policy if exists "Users manage own contacts" on contacts;

create policy "Users manage own contacts" on contacts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
