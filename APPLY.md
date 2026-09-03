# Patch: seed dates, and the back link reads "Deal Management"

Two files. No migration, no env change, no `npm install`.

```
scripts/seed.ts
app/deals/page.tsx
```

## The seed already had what you asked for

Contacts and deal values are both in `SEED_DATA` already, and have been since the deal
management patch: ten contacts across the companies, using the people already named in the
notes, and euro values on six of the seven deals. IronGate is deliberately left unpriced so
the demo shows the "+ value" state too.

Hosted doesn't show them because it was last seeded before that data existed. Re-running the
seed is the whole fix, not new data.

## What genuinely was broken

Deals were always created with `created_at` of "now", whatever their notes said. So a deal
seeded as won 21 days ago had been created today, the open-to-won metric computed a negative
interval, discarded it, and the panel read "not enough data" on a fully populated demo.

A deal now starts when its first note was written. I also moved the two closed dates, which
sat *before* the deals' own note histories: Fenwick closed 21 days ago but its last note was
5 days ago. Fenwick now closes 3 days ago, Solara 20.

Checked by running the arithmetic:

| Deal | Before | After |
| --- | --- | --- |
| Fenwick & Cole / Renewal FY26 | -0.1 months, discarded | 0.6 months, counts |
| Solara Energy / Pilot Program | -0.7 months, discarded | 0.8 months, counts |

The demo will show a real "open to won" figure instead of "not enough data".

## The back link

On `/deals` the header link to the main screen said "companies", which reads as a third place
rather than the way back. It now says "< Deal Management", on both deployments, since it isn't
environment-specific.

## Re-seeding hosted

`.env.local` currently points at your local database, so switch it first or the guard will
refuse:

```
cp .env.local .env.local.dev        # keep the local one
cp .env.local.hosted .env.local     # point at hosted
npm run seed -- --confirm-wipe=ohidcdjgfuualtaozcrt.supabase.co
cp .env.local.dev .env.local        # switch back
```

Restart `npm run dev` after switching back, since env only loads at startup.

Then open the hosted demo and press **refresh** on the pipeline strip once. The health score
is an average of stored analyses, and seeding doesn't run the model, so it will read "none
analysed yet" until something does.

## Verified

- `tsc --noEmit` clean, `eslint .` clean, `next build` compiled and generated all routes.
- The date arithmetic was run for both closed deals, before and after, as above.
- **Not verified: the seed run itself.** It needs a live database, so the first real proof is
  your own run. Watch for the per-company "Seeded N contact(s)" lines.

## Suggested commit

```
fix(seed): backdate deals to their first note, rename the deals back link

Deals were inserted with created_at of now regardless of their note
history, so a deal seeded as closed weeks ago produced a negative
open-to-won interval, which the metric discarded. A deal now starts at
its oldest note, and the two closed dates move to after their last
notes rather than before their first.

The /deals header link to the main screen now reads "Deal Management"
rather than "companies", which named the route instead of the place.
```
