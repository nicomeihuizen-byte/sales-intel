# Patch: fix "€ NaN", and move the pipeline to the top

Seven files over the top of what you're running. No migration, no env change, no
`npm install`. Restart `npm run dev` after copying.

```
lib/deals.ts
lib/companies.ts
lib/types.ts
lib/metrics.ts
lib/featureFlags.ts
components/DealValueField.tsx
components/PipelineMeters.tsx
components/TerminalShell.tsx
app/companies/page.tsx
.env.local.example
```

Add one line to `.env.local`:

```
SHOW_CASE_STUDY_LINK=false
```

## The € NaN

A real bug, and a boring one. There were two places that select deals from the database, and
they each had their own hardcoded list of columns. When the value column was added, only one
list got it. Deals loaded through the companies pane arrived with `value_eur` undefined,
`undefined` is not `null`, so the "unpriced" check passed it straight to the formatter and you
got `€ NaN`.

Fixed at the source: `DEAL_COLUMNS` is now exported from `lib/deals.ts` and
`lib/companies.ts` imports it, so there is one definition instead of two that can drift.
`DealValueField` also now treats any non-finite value as unpriced, so a missing column would
show a dash next time rather than NaN.

This is exactly the failure mode a real test suite catches, and it's the third time this
session that a duplicated constant has bitten. Worth remembering when you decide whether the
Jest harness in AGENTS.md is worth an afternoon.

## The value was there, invisibly

The `€ NaN` text *was* the button. So the fix above makes it show a dash, and a dash reads as
a blank, which is no better. An unpriced deal now shows **"+ value"** with a hover
background, which is a control rather than a gap. A priced deal shows the amount and behaves
the same way.

Zero is still never shown for an unpriced deal: zero is a decision, and no decision has been
made.

## The case study link

Gone on local, untouched on hosted, via `SHOW_CASE_STUDY_LINK`.

The default is ON, the opposite polarity to `ALLOW_DESTRUCTIVE_ACTIONS`, and for the same
reason in reverse: the deployment that must keep working should need no configuration. Hosted
gets no new setting, and forgetting the local one costs a stray link rather than breaking the
demo's way back to your portfolio.

## Pipeline at the top

It's now a strip in the flow above the three panes, four cells across on a wide screen,
stacking to two and then one as the window narrows.

The collapse control is gone with the move. It existed because a fixed panel sat over the
notes timeline and had to be dismissable; in the flow nothing has to move out of its way.
`refresh` stays, since that's the only control there that does anything.

The Won cell gained a deal count under it, matching Open, which meant adding `wonDeals` to
the metrics type. That's why `lib/types.ts` and `lib/metrics.ts` are in the patch.

## Verified

- `tsc --noEmit` clean, `eslint .` clean with no warnings, `next build` compiled and generated
  all routes.
- **Not verified: how the strip looks at any width.** No browser here. The four-across layout
  at your window size is the thing to check, and whether the health meter still reads well now
  that it's a quarter of the width rather than the full panel.

## Suggested commit

```
fix(deals): correct euro value on the companies pane, move pipeline to top

Two queries selected deals with separately hardcoded column lists, and
only one gained value_eur, so deals loaded through the companies pane
rendered "NaN". DEAL_COLUMNS is now shared, and DealValueField treats a
non-finite value as unpriced.

The pipeline panel moves from fixed bottom-right into the page flow
above the panes, losing its collapse control since nothing has to move
out of its way there.
```
