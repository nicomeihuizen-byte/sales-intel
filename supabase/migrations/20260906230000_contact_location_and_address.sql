-- A contact gets a place, and a postal address.
--
-- From adding the Ober-Haus book by hand. That company has 140 people
-- across seven Lithuanian cities, and "Aurimas Petrikas, Klaipėda Region
-- Manager" is a different person to reach than the same title in Vilnius.
-- Until now the only place that fact could live was inside the role
-- string, which is how a field ends up carrying two things and sorting on
-- neither.
--
--
-- location
-- --------
-- Short, scannable, and the one that earns its place: a city, or an office
-- name. It sits under the role on the card because it is read at a glance
-- while deciding who to call, in the same class as the role itself.
--
--
-- address
-- -------
-- The block, for the cases where a person is not at the company address:
-- a broker working out of a regional office, a consultant at their own
-- premises. One free-text column and not street/postcode/city, matching
-- companies.address for the same reason given there: addresses are pasted
-- in whole and nothing in this app sorts on the parts.
--
-- Both nullable, and most contacts will leave both empty. That is correct
-- rather than untidy: a name and a mobile number is a complete contact on
-- the day you first hear it, and the record fills in over weeks.
--
-- No index on either. Neither is filtered or sorted on, and the search
-- still queued (usability log item 6) is one trigram index across the
-- text columns rather than one per field.

alter table contacts
  add column if not exists location text,
  add column if not exists address text;
