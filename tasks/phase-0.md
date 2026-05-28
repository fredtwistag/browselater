# Phase 0 — Foundations

**Goal:** a deployable empty shell at browselater.com with auth working and the DB schema in place. No features yet.

**Estimate:** 1 week.

**Done when:** I can visit browselater.com, log in via magic link or Google, see an empty signed-in shell, and `supabase db diff` shows zero pending migrations against the schema in PRD §9.5.

---

## Tasks

### 0.1 Repo + tooling
- [ ] `npx create-next-app@latest browselater --typescript --tailwind --app --src-dir false --eslint`
- [ ] Add Prettier + Husky + lint-staged. Prettier conflicts with ESLint resolved via `eslint-config-prettier`.
- [ ] Vitest + `@testing-library/react` + Playwright installed; example test in each runs green.
- [ ] `.env.example` committed with all required env vars (Supabase, Anthropic, etc.) — no real values.
- [ ] README in repo root explaining `npm run dev` and the env vars.

### 0.2 Vercel deploy
- [ ] Create Vercel project from the repo. Auto-deploy `main` → production, every PR → preview.
- [ ] Connect the `browselater.com` domain in Vercel. Add `www` → root redirect.
- [ ] Set production + preview env vars (Supabase URL, anon key, service role key, Anthropic API key).

### 0.3 Supabase project
- [ ] Create Supabase project. Enable `pgvector` extension.
- [ ] Configure Supabase Auth: enable email magic link + Google OAuth (Google client ID/secret to be supplied).
- [ ] Wire `@supabase/ssr` into the Next.js app: server client, browser client, middleware refresh.
- [ ] RLS: enable on every table created in 0.4. Default policy `user_id = auth.uid()` for the single user.

### 0.4 Schema migrations
Implement the data model from PRD §9.5. One migration per table. Single-user RLS on all.

- [ ] `items`
- [ ] `item_content`
- [ ] `item_ai`
- [ ] `insight_cards`
- [ ] `tags`, `item_tags`
- [ ] `embeddings` (pgvector column, IVFFlat index)
- [ ] `chat_messages`
- [ ] `user_profile` (with `version` history table or `versioned` column strategy — your call, document it)
- [ ] Indexes: `items(user_id, created_at desc)`, `items(canonical_url)` unique-per-user, `embeddings` IVFFlat
- [ ] Generate TypeScript types via `supabase gen types typescript`

### 0.5 Signed-in shell
- [ ] `/login` page with magic link + "Continue with Google" button (shadcn `Button`, `Input`).
- [ ] `(app)/layout.tsx` — top nav: BrowseLater logo, Feed · Chat · Settings · avatar menu (Sign out).
- [ ] `(app)/feed/page.tsx` — empty state ("No saves yet. Paste a URL to get started.").
- [ ] Auth guard via middleware — unauthenticated users redirected to `/login`.
- [ ] Tailwind + shadcn theme configured for light/dark; `next-themes` wired with system default.

### 0.6 Observability
- [ ] Server log helper that writes structured logs to stdout (Vercel captures them). No 3rd-party analytics.
- [ ] `events` table for app events (event_name, user_id, payload jsonb, created_at). Helper `logEvent()`.

---

## Acceptance test (e2e)

`tests/e2e/phase-0.spec.ts`:
1. Visit `/feed` while signed out → redirected to `/login`.
2. Magic-link login completes → redirected to `/feed`.
3. `/feed` shows the empty state.
4. Click avatar → Sign out → redirected to `/login`.

---

## Out of scope for phase 0
- Any save / extraction logic — phase 1
- AI calls — phase 2
- Detail page typography pass — phase 3
