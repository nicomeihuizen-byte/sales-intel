# Patch: company delete without the empty rule, and the contact form closes

Four files, straight on top of what you're running. No migration, no env change, no
`npm install`. Copy over and restart `npm run dev`.

```
app/companies/page.tsx
app/companies/actions.ts
components/ContactList.tsx
lib/companies.ts
```

## The add-contact form

It was staying open after a save on purpose, so you could add three stakeholders in a row.
That was the wrong trade. What it actually produced is what your screenshot shows: five empty
inputs parked above the contact list for the rest of the session, and they're the first thing
you see when you pick a company. Reading the list is what the pane is for.

It now closes on save. The `+ add` button next to `// contacts` is where it already was.
Adding a second person costs one more click, which is the right way round.

## Deleting a company

The empty-only rule is gone. You can remove any company now.

I had it refuse unless the company had no deals and no contacts, on the grounds that a
company cascades to its deals and those cascade to their notes, so one click can take a note
history with it. That reasoning is still true, but the conclusion was wrong: it's your data,
on your machine, backed up, and a tool that answers "delete these three things first" is a
tool arguing with its owner.

What replaces it informs instead of forbidding. The confirm spells out what goes:

```
remove company?
remove company + 1 contact?
remove company + 3 contacts, 1 deal, 12 notes?
```

Still two clicks. The counts are read from the database at render time, so the number you see
is the number that goes.

The cost, and it's real: with the guard gone, one misclick plus one confirm click can take a
month of notes. That's what `npm run db:backup` is for, and it's a good moment to have
actually tested a restore once.

## Verified

- `tsc --noEmit` clean, `eslint .` clean, `next build` compiled and generated all routes.
- The confirm wording was run through its cases, including the singular/plural boundary:
  empty, one contact, three-contacts-one-deal-twelve-notes, and two-deals-one-note.
- **Not verified: how it looks.** Still no browser here. The confirm string is longer than the
  button it replaces, so it may wrap in that column. If it reads badly, say so and I'll move
  it under the company name instead of beside it.

## Suggested commit

```
fix(companies): close the contact form on save, allow full company delete

The add-contact form stayed open after saving, leaving five empty
inputs above the contact list for the rest of the session. It closes
now; "+ add" reopens it.

Company deletion no longer refuses unless the company is empty. The
cascade through deals into notes is real, so the confirm names exactly
what will go ("remove company + 3 contacts, 1 deal, 12 notes?") rather
than blocking the action and asking the user to dismantle it by hand.
```
