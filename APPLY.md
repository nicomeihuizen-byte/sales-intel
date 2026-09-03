# Patch: three panes, editable status, and deletion

**This replaces the three-panes patch I sent a moment ago.** If you already applied that one,
copy these over the top. If you haven't, skip it and use this instead. Everything from it is
included here.

## Apply

```
npm run db:backup
npm run db:migrate
```

Add one line to `.env.local`, which is what switches deletion on:

```
ALLOW_DESTRUCTIVE_ACTIONS=true
```

Restart `npm run dev` afterwards, since env changes only land at startup.

**Before you push**, paste this into the hosted project's SQL editor:

```sql
alter table deals drop constraint if exists deals_status_check;

alter table deals
  add constraint deals_status_check
  check (status in ('open', 'won', 'lost'));
```

**Do not add `ALLOW_DESTRUCTIVE_ACTIONS` to Vercel.** That is the whole mechanism.

## Deletion, and why it's a server-side flag

You're right that it can't ship to hosted. The demo is a public page with a one-click login,
so anyone arriving from your case study can press any button on it.

The flag is read by the server actions, not only by the code that draws the buttons. Hiding a
button hides nothing: a server action is a real HTTP endpoint that exists whether or not
anything on the page points at it, so a `NEXT_PUBLIC_` flag would be a suggestion the browser
is free to ignore. `lib/featureFlags.ts` is server-side, and every delete action re-checks it
itself.

It fails closed. Unset means no deletion, so forgetting to configure something leaves the demo
safe and the local app missing a button, which is visible and harmless. The other direction
fails silently and in public.

**Deals** get a two-step remove in the deals pane: the first click asks "remove + notes?",
the second does it. Two clicks rather than a browser `confirm()` dialog, which blocks the page
and looks like a browser artefact rather than part of your app. The second click matters
because deleting a deal cascades through its whole note history.

**Companies can only be removed when empty**, no deals and no contacts. A company cascades to
its deals and those cascade to their notes, so an unguarded delete here is a note history gone
on one click. The count is checked server-side against the database as it is now, not against
the numbers the page rendered with. That also matches what this is actually for: clearing up
the leftover, not wiping an account.

## The cause, not just the symptom

You described the real problem exactly: misspell the company and the deal attaches to nothing.
That's `createDeal` finding-or-creating a company by *name*, so "Minitb" quietly becomes a
second company holding one orphaned deal, with nothing on screen saying so.

So the deals pane now has its own **add deal** form, where the company is the one you already
have selected and there is no name to mistype. The form on `/deals` is unchanged and still
works the old way. Deletion cleans up the mess you already have; this stops making more.

This is more than you asked for, and it's the part I'd keep if you only kept one.

## Also in here (from the superseded patch)

Three panes, editable deal status, a CHECK constraint on `deals.status`, and the `db:migrate`
and `db:migrations` scripts.

## Verified

- `tsc --noEmit` clean, `eslint .` clean, `next build` compiled and generated all routes.
- The status constraint applied twice against a real Postgres 16, and the check rejects
  `'closed'` while accepting `'won'`.
- **`deleteCompanyIfEmpty` was run against a stubbed client for all four cases**: empty company
  deletes; one deal, two contacts, and both refuse with the right message, and none of the
  refusals reached the delete.
- **The flag was run through its values**: `true`, `TRUE`, `True` and `" true "` all enable it;
  `1`, `yes`, `false`, empty and unset all leave it off.
- **Not verified: how any of it looks.** No browser here. Worth checking the deals pane in
  particular, which now holds a title, a status dropdown and a remove control in one row.

## Suggested commit

```
feat(companies): three panes, editable status, guarded deletion

Splits the companies view into companies, contacts and deals across
three columns, with the selected deal's notes and Analyze panel full
width underneath. Deal status becomes editable, backed by a CHECK
constraint since the value decides which question the insight route
asks the model.

Adds deletion of deals, and of companies that hold nothing, behind
ALLOW_DESTRUCTIVE_ACTIONS. The flag is server-side and re-checked
inside each action rather than only where the buttons render, because
a server action is reachable whether or not the UI points at it. It is
deliberately absent on the hosted demo, which is public.

Adds an add-deal form to the companies pane, where the company is
already selected. That removes the typo path that silently created a
second company holding one orphaned deal.
```
