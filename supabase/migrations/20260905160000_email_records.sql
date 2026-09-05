-- An email on the record is a subject, a body, and which way it went.
--
-- Until now the only way an email reached the history was through the
-- draft panel, which wrote `Sent: {subject}` and a blank line above the
-- body into `content`. That worked while every logged email was one the
-- app had just written for you: it could only ever be outbound, and the
-- subject only had to survive being read by a human.
--
-- It stops working the moment any email body can be pasted in. A reply
-- from a prospect, filed through that path, arrives in the analysis as
-- something you sent. The model reasons about momentum largely by the
-- difference between an unanswered outbound and an answer, so that single
-- mislabel is not a cosmetic problem: it turns the most encouraging thing
-- in a deal's history into the most worrying one.
--
-- So direction becomes a column rather than an inference, and the subject
-- stops being a string prefix that anything with a colon in it could
-- imitate.

alter table notes add column if not exists subject text;

-- 'outbound' is something you sent; 'inbound' is something you received.
-- Not 'sent'/'received', which read as past-tense verbs about the row
-- rather than as a property of the message, and go ambiguous the moment
-- anything is scheduled rather than sent.
alter table notes add column if not exists direction text;

-- Existing email rows predate the column and were all written by the
-- draft panel, which only ever logged outbound mail. That is a fact about
-- how the data got here, not a guess.
update notes
set direction = 'outbound'
where kind = 'email'
  and direction is null;

-- Lift the subject back out of the `Sent: ...` prefix the old action
-- wrote, so history logged before today reads the same as history logged
-- after it.
--
-- The body is taken by offset rather than by splitting on the blank line
-- again: an email body can perfectly well contain another blank line, and
-- split_part would silently drop everything after it. `+ 3` steps over
-- the two newlines and moves to the character after them.
--
-- Idempotent by the `subject is null` guard: a second run matches no rows.
-- Rows whose content never had the prefix keep a null subject, which is
-- allowed, rather than being handed a fabricated one.
update notes
set
  subject = nullif(
    substring(split_part(content, E'\n\n', 1) from 7),
    ''
  ),
  content = substr(content, length(split_part(content, E'\n\n', 1)) + 3)
where kind = 'email'
  and subject is null
  and content like 'Sent: %'
  and position(E'\n\n' in content) > 0;

-- The two new columns only mean anything on an email. A note carrying a
-- direction would be a row nothing in the app knows how to render, and
-- the check is cheaper than finding out which code path created it.
--
-- `direction is not null` is not redundant, and leaving it out is a bug
-- this constraint actually had. A CHECK passes when it evaluates to NULL,
-- and `null in ('outbound', 'inbound')` is NULL rather than false, so the
-- shorter version accepted every email with no direction at all - exactly
-- the row the whole migration exists to make impossible. Caught by
-- inserting one and watching it succeed.
alter table notes drop constraint if exists notes_email_fields_check;

alter table notes
  add constraint notes_email_fields_check
  check (
    case
      when kind = 'email'
        then direction is not null and direction in ('outbound', 'inbound')
      else direction is null and subject is null
    end
  );
