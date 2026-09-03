-- Constrain deals.status to the three values the app actually understands.
--
-- Until now `status` was a bare text column with a default of 'open', and
-- nothing stopped a typo from becoming a permanent state. That was
-- tolerable while the only writer was the seed script and a hardcoded
-- insert. It stops being tolerable now that status is editable from the
-- UI, because app/api/insight/route.ts branches on this value: an
-- unrecognised status silently falls through to the momentum read, which
-- is the wrong question for a closed deal and gives no sign that anything
-- went wrong.
--
-- If this migration fails, some row already holds a value outside the
-- three. Find it before forcing anything:
--   select distinct status from deals;

alter table deals drop constraint if exists deals_status_check;

alter table deals
  add constraint deals_status_check
  check (status in ('open', 'won', 'lost'));
