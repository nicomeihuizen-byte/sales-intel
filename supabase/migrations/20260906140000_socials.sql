-- One LinkedIn URL becomes a list of socials, on contacts and on
-- companies both.
--
-- The single column was a bet that LinkedIn is the only profile worth
-- keeping, and for a B2B pipeline that is nearly true. Nearly is the
-- problem: the founder of a small company is on X, the CTO's real activity
-- is on GitHub, and the marketing lead you are actually selling to lives
-- on Instagram. A column named after one network is a schema that argues
-- with the person filling it in, and the way people win that argument is
-- by pasting an X profile into a box labelled LinkedIn - which is worse
-- than either, because now the label lies.
--
-- Same shape as the emails/phones change in 20260904090000, deliberately.
-- Three list fields that behave identically are one thing to learn; two
-- lists and a special case is three.
--
-- Both tables in one migration because they are the same field. Contacts
-- and companies each carrying a differently-named version of "where they
-- are on the internet" is exactly the drift this is fixing.

alter table contacts
  add column if not exists socials text[] not null default '{}';

alter table companies
  add column if not exists socials text[] not null default '{}';

-- Backfill before dropping, in the same migration so the whole thing is
-- one transaction: either the copy and the drop both happen, or neither
-- does. A blank or whitespace-only old value becomes an empty list rather
-- than a list holding one empty string.
--
-- Guarded and EXECUTEd as a string, for the reason spelled out in
-- 20260904090000: a plain UPDATE parses on every run and fails the moment
-- the old column is gone, which is what a second `db:reset` against a
-- partly-migrated database does.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'contacts'
      and column_name = 'linkedin_url'
  ) then
    execute $backfill$
      update contacts
      set socials = case
            when linkedin_url is not null and btrim(linkedin_url) <> ''
              then array[btrim(linkedin_url)]
            else '{}'
          end
      where cardinality(socials) = 0
    $backfill$;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name = 'linkedin_url'
  ) then
    execute $backfill$
      update companies
      set socials = case
            when linkedin_url is not null and btrim(linkedin_url) <> ''
              then array[btrim(linkedin_url)]
            else '{}'
          end
      where cardinality(socials) = 0
    $backfill$;
  end if;
end
$$;

alter table contacts drop column if exists linkedin_url;
alter table companies drop column if exists linkedin_url;
