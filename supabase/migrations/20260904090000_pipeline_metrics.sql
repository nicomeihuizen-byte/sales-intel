-- Deal value, close dates, multi-value contacts, and stored analyses.
--
-- Everything here exists to serve the metrics panel, which needs numbers
-- the database has never held: what a deal is worth, when it closed, and
-- what the AI last thought of it.

-- Deal value, in euros. numeric rather than a float: money in binary
-- floating point accumulates rounding errors, and a pipeline total is a
-- sum of many rows. Nullable, because a deal usually exists before anyone
-- has put a number on it, and a forced 0 would quietly drag the average
-- down while looking like data.
alter table deals
  add column if not exists value_eur numeric(14, 2);

-- When the deal stopped being open. Set by the app when status moves to
-- won or lost, cleared if it moves back to open. Existing won and lost
-- deals stay null, so the conversion-time metric ignores them rather than
-- inventing a date for them.
alter table deals
  add column if not exists closed_at timestamptz;

create index if not exists deals_status_idx on deals (status);

-- Contacts get lists instead of single values: people have a work address
-- and a personal one, a mobile and a desk line.
alter table contacts
  add column if not exists emails text[] not null default '{}',
  add column if not exists phones text[] not null default '{}';

-- Backfill before dropping, in the same migration so the whole thing is
-- one transaction: either both the copy and the drop happen, or neither
-- does. A blank or whitespace-only old value becomes an empty list rather
-- than a list holding one empty string.
--
-- Wrapped in a guard, and the statement is EXECUTEd as a string, so this
-- file stays safe to replay. A plain UPDATE here would parse on every run
-- and fail the moment the old columns are gone, which is exactly what a
-- second `db:reset` against a partly-migrated database does.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contacts'
      and column_name = 'email'
  ) then
    execute $backfill$
      update contacts
      set emails = case
            when email is not null and btrim(email) <> '' then array[btrim(email)]
            else '{}'
          end,
          phones = case
            when phone is not null and btrim(phone) <> '' then array[btrim(phone)]
            else '{}'
          end
      where cardinality(emails) = 0 and cardinality(phones) = 0
    $backfill$;
  end if;
end
$$;

alter table contacts drop column if exists email;
alter table contacts drop column if exists phone;

-- The last analysis for a deal, so the pipeline health meter can read a
-- number instead of making an API call per deal on every page load.
--
-- One row per deal (the unique constraint), replaced on each run rather
-- than appended: this is a cache of "what does the model currently think",
-- not a history. A history is a good idea later, and this is the table it
-- would grow out of - which is why analyzed_at is stored rather than
-- inferred.
create table if not exists deal_insights (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null unique references deals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  momentum text not null,
  reasoning text not null,
  analyzed_at timestamptz not null default now()
);

alter table deal_insights drop constraint if exists deal_insights_momentum_check;

alter table deal_insights
  add constraint deal_insights_momentum_check
  check (momentum in ('healthy', 'stalling', 'at_risk'));

create index if not exists deal_insights_user_id_idx on deal_insights (user_id);

alter table deal_insights enable row level security;

drop policy if exists "Users manage own deal insights" on deal_insights;

create policy "Users manage own deal insights" on deal_insights
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
