-- A company becomes a record rather than a name.
--
-- Until now `companies` held a name and nothing else, because companies
-- only ever existed as the thing a deal hung off. That was fine while the
-- app was a note history. It stops being fine the moment you are working
-- five accounts for real: the VAT number goes on the quote, the
-- registration number goes on the contract, and the switchboard number is
-- the one you ring when your contact has gone quiet and you need to find
-- out whether they still work there.
--
-- Every column is nullable, and that is the design rather than laziness. A
-- prospect starts as a name heard on a call. Requiring an address to file
-- it would mean either not filing it or inventing one, and an invented
-- address is worse than an empty column because nothing on screen says it
-- was invented.
--
-- Why these eight and not more:
--
-- `address` is one free-text field rather than street/postcode/city/state
-- broken out. Nobody types an address a field at a time; they paste the
-- block from a website footer or an invoice. Four boxes would turn a paste
-- into four cuts, and this app never sorts or geocodes on the parts.
-- `country` is separate because it is the one part that gets used on its
-- own: it decides the VAT treatment and it is the axis you segment on.
--
-- `vat_number` and `registration_number` are separate columns and not one
-- "company numbers" field. They are different numbers issued by different
-- registries (KvK here, HRB in Germany, Companies House in the UK) and
-- they go on different documents.
--
-- No `notes` column. Notes already have a table, and a free-text box on
-- the company would be the one place a note could hide from both the
-- timeline and the analysis.

alter table companies
  add column if not exists address text,
  add column if not exists country text,
  add column if not exists website text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists linkedin_url text,
  add column if not exists vat_number text,
  add column if not exists registration_number text;

-- No index on any of them. None of these are searched or filtered on yet,
-- and an index that no query uses is write cost with no read benefit. When
-- company search lands, the right answer is one trigram or full-text index
-- across name and address, not eight btrees.
