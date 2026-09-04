-- Notes can now hang off a contact, a deal, or both, and can record that
-- an email was sent rather than just what happened.
--
-- Until now every note belonged to exactly one deal. That left two gaps:
-- a person you have spoken to but have no deal with had nowhere to record
-- it, and an email drafted in the app disappeared the moment it was
-- copied, so the deal's history showed silence where there had been
-- contact. The momentum analysis reasons about gaps between notes, so an
-- unlogged email actively makes a live deal look dead.

alter table notes alter column deal_id drop not null;

alter table notes
  add column if not exists contact_id uuid references contacts (id) on delete cascade;

-- 'note' is something that happened; 'email' is a message that was sent.
-- Kept as a column rather than inferred from the text so the timeline can
-- mark them differently without parsing prose.
alter table notes
  add column if not exists kind text not null default 'note';

alter table notes drop constraint if exists notes_kind_check;

alter table notes
  add constraint notes_kind_check check (kind in ('note', 'email'));

-- A note with neither parent belongs to nothing and would be invisible in
-- every view. The database refuses it rather than leaving orphans that
-- only surface as a confusing empty count somewhere.
alter table notes drop constraint if exists notes_has_parent_check;

alter table notes
  add constraint notes_has_parent_check
  check (deal_id is not null or contact_id is not null);

create index if not exists notes_contact_id_idx on notes (contact_id);
