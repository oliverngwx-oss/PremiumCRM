@AGENTS.md

# Premium CRM — Claude Instructions

## Project Purpose

A premium CRM for financial advisors to manage clients, track pipeline opportunities, log activities and notes, set FYC/ANP goals, and search clients using AI-powered natural language filters. The app is single-tenant: each logged-in user sees only their own data.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Forms | React Hook Form + Zod v4 |
| Drag & Drop | @dnd-kit/core |
| Charts | Recharts |
| AI | Anthropic SDK (`claude-sonnet-4-6`) |
| Icons | Lucide React |

---

## Coding Standards

- **TypeScript**: strict mode, no `any` except Supabase query casts (`supabase as any`) where the hand-written `Database` type causes `never` inference
- **Imports**: use `@/` path aliases, never relative `../../`
- **Components**: server components for data fetching, `'use client'` only when interactivity is needed
- **Forms**: always React Hook Form + Zod v4; import Zod as `import { z } from 'zod/v4'`
- **Numeric form fields**: use `z.string()` and parse manually on submit — `z.coerce.number()` causes resolver type errors
- **Supabase queries in pages**: cast client as `const db = supabase as any` to avoid `never` inference with hand-written types
- **No comments** unless the WHY is non-obvious — never explain what the code does
- **No unnecessary abstractions** — solve the task, don't over-engineer
- **No half-finished code** — never leave `// TODO` stubs in committed files
- **Parallel data fetching**: always use `Promise.all` for independent queries in server components

---

## Project Structure

```
app/
  (app)/          # Authenticated routes (layout includes Sidebar + Topbar)
  (auth)/         # Unauthenticated routes (login)
  api/            # Route handlers (server-side only)
components/
  clients/        # Client list, profile, forms, AI filter
  dashboard/      # Metric cards, charts, goal progress
  goals/          # Goal tracking page
  layout/         # Sidebar, Topbar
  pipeline/       # Kanban board
lib/
  supabase/       # client.ts (browser), server.ts (server), middleware.ts
  utils.ts        # formatCurrency, formatDate, getInitials, etc.
supabase/
  migrations/     # Numbered SQL migration files
types/
  database.ts     # Hand-written types matching the DB schema
```

---

## Database Rules

1. **Always filter by `user_id`** — every query must include `.eq('user_id', user.id)`. Never fetch data without scoping to the authenticated user.
2. **Row Level Security is mandatory** — all tables have RLS enabled. Never disable RLS. Never use the service role key client-side.
3. **Explain before applying** — always describe what a migration does and why before running it. Never apply schema changes silently.
4. **Migration files** — new schema changes go in `supabase/migrations/` as numbered files (e.g. `007_description.sql`). Never modify existing migration files.
5. **No raw SQL from users** — AI features must extract structured filter objects; your code builds the queries. Never pass user input directly into SQL.
6. **Supabase `as any` cast** — acceptable only in server components and route handlers to work around hand-written type inference. The UI layer uses proper typed interfaces.
7. **Schema changes require type updates** — whenever the DB schema changes, update `types/database.ts` to match.

---

## User Privacy Rules

1. **Never show one user's data to another** — all queries must scope to `user_id = auth.uid()` in both application code and RLS policies.
2. **No hardcoded user IDs** — always use `user.id` from `supabase.auth.getUser()`.
3. **No data leakage in API routes** — every API route handler must authenticate the request and verify ownership before returning data.
4. **Client-side storage** — never store sensitive data (tokens, personal info) in `localStorage` or `sessionStorage`; Supabase handles session cookies securely.
5. **File uploads** — storage paths must include the user's ID as a prefix (e.g. `{userId}/{clientId}/filename`) so RLS bucket policies can enforce ownership.

---

## UI Design Rules

1. **Premium, clean, and professional** — this is a high-end advisor tool. No cluttered layouts, no garish colors, no placeholder lorem ipsum in production UI.
2. **Color palette**: slate grays for structure, indigo-600 as primary, violet for secondary accents, emerald for success, red for destructive, amber for warnings.
3. **Typography**: small, tight text (`text-xs`, `text-sm`). Headers use `font-semibold`, data uses `tabular-nums`.
4. **Cards**: `rounded-xl bg-white border border-slate-200/80 shadow-sm` — consistent across the app.
5. **Buttons**: primary = `bg-indigo-600 text-white hover:bg-indigo-700`; secondary = `border border-slate-200 text-slate-600 hover:bg-slate-50`; destructive = `bg-red-600 text-white`.
6. **Empty states**: always show a meaningful empty state with an icon, message, and a call-to-action link — never a blank area.
7. **Loading states**: use skeleton placeholders or spinners. Never leave a blank screen while loading.
8. **Responsive**: layouts use `grid-cols-1 md:grid-cols-N` breakpoints. The sidebar collapses on narrow viewports.
9. **No emojis** in UI unless explicitly requested.
10. **No fake/placeholder data** in production components — only in isolated demo/dev contexts when explicitly asked.

---

## Security Rules

1. **Never expose API keys** — `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only. Never reference them in `'use client'` files or pass them to the browser.
2. **Never bypass authentication** — every protected route checks `supabase.auth.getUser()` and redirects to `/login` if no session exists.
3. **Never use the service role key** for normal operations — it bypasses RLS. Only use it for trusted server-side admin tasks if explicitly needed.
4. **Input validation** — validate all user input with Zod before writing to the database. Never trust raw form values.
5. **No command injection** — never pass user input to shell commands or dynamic `eval`.
6. **No SQL injection** — always use Supabase's parameterized query builder. Never concatenate user strings into queries.
7. **AI filter safety** — the AI client search extracts a structured JSON filter object; the server builds all queries. User input never touches the database directly.
8. **CORS / route handlers** — API routes authenticate via Supabase session cookies. No unauthenticated endpoints that touch user data.

---

## Things Claude Must Never Do

- **Never view or return another user's data** — always scope queries to the authenticated user.
- **Never disable or bypass Row Level Security**.
- **Never hardcode a user ID** — always derive it from `supabase.auth.getUser()`.
- **Never expose `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or any secret** in client-side code, logs, or responses.
- **Never bypass the authentication check** — do not remove the `if (!user) redirect('/login')` guard.
- **Never apply a database migration without explaining it first** — describe the change, the reason, and any data impact before running SQL.
- **Never generate fake/seed data** and insert it into the production database unless explicitly asked.
- **Never write raw user input into a SQL query** — always use the Supabase query builder with structured parameters.
- **Never remove or weaken existing RLS policies** without explicit instruction and a clear security justification.
- **Never commit secrets** — `.env.local` is gitignored; never suggest adding real keys to any tracked file.
- **Never use `z.coerce.number()` with `zodResolver`** — use `z.string()` and parse manually; coerce causes TypeScript resolver errors in this project.
- **Never leave placeholder UI** (lorem ipsum, `TODO` comments, dummy buttons that do nothing) in production code.
