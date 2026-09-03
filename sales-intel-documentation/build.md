# Sales Intelligence Tool — Build Plan

## What we're building

A focused, single-feature sales intelligence tool: sales reps or managers log deal notes / call notes, and the app uses AI to surface something a plain CRM doesn't — stalled-deal detection with reasoning, auto-summarized next steps, or lead scoring (pick one, see Phase 0).

Goals, in priority order:
1. A portfolio piece that's live, demoable in under 5 minutes, and shows real engineering judgment (not a CRUD clone).
2. A codebase clean enough to explain every decision in an interview.
3. A foundation that *could* become a real product later, without having over-built for that outcome now.

---

## Tech stack, and why

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js** (App Router, TypeScript) | Frontend + backend API routes in one project, one deploy target. Widely used in production, not just a learning tool. |
| Database | **Supabase** (Postgres) | Managed Postgres, generous free tier, gives you Auth for free too — one less service to wire up. |
| Auth | **Supabase Auth** | Don't hand-roll auth. Email/password + magic link out of the box. |
| AI | **Anthropic API** (or OpenAI), called server-side only | Never call an AI API from the browser — your key would be exposed in devtools. Server-side keeps it safe and lets you control cost/rate limits. |
| Styling | **Tailwind CSS** | Fast to build with, easy to keep consistent, no fighting a component library for a solo project. |
| Deploy | **Vercel** | Connects to your GitHub repo, auto-deploys on push to `main`, zero server config. |
| Local dev | `npm run dev` (Next.js dev server) | Hot reload for both frontend and API routes — no separate backend process to manage. |

---

## Project structure (target end-state)

```
sales-intel/
├── app/
│   ├── page.tsx                 # landing/dashboard
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── deals/
│   │   ├── page.tsx             # deal list
│   │   └── [id]/page.tsx        # deal detail + notes + AI insight
│   └── api/
│       ├── deals/route.ts       # CRUD for deals
│       ├── notes/route.ts       # CRUD for notes
│       └── insight/route.ts     # calls the AI API server-side
├── components/
│   ├── DealCard.tsx
│   ├── NoteForm.tsx
│   └── InsightPanel.tsx
├── lib/
│   ├── supabase.ts              # Supabase client setup
│   ├── ai.ts                    # AI API wrapper + prompt logic
│   └── types.ts
├── supabase/
│   ├── config.toml              # local Supabase stack config
│   └── migrations/              # table definitions
├── .env.local                   # secrets, never committed
├── package.json
└── README.md                    # the case-study writeup for recruiters
```

You won't build all of this on day one — it grows phase by phase below.

---

## Build phases

Each phase should leave you with something that *runs*, not a half-finished pile. Commit at the end of each phase.

### Phase 0 — Decide the one feature (no code)
Before touching the keyboard, write one paragraph answering: what's the wedge feature? Recommended pick given your background: **stalled-deal detection with reasoning** — you log deal notes over time, and the AI flags deals that have gone quiet or lost momentum, with a plain-English explanation of *why* it thinks so. It's easy to demo, and the reasoning output is what makes it "non-trivial AI" rather than a wrapper.
Write this down in the README's opening paragraph — you'll thank yourself later.

### Phase 1 — Project scaffold
- `npx create-next-app@latest` (TypeScript, App Router, Tailwind — all yes)
- Push to a fresh GitHub repo
- Deploy immediately to Vercel, even with just the default page — get the pipeline working before you build anything, so every future push just works
- **Checkpoint:** you have a live URL showing the Next.js starter page

### Phase 2 — Database schema
- Create a Supabase project
- Design 3 tables: `companies`, `deals`, `notes` (a deal belongs to a company, notes belong to a deal)
- Write the initial migration in `supabase/migrations/`, applied by `npm run db:start` locally or run in the Supabase SQL editor for a hosted project
- Add `lib/supabase.ts` with the client setup, using env vars
- **Checkpoint:** you can insert/query rows from the Next.js app in a quick test API route

### Phase 3 — Auth
- Wire up Supabase Auth: a login page, session handling, protect the `/deals` routes
- **Checkpoint:** you can sign up, log in, log out, and unauthenticated users get redirected

### Phase 4 — Core CRUD (deals + notes)
- `app/deals/page.tsx`: list deals for the logged-in user
- `app/deals/[id]/page.tsx`: deal detail page, list of notes, form to add a note
- API routes for create/read on deals and notes
- **Checkpoint:** you can create a deal, add notes to it, and see them persist after refresh

### Phase 5 — The AI feature
- `lib/ai.ts`: a function that takes a deal's notes (with timestamps) and returns a structured result — status (`healthy` / `stalling` / `at risk`) plus a short reasoning string
- `app/api/insight/route.ts`: server-side route that calls this, so the API key never reaches the browser
- `components/InsightPanel.tsx`: shows the result on the deal detail page
- Spend real time on the prompt here — this is the part that's actually hard and actually differentiates the project. Give the model the note history with dates and ask it to reason about momentum, not just summarize.
- **Checkpoint:** open a deal, click "Analyze", get a real reasoned status back

### Phase 6 — Seed data + demo polish
- Write a seed script that creates a handful of fake companies, deals, and realistic note histories (including at least one obviously-stalling deal, so the AI feature has something to catch)
- Add basic empty states, loading states, and a clean landing page that explains what the app does in one sentence
- **Checkpoint:** a stranger could land on the URL, sign in with a demo account, and understand the app in under a minute

### Phase 7 — Write the README (case-study style)
Structure:
1. One-paragraph pitch — the problem, the audience (sales reps/managers), what it does
2. Why this isn't a chatbot wrapper — explain the reasoning approach
3. Architecture diagram or bullet list of the stack, with the "why" for each choice
4. Screenshot or short GIF of the insight feature in action
5. Live demo link + demo login credentials
6. "What I'd build next" section — shows product thinking beyond the MVP

### Phase 8 (optional, later) — Productization groundwork
Only after Phase 7 is live and polished:
- Multi-tenancy (data isolation between different companies/orgs using the tool)
- Billing (Stripe)
- Validate demand with a few real conversations with people in sales orgs
- Desktop packaging / App Store — a distribution decision, not a v1 requirement

---

## Notes for build order

- Don't start Phase 5 (the AI feature) until Phases 1–4 are solid. It's tempting to jump straight to the "interesting" part, but a working CRUD foundation makes the AI feature easy to plug in instead of fighting the rest of the app around it.
- Commit after every checkpoint above, with a message that says what actually changed — your git history is part of what recruiters skim.
- If a phase is taking more than a session or two, it's a sign to cut scope, not push through — simplicity was the goal you set.
