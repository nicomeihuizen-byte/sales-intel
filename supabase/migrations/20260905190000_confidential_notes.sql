-- A note or an email can be marked confidential, and a confidential one
-- is never sent to the model.
--
-- The app already keeps two kinds of note apart by who they belong to: a
-- note with no deal_id cannot move a deal's health score. This is the
-- other axis. Some of what gets written down is about the deal and still
-- has no business leaving the database: a price someone let slip, what a
-- contact said about their own boss, anything told to you in confidence.
-- Today the only way to keep that out of a prompt is not to write it down,
-- which means the record is worse precisely where it matters most.
--
-- `not null default false` rather than a nullable flag, and that is not a
-- style preference. A nullable boolean gives you three states, and the
-- filter `confidential = false` silently drops NULL rows - so the day a
-- row arrived with no value, a note nobody had marked either way would
-- vanish from the analysis without anyone noticing. The same three-valued
-- logic already produced one real bug in this schema, in the direction
-- check one migration ago.
--
-- The default is the safe direction here too, for once in the boring way:
-- a note nobody has thought about is an ordinary note, because a system
-- that hid things by default would quietly starve the analysis and the
-- verdicts would just get worse with no visible cause.

alter table notes
  add column if not exists confidential boolean not null default false;

-- The analysis reads "notes on this deal that are not confidential", which
-- is the shape this index is for. Partial, so it indexes only the rows the
-- query can return, and every confidential note stays out of it entirely.
create index if not exists notes_deal_id_analysis_idx
  on notes (deal_id)
  where confidential = false;
