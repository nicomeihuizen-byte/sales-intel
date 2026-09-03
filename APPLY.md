# Patch: advice bullets on all three analysis modes

Drop these four files over the matching paths in `D:\sales-intel-deploy`, overwriting.
`insight-next-steps.diff` is the same change as a unified diff if you'd rather read it that way first.

```
lib/types.ts
lib/ai.ts
components/InsightPanel.tsx
README.md
```

No new dependencies, no env vars, no database change. `npm run seed` is not needed:
nothing about the seeded data changed, only what the model is asked to return about it.

## What changed

**`lib/types.ts`** - each of the three result types gained an action list:

| Type | New field | What it holds |
| --- | --- | --- |
| `DealInsight` (open) | `nextSteps` | Concrete moves for this deal, priority order |
| `DealLossReview` (lost) | `recommendedActions` | A re-approach plan, or lessons for the next similar deal |
| `DealWinReview` (won) | `repeatablePlays` | Plays to deliberately run again |

Three names rather than one shared `recommendations`, because the three lists answer
genuinely different questions and a shared name would hide that at every call site.

**`lib/ai.ts`**

- `isActionList()` validates all three: an array of 1 to 5 strings, each non-blank after
  trimming. The prompts ask for 2 to 4. The validator's floor is looser on purpose: a deal
  where only one action genuinely matters is a correct answer, and rejecting it would burn
  both retries and hand the user an error instead of a good result.
- `buildActionListInstruction()` builds the shared prompt block so the specificity and
  length rules are written once, with a per-mode brief passed in.
- Each prompt now bans the generic bullet by example ("follow up with the customer",
  "keep the relationship warm") rather than just asking for specificity.
- `PROSE_STYLE_RULES` closes the em dash gap in the model's own output, which was open
  item 4 in the project notes. It was one line to add while the prompts were already open.
- `max_tokens` 512 to 1024. A truncated `tool_use` block fails validation and burns a
  retry, so the ceiling now sits well above a long reasoning plus five bullets.

**`components/InsightPanel.tsx`**

- New `ActionList` sub-component: an `h3` heading plus a `ul` with a mono `>` marker in
  the accent green, `list-none` so the browser doesn't draw a second bullet beside it.
  Real `h3`, not a styled div, per the heading hierarchy rules in AGENTS.md.
- Headings differ per mode: **Next steps** (open), **Worth repeating** (won), and for a
  lost deal the heading follows the verdict: **How to revisit** on `worth_revisiting`,
  **What to do differently** on `confirmed_lost`. Those are two different lists and one
  neutral label over both would blur them.
- The three placeholder strings now mention the advice, since the panel promises it before
  you click.

**`README.md`** - the "output" description said status plus reasoning string in two
places. That's now understated, so both were updated along with the roadmap line.

## Verified before sending

- `npx tsc --noEmit`: clean for these files. (`app/layout.tsx` reports `Cannot find name
  'LayoutProps'`, a Next.js generated type that only exists after a build. Pre-existing,
  not from this patch.)
- `npx eslint .`: clean.
- `npm run build`: compiled successfully, all 10 routes generated. The sandbox still can't
  reach `fonts.googleapis.com`, so the build was run with the three `next/font/google`
  calls stubbed out and `app/layout.tsx` restored untouched afterwards. Your local build
  hits the real fonts.
- Not verified: the actual quality of the generated bullets, which needs a live API key.
  That's the thing to eyeball after you push. Solara Energy (lost, worth revisiting) and
  IronGate Financial Holdings (open, at risk, champion resigned) are the two clearest
  tests, since both have an obvious right answer.

## Suggested commit

```
feat(insight): add action bullets to all three analysis modes

Momentum, loss review and win review each return a 2-4 item action
list alongside the reasoning: next steps on an open deal, a re-approach
plan or lessons on a lost one, repeatable plays on a won one.

Validated as 1-5 non-blank strings and rendered as an h3 plus bulleted
list in InsightPanel. Also adds an em dash ban to the prompts and
raises max_tokens to 1024 so the longer tool output can't truncate.
```
