-- A company gets a description, and a place in a group.
--
-- Both come from the same evening of real prospecting: twenty companies
-- added by hand, at which point "Ober-Haus" stops being a name you
-- recognise, and the group behind it turns out to be four levels deep.
--
--
-- description
-- -----------
-- One line saying what they do. This is deliberately NOT the company notes
-- field that was argued against earlier, and the difference is worth
-- keeping straight: a description is a stable fact about who they are, the
-- same class as the address. It has no date, it does not decay, and there
-- is nothing in it that could hide from the timeline or the momentum read.
-- A notes box would have been all four of those things.
--
-- It is also NOT prospect_intent, the "why is this in my five" field still
-- queued. Intent belongs to the slot rather than the company, changes
-- month to month, and is supposed to go stale. One column meaning both
-- would mean neither.
--
--
-- parent_id
-- ---------
-- A self-reference, nullable, pointing at the company this one is part of.
--
-- The obvious alternative was a list of subsidiaries on the parent, which
-- is how it was first described. It does not work: a subsidiary is a
-- company in its own right, with its own address, VAT number,
-- registration number, contacts and deals. Ober-Haus signs contracts and
-- so does Kiinteistömaailma, and they are different legal entities in
-- different countries. Subsidiaries as entries on the parent's record
-- would produce half-companies that cannot hold a deal.
--
-- Pointing up rather than down also means the fact is stored once. A list
-- on the parent plus a link on the child is the same fact in two places,
-- which is the failure mode this project keeps returning to.
--
-- `on delete set null` and NOT cascade. This is the important line in the
-- file. A cascade here would mean deleting a parent silently deletes every
-- subsidiary, and through the existing cascades on deals and notes, their
-- entire history with it. Removing Realia from your book must not take
-- Ober-Haus and eleven months of call notes with it. Orphaning is the
-- correct failure: the group flattens, nothing is lost.
--
-- No cycle constraint here. Postgres cannot express "this graph has no
-- cycles" as a CHECK, and the trigger that could is the same argument as
-- the prospect cap in lib/companies.ts: a trigger can only refuse, and it
-- refuses as a raw exception where a sentence belongs. The guard lives in
-- setParent, walking up the chain before the write.

alter table companies
  add column if not exists description text,
  add column if not exists parent_id uuid references companies (id) on delete set null;

-- Foreign keys are not indexed automatically in Postgres. Without this,
-- "which companies point at this one" is a sequential scan, and that query
-- runs every time a company panel is opened.
create index if not exists companies_parent_id_idx on companies (parent_id);
