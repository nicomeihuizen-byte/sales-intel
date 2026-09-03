# Patch: local development database (Phase A)

**Apply the v2 advice-bullets patch first and commit it, then apply this one.**
This patch is built on top of v2, so the files in it already contain v2's changes. Doing it
in that order gives you two clean commits. Doing it in one go works too, you just get one
bigger commit.

## Two manual steps the zip can't do for you

**1. Delete `supabase/schema.sql`.** Its contents moved to
`supabase/migrations/20260801000000_initial_schema.sql`. Copying files can't express a
deletion, so this one is on you. `git status` should show it as deleted afterwards.

**2. `npm install` is not needed.** No dependencies changed. The Supabase CLI is invoked
through `npx` with a pinned version rather than added to `package.json`, deliberately: a
dependency there would pull a ~30MB binary download into every Vercel build, for tooling
the deployed app never touches.

Everything else is copy over the top, same as before.

## What this does

Nothing to the hosted demo. It keeps running exactly as it does now, from the same Supabase
project, with the same seeded data. This adds a second place to run the app, on your
machine, against a local Postgres.

`sales-intel-documentation/local-setup.md` is the real documentation. Read that one. The
short version:

```
npm run db:start        # first run pulls containers, takes a few minutes
                        # it prints the API URL and anon key for .env.local
npm run dev             # sign up with your own email at /login
```

New scripts: `db:start`, `db:stop`, `db:status`, `db:reset`, `db:migration`, `db:backup`.

## The three things that actually change

**The schema is no longer a file you edit.** `supabase/schema.sql` becomes
`supabase/migrations/20260801000000_initial_schema.sql`, and every future change is a new
migration created with `npm run db:migration -- <name>`. `supabase db reset` replays them in
filename order, which is what builds your local database. Editing an applied migration means
your two databases quietly stop agreeing, and you find out months later.

I made the policy statements re-runnable while moving them (`drop policy if exists` before
each `create policy`). `create policy` has no `if not exists` form, so without that the
migration failed on its second run and took everything after it down with it.

**`npm run seed` can no longer wipe the wrong database.** It refuses unless you name the
host you mean to destroy, and the name has to match `NEXT_PUBLIC_SUPABASE_URL`:

```
npm run seed -- --confirm-wipe=abcdefgh.supabase.co
```

A local host needs `--allow-local` on top, because local is where the real pipeline lives.
The point of naming the host rather than passing a plain `--yes` is that a copied `.env.local`
or plain muscle memory can't satisfy it.

**Backups are now your job.** `npm run db:backup` dumps the local data to
`backups/<timestamp>/`, git-ignored. Two files, because every row in `public` has a `user_id`
pointing into `auth.users` and they have to be restored in that order. The restore procedure
is in the doc.

I've written it to fail loudly if a dump comes back suspiciously small, since a backup that
silently produced an empty file is worse than no backup at all.

## Verified

- `tsc --noEmit` clean, `eslint` clean, `next build` compiled and generated all routes.
- **The migration was applied twice against a real Postgres 16**, with a stub `auth.users`
  table and `auth.uid()` function standing in for Supabase's. Both passes succeeded, and the
  result was RLS enabled on all three tables, 3 policies, 8 indexes. The second pass is the
  one that mattered: it's what `db:reset` does and what the old file would have failed.
- **All five paths through the seed guard were run for real:**

| What I ran | What happened |
| --- | --- |
| `npm run seed` with no flags | refused, printed the host it would have wiped |
| `--confirm-wipe=127.0.0.1` against a hosted URL | refused, named both hosts |
| `--confirm-wipe=<matching hosted host>` | passed the guard, proceeded |
| `--confirm-wipe=127.0.0.1` against a local URL | refused, asked for `--allow-local` |
| `--confirm-wipe=127.0.0.1 --allow-local` | passed the guard, proceeded |

- **Not verified: `npm run db:start` and `npm run db:backup`.** Both need Docker, which this
  sandbox doesn't have. The migration content is tested, the CLI invocations are not. Run
  `npm run db:backup` once on day one and check the two files have real content in them,
  rather than finding out the first time you need a restore.

## One thing worth doing on day one

Restore a backup, while the database still holds nothing you'd miss. The procedure is at the
end of the setup doc. A backup you have never restored is a hope, not a backup.

## Suggested commit

```
chore(db): add local development database and backup tooling

Moves the schema into supabase/migrations so the Supabase CLI can
provision a local Postgres with the same tables, indexes and RLS
policies as the hosted project, and makes the policy statements
re-runnable so db:reset works more than once.

Guards scripts/seed.ts, which wipes before it writes, behind an
explicit --confirm-wipe=<host> that must match the configured Supabase
URL, plus --allow-local for local targets. Adds scripts/backup.ts and
db:* npm scripts, and documents the whole setup including what still
leaves the machine on every Analyze click.

The hosted demo project is unchanged and stays hand-managed.
```
