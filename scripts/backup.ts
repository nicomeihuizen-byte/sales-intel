import { execFileSync } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Backs up the LOCAL Supabase database to a timestamped folder under
// backups/ (git-ignored). Run with `npm run db:backup`.
//
// Why this exists: the hosted Supabase project is backed up by Supabase.
// The local one is not backed up by anyone. Once a real pipeline lives in
// it, the local database is the only copy of who owes you money, and it
// sits on one laptop.
//
// What gets dumped is data only, not schema, because the schema is already
// version-controlled in supabase/migrations. A restore is therefore:
//
//   1. npm run db:reset          (rebuilds an empty database from migrations)
//   2. psql < the auth dump      (recreates the user accounts)
//   3. psql < the public dump    (recreates companies, deals, notes)
//
// The auth schema is dumped separately and restored FIRST because every
// row in public.* has a user_id foreign key into auth.users. Restore them
// the other way round and every insert fails.
//
// console.log is fine here (unlike in app code, see AGENTS.md - Prohibited
// Patterns): this is a CLI tool whose job is telling the person running it
// what happened.

// Pinned rather than taken from PATH so a backup can't silently change
// behaviour when a differently-versioned CLI is installed globally. Not a
// package.json dependency on purpose: adding it there would put a ~30MB
// binary download into the Vercel build for tooling the deployed app never
// uses.
const SUPABASE_CLI_VERSION = "2.116.0";

// A dump that comes back essentially empty means the CLI ran, said
// nothing, and wrote a header. That is the failure worth catching, because
// it looks exactly like success until the day you need the file.
const MINIMUM_PLAUSIBLE_DUMP_BYTES = 200;

interface DumpTarget {
  schema: string;
  fileName: string;
  description: string;
}

const DUMP_TARGETS: DumpTarget[] = [
  {
    schema: "auth",
    fileName: "01-auth-data.sql",
    description: "user accounts (restore this first)",
  },
  {
    schema: "public",
    fileName: "02-public-data.sql",
    description: "companies, deals and notes",
  },
];

function timestampFolderName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
  ].join("");
}

function dumpSchema(target: DumpTarget, destination: string): number {
  const filePath = join(destination, target.fileName);

  execFileSync(
    "npx",
    [
      "--yes",
      `supabase@${SUPABASE_CLI_VERSION}`,
      "db",
      "dump",
      "--local",
      "--data-only",
      "--schema",
      target.schema,
      "--file",
      filePath,
    ],
    { stdio: "inherit", shell: process.platform === "win32" },
  );

  const { size } = statSync(filePath);

  if (size < MINIMUM_PLAUSIBLE_DUMP_BYTES) {
    throw new Error(
      `${target.fileName} came back at ${size} bytes, which is too small to be a real dump. ` +
        `Is the local stack running? Start it with "npm run db:start" and try again.`,
    );
  }

  return size;
}

function main(): void {
  const destination = join("backups", timestampFolderName(new Date()));
  mkdirSync(destination, { recursive: true });

  console.log(`Backing up the local database to ${destination}\n`);

  for (const target of DUMP_TARGETS) {
    const size = dumpSchema(target, destination);
    console.log(`  ${target.fileName}  ${size} bytes  (${target.description})`);
  }

  console.log(`\nDone. Keep a copy of ${destination} somewhere that is not this laptop.`);
}

main();
