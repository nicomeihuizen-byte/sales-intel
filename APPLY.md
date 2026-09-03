# Patch: Deal Management, pipeline panel, email drafts

Copy the files over the top. No new dependencies.

## Order

```
npm run db:backup
npm run db:migrate
```

Then **before you push**, paste `RUN-THIS-ON-HOSTED.sql` (in this folder, identical to the new
migration) into the hosted project's SQL editor. This one is not optional: the code queries
columns and a table that don't exist there yet, so pushing first breaks the demo the same way
the contacts migration did.

Then, to give the demo something to show:

```
npm run seed -- --confirm-wipe=<your hosted host>
```

with `.env.local` pointed at the hosted project. That's what fills the demo's meters.

**Two things you need to add by hand:**

1. **Your logo at `public/logo.png`.** I couldn't fetch it, so the markup points there and
   expects a file. Roughly 132x44; if you use an SVG, change the `src` in
   `app/companies/page.tsx`. Until it exists you'll get a broken image in the header.
2. Nothing else. `ALLOW_DESTRUCTIVE_ACTIONS` stays local-only as before.

## What's in it

**"Deal Management"** replaces "Companies" as the title, and the demo login now lands here
instead of `/deals`.

**Scrollable panes.** Companies and contacts scroll; deals show three and scroll past that,
with the height derived from that constant rather than a magic number that drifts away from it.

**Deal value in euros**, click-to-edit on each row. The parser takes the ways you'd actually
write it: `12500`, `12.500`, `12.500,50`, `€12 500`, `1.234.567`. An unpriced deal shows a dash,
not `€0`, and is left out of the totals: nobody has decided what it's worth, and zero is a
decision.

**Last two notes** appear under the deals pane when you select a deal. The full timeline is
still below.

**Draft email** on each contact. Opens a panel, writes an English follow-up grounded in that
deal's notes and shaped by its status (open gets a next step, won gets what comes after
signature, lost keeps the door open honestly). Subject and body copy separately, because mail
clients want them in different boxes. Nothing sends anything; the mailto link is still there
next to it for writing your own.

**Multiple emails and phones per contact**, as lists with a spare empty row so there's always
somewhere to type the next one. Your existing single values migrate across.

## The pipeline panel, and one place I didn't build what you drew

Fixed bottom right, collapsible, with a `refresh` that re-analyses the open deals.

Your mockup had four semicircular gauges. I built **one meter and three figures**, and the
reason is worth a paragraph. A gauge shows a ratio against a limit. Pipeline health has one:
0 to 100. "Total won value" doesn't. To draw it as a gauge I'd have to invent a maximum for
the needle to point at, and an invented scale is invented information, on a dashboard whose
whole selling point is that it doesn't do that. So health is a meter and the three money and
time figures are headline numbers.

**Health is stored, not live.** Analysis is an API call per deal; running that on every page
load would be slow and would cost real money every time you opened the page. So each analysis
is saved, the meter averages the saved ones, and `refresh` re-runs the open deals. Pressing
Analyze on a single deal also updates its stored value, so ordinary use keeps the meter
current for free. The panel says how many of your open deals have been analysed and how old
the oldest reading is, rather than implying it's live.

Deals that aren't analysed are left out of the average instead of counted as zero. An
unanalysed deal is an unknown, and folding unknowns in as bad news would make the meter drop
every time you added a deal.

**Conversion time** counts only deals with both dates. `closed_at` is stamped from now on when
you mark a deal won or lost, so it reads "not enough data" until a few close through the app.
Your existing won deals stay blank rather than being given a guessed date.

A refresh is capped at 12 deals per press, so one click can't become forty API calls.

## Verified

- `tsc --noEmit` clean, `eslint .` clean with no warnings, `next build` compiled and generated
  all routes.
- **All four migrations applied three times in a row** against a real Postgres 16. The first
  version of this one wasn't replayable (the second pass referenced a column the first had
  dropped), which the third pass caught; it's now guarded and idempotent.
- **The contact backfill was run against fixture rows**: a contact with both values moved to
  `{a@b.example}` / `{+31 6 111}`, and contacts holding whitespace or nulls became empty lists
  rather than lists containing an empty string.
- **The euro parser was run through 15 cases**, all passing, including the one that caught a
  real bug: `1.234.567` was rejected until I fixed the thousands-separator rule.
- **The metrics maths was exercised against fixtures**: an unpriced deal stays out of the
  totals, a stale insight left on a won deal is ignored by the health average, and a won deal
  with no close date is skipped by the conversion time rather than counted as zero months.
- **Not verified: how any of it looks.** No browser here. The header row now holds a title, a
  logo and two links, and the fixed panel sits over the bottom right, so those are the two
  places to look first.

## Suggested commit

```
feat(companies): pipeline panel, deal values, email drafts

Renames the view to Deal Management and lands the demo login on it.
Adds euro values to deals, scrollable panes, a two-note preview on the
selected deal, and multiple emails and phones per contact.

Adds a fixed pipeline panel: a health meter plus open value, won value
and average time to win. Health reads stored analyses rather than
calling the API on every page load, so the page stays instant; pressing
Analyze on a deal also updates the stored value, and a refresh button
re-runs the open deals with a cap.

Adds an English follow-up email draft per contact, grounded in the
deal's notes and status, offered as copyable text rather than anything
that sends.
```
