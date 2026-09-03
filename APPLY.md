# Patch: companies pane, contacts, and editable notes

Copy over the top, same as before. Nothing to delete this time, and no new dependencies.

**One extra step, because this one changes the database:**

```
npm run db:backup          # first, while you still can
npm run db:reset           # replays both migrations onto an empty database
```

`db:reset` destroys the local data. If you've already entered real deals, restore them from
the backup afterwards using the procedure at the end of `local-setup.md`, or skip `db:reset`
and apply just the new migration by hand:

```
npx --yes supabase@2.116.0 db push --local
```

The new migration is `supabase/migrations/20260903120000_contacts_and_note_edits.sql`.

## What you get

**`/companies`**, a two-pane view. Companies on the left with a deal and contact count each;
select one and the right pane shows its people and its deals; select a deal and its notes and
the Analyze panel open underneath. `/deals` is untouched and still there, linked from the
header, because the company-first view can't answer "what needs attention today".

Selection lives in the URL (`/companies?company=...&deal=...`) rather than in client state.
That keeps every pane a Server Component reading straight from Supabase, and it means a
company you're working on is a link you can bookmark and the back button behaves.

**Contacts**: name, role, email, phone, LinkedIn, attached to a company. Only the name is
required, because a prospect usually starts as a name and a LinkedIn profile with nothing
else. Add, edit and remove inline. The add form stays open and clears itself after each save,
since stakeholders arrive two and three at a time.

**Editable notes**, on both the new view and the existing deal page.

## The decisions worth knowing about

**Editing a note never moves it in the timeline.** `created_at` is untouched; a new
`updated_at` column records the edit and the note shows "edited" beside its original date.
This matters more than it looks: `lib/ai.ts` reasons about the *gaps between* note dates, so
a note that jumped to today because you fixed a typo would quietly change the model's read of
that deal's entire history. The editor says "the date stays as it was" while you're in it.

**Contact links are scheme-checked before they render.** `lib/links.ts` turns email, phone and
profile values into hrefs and returns null for anything it doesn't like, in which case the
value renders as plain text instead of a link. This is your own house rule (AGENTS.md, HTML
and JavaScript Security Hardening) and it's not theoretical here: contact fields are text you
type, stored in a database, rendered back as clickable links, which is exactly the shape that
turns a pasted `javascript:` URL into a working script link.

**A React 19 rule forced a rewrite of how the forms close.** The obvious "close the editor
when the action succeeds" is a `useEffect` that calls `setState`, which
`react-hooks/set-state-in-effect` rejects, and your lint config treats as an error rather than
a warning. The fix is `lib/useActionSuccess.ts`, which detects a completed action by comparing
the state object's identity during render instead. That's the pattern React documents for this
case. Worth reading, since it'll come up every time you add a form.

## Verified

- `tsc --noEmit` clean, `eslint .` clean (no warnings either), `next build` compiled and
  generated all 10 routes including `/companies`.
- **Both migrations applied twice in order against a real Postgres 16.** Result: RLS on all
  four tables, 4 policies, `notes` carrying `updated_at`, `contacts` carrying all nine columns.
  The second pass is what `db:reset` does.
- **`lib/links.ts` was run against hostile input**, not just reasoned about:

| Input | Result |
| --- | --- |
| `javascript:alert(1)`, and the mixed-case and padded variants | null, renders as text |
| `data:text/html,<script>...` | null |
| `vbscript:msgbox(1)` | null |
| `linkedin.com/in/nico` (no scheme) | `https://linkedin.com/in/nico` |
| `nico@meihuizen.ai\nBcc: someone@else` (header injection) | null |
| `+31 6 1234 5678` | `tel:+31612345678` |

- **Not verified: anything that needs a browser.** No Docker in the sandbox, so the two-pane
  layout has never been rendered, only compiled. Check it on a narrow window too: the panes
  stack below `md` and I couldn't look at that.

## Suggested commit

```
feat(companies): add companies pane, contacts, and editable notes

Adds /companies, a two-pane view with companies and their contacts on
the left and the selected company's deals and notes on the right, with
selection held in the URL so every pane stays a Server Component.

Adds a contacts table (name required, everything else optional) with
inline add, edit and remove, and lib/links.ts to scheme-check email,
phone and profile values before they are bound to an href.

Notes become editable on both views. created_at is deliberately left
alone on edit so the momentum analysis, which reasons about the gaps
between note dates, cannot be skewed by a typo fix; a new updated_at
records the edit instead.
```
