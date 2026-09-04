-- Prospects: the five companies you are actively working right now.
--
-- The company list grows forever, and a list that grows forever is not a
-- work queue. This column marks the handful you have deliberately picked
-- to work this week, so the control centre shows five things to do rather
-- than everything you have ever spoken to.
--
-- A timestamp rather than a boolean, for two reasons. It is still a flag
-- (null means not picked), it gives the list a stable order, and it answers
-- the question the whole feature exists to raise: how long has this one
-- been sitting in your five without moving? A boolean cannot tell you that.
--
-- The cap of five is NOT enforced here. See lib/companies.ts.

alter table companies
  add column if not exists prospect_since timestamptz;

comment on column companies.prospect_since is
  'When this company was picked as one of the active prospects. Null means it is not picked. Capped at 5 per user in the application layer.';

-- Partial, because every query against this column asks for the picked
-- ones. The five rows that matter should not be found by scanning the
-- hundreds that do not.
create index if not exists companies_prospect_idx
  on companies (user_id, prospect_since)
  where prospect_since is not null;
