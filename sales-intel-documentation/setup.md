# Dev Environment Setup — sales-intel

Covers Phase 1–3 of build.md: scaffold, database, auth. Do these in order — each step assumes the previous one worked. Budget more time for the Supabase/env var steps than the scaffold itself; that's usually where setup actually snags.

---

## 0. Prerequisites check

Open your MINGW64 terminal and confirm these are installed:

```bash
node -v      # want 18.18+ or 20+
npm -v
git -v
```

If Node is missing or too old, install the current LTS from nodejs.org — the installer handles npm too.

---

## 1. Scaffold the Next.js app

```bash
cd /d/projects
npx create-next-app@latest sales-intel
```

When prompted, answer:
- TypeScript → **Yes**
- ESLint → **Yes**
- Tailwind CSS → **Yes**
- `src/` directory → **No** (keep `app/` at root, matches build.md structure)
- App Router → **Yes**
- Import alias (`@/*`) → **Yes**, default is fine

```bash
cd sales-intel
npm run dev
```

**Checkpoint:** open `http://localhost:3000` — you should see the Next.js starter page.

Stop the server (`Ctrl+C`) before continuing.

---

## 2. Connect it to GitHub

```bash
git init
git add .
git commit -m "Initial Next.js scaffold"
```

Create an empty repo on GitHub named `sales-intel` (no README/gitignore — you already have those locally), then:

```bash
git remote add origin https://github.com/nicomeihuizen-byte/sales-intel.git
git branch -M main
git push -u origin main
```

---

## 3. Deploy the empty shell to Vercel (do this now, not later)

1. Go to vercel.com, sign in with GitHub
2. "Add New Project" → import `sales-intel`
3. Leave all defaults (Vercel auto-detects Next.js) → Deploy

**Checkpoint:** you get a live `.vercel.app` URL showing the same starter page. This confirms your deploy pipeline works before there's anything complex to break — every `git push` to `main` from here on auto-deploys.

---

## 4. Create the Supabase project

1. Go to supabase.com → sign in → "New Project"
2. Name: `sales-intel`, pick a region close to you (Frankfurt/EU West for NL), set a database password — **save that password somewhere**, you'll want it later for direct DB access
3. Wait ~2 minutes for provisioning

Once ready, go to **Project Settings → API** and note down:
- **Project URL**
- **anon/public key**

You'll need both in the next step.

---

## 5. Set up local environment variables

In `/d/projects/sales-intel/`, create `.env.local`:

```bash
touch .env.local
```

Add these lines (replace with your actual values from Step 4):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

Confirm it's gitignored (it should be by default from `create-next-app`):

```bash
git check-ignore .env.local
```

If that prints `.env.local`, you're safe — it won't get committed. If it prints nothing, add `.env.local` to `.gitignore` manually before going further.

---

## 6. Install the Supabase client

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Create `lib/supabase.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

---

## 7. Create the database schema

In the Supabase dashboard, go to **SQL Editor → New Query**, paste and run:

```sql
create table companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamptz default now()
);

create table deals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies not null,
  user_id uuid references auth.users not null,
  title text not null,
  status text default 'open',
  created_at timestamptz default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references deals not null,
  user_id uuid references auth.users not null,
  content text not null,
  created_at timestamptz default now()
);

-- Row Level Security: users only see their own data
alter table companies enable row level security;
alter table deals enable row level security;
alter table notes enable row level security;

create policy "Users manage own companies" on companies
  for all using (auth.uid() = user_id);
create policy "Users manage own deals" on deals
  for all using (auth.uid() = user_id);
create policy "Users manage own notes" on notes
  for all using (auth.uid() = user_id);
```

**Checkpoint:** go to **Table Editor** in Supabase, confirm all three tables exist with the RLS lock icon shown.

---

## 8. Verify the local app can reach Supabase

Create a throwaway test route to confirm the connection before building real features. `app/api/test/route.ts`:

```ts
import { createClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase.from('companies').select('*')
  return NextResponse.json({ data, error })
}
```

```bash
npm run dev
```

Visit `http://localhost:3000/api/test` — you should get `{"data":[],"error":null}` (empty array is correct, you haven't added any companies yet).

**Delete this test route once confirmed** — it's not part of the real app.

---

## 9. Set up Supabase Auth

1. In Supabase dashboard: **Authentication → Providers**, confirm Email is enabled (it is by default)
2. **Authentication → URL Configuration**: set Site URL to `http://localhost:3000` for now (you'll add your Vercel URL here too once you're deploying real auth flows)

This is enough to start building the login page in Phase 3 of build.md — the actual login UI/logic is application code, not environment setup, so it's covered separately when you get there.

---

## 10. Get your AI API key ready (for Phase 5, set up now while you're at it)

1. Go to console.anthropic.com (or platform.openai.com if you're going that route) → create an API key
2. Add it to `.env.local`:

```
ANTHROPIC_API_KEY=your-key-here
```

No `NEXT_PUBLIC_` prefix on this one — it must stay server-side only, never exposed to the browser. You won't use it until Phase 5, but it's one less thing to context-switch back to later.

---

## Done — what you should have now

- [ ] Next.js app running locally on `localhost:3000`
- [ ] Repo pushed to GitHub, auto-deploying to Vercel on push
- [ ] Supabase project created, schema in place, RLS enabled
- [ ] `.env.local` populated and confirmed gitignored
- [ ] Test route confirmed the app can talk to Supabase
- [ ] AI API key ready for later

From here, Phase 3 (Auth UI) and Phase 4 (deal/note CRUD) in build.md are pure application code — no further environment setup needed until Phase 5's AI integration, which just uses the key you already added above.
