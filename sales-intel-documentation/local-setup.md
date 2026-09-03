# Running locally, with real data

The hosted Vercel deployment stays exactly as it is: a public demo, seeded
fiction, one-click login from the portfolio site. Nothing in this document
touches it.

This is about the second copy, the one that runs on your machine and holds
the real pipeline. The app code is identical. Only the database is
different.

## The one thing to understand first

Until now the database was disposable. `npm run seed` wiped it and rebuilt
it, and that was fine, because everything in it was invented.

Once real deals are in a local database, three things change permanently:

1. **The schema stops being a file you edit.** Changes go in a new
   migration, never into an existing one.
2. **`npm run seed` becomes dangerous.** It still deletes everything the
   demo account owns. It now refuses to run unless you name the host.
3. **Backups become your job.** Supabase backs up the hosted project.
   Nobody backs up a Postgres container on your laptop.

Everything below follows from those three.

## First run

Docker Desktop has to be running. Then, in `D:\sales-intel-deploy`:

```
npm run db:start
```

First time, this pulls several containers and takes a few minutes. When it
finishes it prints a block of values. The two that matter:

```
API URL: http://127.0.0.1:54321
anon key: eyJ...
```

Put those in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon key it printed>
ANTHROPIC_API_KEY=<your real key, same as before>
```

Leave `SEED_DEMO_EMAIL` and `SEED_DEMO_PASSWORD` out of the local file
entirely. They exist for the hosted demo. Not having them here is one more
reason a stray `npm run seed` can't do damage.

The migrations in `supabase/migrations/` are applied automatically, so the
tables, indexes and RLS policies are already there. Then:

```
npm run dev
```

Sign up at `http://localhost:3000/login` with your own email. Email
confirmation is off locally, so the account works immediately. That
account is yours; it has nothing to do with the demo account.

## Day to day

| Command | What it does |
| --- | --- |
| `npm run db:start` | Starts the local stack. Needed after a reboot. |
| `npm run db:stop` | Stops it. Data survives. |
| `npm run db:status` | Prints the URL and keys again when you've lost them. |
| `npm run db:backup` | Dumps the local data to `backups/<timestamp>/`. |
| `npm run db:migration -- <name>` | Creates a new empty migration file. |
| `npm run db:reset` | **Destroys all local data** and rebuilds from migrations. |

`db:reset` is the one to be careful with. It is the normal way to test a
migration and it is also the fastest way to lose a week of notes. Back up
first, every time, until that's automatic.

## Changing the schema

Say you want to add a `blocked_reason` column to `deals`.

```
npm run db:migration -- add_deal_blocked_reason
```

That creates `supabase/migrations/<timestamp>_add_deal_blocked_reason.sql`.
Write the change in it as SQL that only ever adds:

```sql
alter table deals add column if not exists blocked_reason text;
```

Then:

```
npm run db:backup
npm run db:reset
```

`db:reset` replays every migration from scratch against an empty database,
which is the only honest test that your migration works on a fresh
machine. It is also why the backup comes first.

Two rules that matter more than they look:

- **Never edit a migration that has already run.** Postgres doesn't
  re-apply it, so your database and the file stop describing the same
  thing, and you find out months later.
- **Never write a destructive migration casually.** `drop column` throws
  away data that no backup taken afterwards will contain.

The hosted demo project has no migration history: its schema was applied by
hand in the SQL editor. Leave it that way. If you ever need to change it,
run the new migration's SQL there manually. Do not point `supabase db push`
at it expecting the two to reconcile.

## Restoring a backup

`npm run db:backup` writes two files. Order matters, because every row in
`public` has a `user_id` pointing into `auth.users`:

```
npm run db:reset                              # empty database, schema only
psql <local connection string> -f backups/<ts>/01-auth-data.sql
psql <local connection string> -f backups/<ts>/02-public-data.sql
```

The local connection string is printed by `npm run db:status` as `DB URL`.

Test this once, now, while the database holds nothing you'd miss. A backup
you have never restored is a hope, not a backup.

## The seed script

`npm run seed` still exists, and it still wipes before it writes. It now
refuses unless you name the host:

```
npm run seed -- --confirm-wipe=abcdefgh.supabase.co
```

The host has to match `NEXT_PUBLIC_SUPABASE_URL`, so confirming the wrong
one fails instead of wiping the wrong database. Seeding a local database
needs `--allow-local` on top, because local is where the real data is.

In practice you'll only ever run it against the hosted demo, from an
`.env.local` pointed at the hosted project. Which is the other reason to
keep a separate env file per target rather than editing one in place.

## What still leaves your machine

Local Postgres means the notes sit on your disk instead of in Supabase's
cloud. It does not mean the notes stay on your machine.

Every time you click Analyze, the deal's full note history is sent to the
Anthropic API. That is the feature. But it means a note containing a
client's confidential detail leaves your laptop the moment you analyze the
deal, and running the database locally does not change that at all.

Worth deciding deliberately what goes in a note, rather than assuming
local means private.
