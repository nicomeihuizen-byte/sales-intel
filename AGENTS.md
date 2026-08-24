# Naming
- Constants: UPPER_CASE
- Classes and interfaces: PascalCase
- Enums: PascalCase
- Functions and methods: camelCase
- Variables and parameters: camelCase
- File names: kebab-case, with two exceptions:
  - React component files use PascalCase matching the default export (e.g. `DealCard.tsx`, `NoteForm.tsx`, `InsightPanel.tsx`).
  - Next.js App Router reserved files keep their framework-mandated names exactly as required (`page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, etc.) — these are not stylistic choices and are never renamed.

# Conventional commit formatting
- Commit message format: `<type>(<scope>): <subject>`
- Commit types: feat, fix, docs, style, refactor, perf, test, chore
- Commit scope: the app area being changed — `deals`, `notes`, `insight`, `auth`, `db`, `ui`, or a specific file/module when the change is narrower
- Commit subject: a short description of the change, written in the imperative mood
- Commit body: a more detailed description of the change, including the motivation and context

# Formatting
- Language: "TypeScript"
- Language-version: latest stable shipped by `create-next-app` at project init (do not pin to an old version; verify against `package.json`, not memory)
- Language-features: "ES6 modules, async/await, decorators"
- Framework: "Next.js (App Router)"
- Styling: "Tailwind CSS"
- Formatting: "Prettier - Prettier owns all formatting; ESLint enforces code-quality rules only"

# Testing
- Testing-framework: "Jest" configured via `next/jest` (handles the Next.js compiler/transform pipeline — do not hand-roll a separate ts-jest config)
- Testing-library: React Testing Library for component tests
- Testing-coverage: "80%" — scoped to `lib/` and `app/api/**/route.ts` business logic. Server components and page-level UI are covered by integration/manual checks, not folded into the coverage number, since they can't be unit-tested the normal way.
- Testing-mocks: `jest.mock()` for external dependencies — always mock the Supabase client and the Anthropic/OpenAI client in unit tests; never hit real external services in a test run
- Testing-assertions: "expect() for assertions"
- Testing-setup: "beforeEach() and afterEach() for setup and teardown"
- Testing-async: "async/await for asynchronous tests"
- Testing-snapshot: "jest-snapshot for snapshot testing"
- Testing-strategy: "every new function gets one unit test per branch; integration tests only for cross-module flows (e.g. an API route touching both Supabase and the AI wrapper)."

# Prohibited Patterns
- No console.log in production code
- No `any` type
- No `var` keyword
- No nested ternary operators
- No AI/LLM API key (Anthropic or OpenAI) ever referenced, imported, or reachable from a client component — it is only ever read inside a server-only module (`lib/ai.ts`) called from a route handler
- No Supabase service-role key used anywhere outside trusted server code — client-side code only ever uses the anon key, and relies on RLS to enforce access

# Code Review / Explanation Standards
- Fetch/network calls: check response.ok and throw a typed error on failure — never return a parsed body without validating status first
- Explanations: name the actual variables, branches, and edge cases — someone should be able to predict the output for a specific input without reading the code
- Suggestions: reference a specific file, function, or line number and describe the concrete change — no open-ended "add more tests" without naming the missing case
- Avoid generic explanations like "this function does X" — instead, explain how it does X, what inputs it expects, and what outputs it produces
- Explain the reasoning behind a suggestion — why is it better than the current implementation, and what trade-offs are being made?
- Verify source of truth for any external data or API responses (Supabase rows, AI API output) — do not assume the data is correct or well-formed without validation, especially the AI insight response, which should be parsed against an expected shape and rejected/retried if it doesn't match
- If a function has multiple branches, explain the expected output for each branch and the conditions that lead to it — do not just describe the happy path

# API & Secrets Handling
- All calls to the Anthropic/OpenAI API happen inside `app/api/insight/route.ts` (via `lib/ai.ts`), never from a client component, a `"use client"` file, or anything shipped to the browser
- `.env.local` holds all secrets and is never committed; `.env.example` (committed) lists variable names only, no values
- Never log secrets, tokens, API keys, or full request/response bodies containing auth headers — redact before logging, and never expose full internal error messages/stack traces to the client response

# Database & Supabase
- Row Level Security (RLS) must be enabled on every table before it is queried from the app — an app-level auth check is not a substitute for RLS, it's a second layer on top of it
- App-level queries go through the Supabase JS query builder (`.select()`, `.eq()`, etc.), which parameterizes under the hood — never build a query by concatenating a raw SQL string with user input
- Raw SQL is only permitted in `supabase/schema.sql` (migrations/DDL), not in application code
- `lib/supabase.ts` is the single place the client is constructed; don't instantiate ad hoc clients elsewhere

# Auth & Sessions
- Use Supabase's official `@supabase/ssr` cookie/session helpers for auth state — don't hand-roll session cookie handling
- Where a raw cookie is set outside of that helper (rare), it must be `HttpOnly`, `Secure`, and `SameSite=Strict` (or `Lax` only if a cross-site GET flow requires it) — never store a session token in `localStorage` or `sessionStorage`

# HTML and JavaScript Security Hardening
- Never assign to `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `document.write` with a string built from user input, query params, route params, or API response data — build DOM nodes with `createElement`/`textContent`, or sanitize with DOMPurify first. In React/JSX, this means never using `dangerouslySetInnerHTML` with unsanitized content.
- Never pass user-controlled strings into `eval()`, `new Function()`, `setTimeout(string, ...)`, or `setInterval(string, ...)` — pass a function reference instead
- Never bind user-controlled data to `href`, `src`, `formaction`, or `action` without validating the scheme against an allowlist (`https:`, `mailto:`) — reject `javascript:`, `data:`, and `vbscript:` schemes
- Set a `Content-Security-Policy` via `next.config.js` `headers()` (or middleware), applied to all routes — no `unsafe-inline` or `unsafe-eval` in `script-src`; inline scripts get a nonce or move to an external file
- State-changing API routes (`POST`/`PUT`/`PATCH`/`DELETE`) rely on `SameSite=Strict` cookies plus origin/referer checks, or a CSRF token if that's not sufficient for a given flow — never trust a request based on cookie presence alone
- Validate and allowlist file upload extensions and MIME types server-side if/when uploads are added (never trust the client-supplied `Content-Type`), store uploads outside the web root or in object storage, and serve them with `Content-Disposition: attachment` unless the type is explicitly meant to render
- Any redirect target taken from user input (`returnUrl`, `next`, `redirect` params) must be checked against an allowlist of relative paths or known hosts — never issue a redirect straight from an unchecked query param
- Every dependency update must be checked against `npm audit` / a CVE database before merge — no direct `fetch`/`import` of third-party scripts from a CDN without a Subresource Integrity (`integrity`) hash
- Postmessage handlers must validate `event.origin` against an allowlist before processing `event.data` — never process a message from `*` origin without that check

# Guarding against vague code
- Avoid vague variable names like `data`, `info`, or `temp` — use descriptive names that convey the purpose and type of the variable
- Avoid vague function names like `processData` or `handleEvent` — use names that clearly describe the action being performed
- Avoid vague class names like `Manager` or `Helper` — use names that reflect the specific responsibility or role of the class
- Avoid vague comments like `// do something` or `// handle error` — provide specific details about what is being done and why

# Webpage SEO & Metadata (Next.js)
- Use the Next.js Metadata API — `export const metadata` (static) or `generateMetadata()` (dynamic, e.g. `deals/[id]`) — never hand-write `<meta>`/`<link>` tags into a `<head>` element
- Every public page's metadata includes: `title`, `description`, `alternates.canonical` (full production URL), `openGraph` (`title`, `description`, `images` with absolute URL, `url` matching canonical, `type` — `website` for the landing page), and `twitter` (`card: 'summary_large_image'`, `title`, `description`, `images`)
- Add JSON-LD via a `<script type="application/ld+json">` inside the relevant page/layout, matching content type: `Person`/`Organization` for landing, `WebApplication` or `SoftwareApplication` for the product itself
- If this CRM tool stays fully behind auth (no public marketing pages), this section only applies to whatever landing/demo page is public

# Webpage Heading Hierarchy
- Exactly one `<h1>` per page, matching the page's actual subject (not a generic placeholder)
- Never use a `<div>` or `<span>` styled to look like a heading as the sole heading for a section — screen readers and search engines don't see it as a heading
- Any visual "label" above a content block must be a real `<h2>`/`<h3>` if it's the only heading for that block

# Images (Next.js)
- Use `next/image` for every image — it handles lazy loading below the fold, responsive `srcset`, and modern formats automatically, so don't hand-build `<picture>`/WebP fallbacks or manual `loading="lazy"` attributes
- Always pass accurate `width`/`height` (or use `fill` with a sized parent) so `next/image` can prevent layout shift — verify real dimensions, never guess
- Every image needs specific, unique `alt` text describing what's actually shown (not a generic phrase repeated across images)

# Text Formatting for Generated Prose
- Never use an em dash (`—`) or en dash used as a pause (` – `) in generated copy — split into two sentences or use a comma/period instead
- Never write long run-on sentences that stack multiple clauses with commas. Cap sentences at one main clause plus at most one comma-separated clause; split the rest into a new sentence.
  - Not permitted: "My career has been shaped by a deep understanding of data centers, cloud infrastructure, and IaaS/PaaS environments, combined with a proven ability to translate complex technical offerings into business value."
  - Required: "My career has been shaped by a deep understanding of data centers, cloud infrastructure, and IaaS/PaaS environments. Combined with a proven ability to translate complex technical offerings into business value."
- This section applies to prose/copy (README, landing page copy, docs) — not code comments or commit messages, which follow the Conventional Commit rules above.
