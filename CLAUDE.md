# CLAUDE.md — BrowseLater project context

This file is auto-loaded by Claude Code at the start of every session in this repo. Keep it short and load-bearing. The full PRD lives in `PRD.md`. Phased work breakdown lives in `tasks/phase-{0..3}.md`.

---

## What you're building

**BrowseLater** — a single-user personal web app for saving links (articles, YouTube, PDFs, images), extracting their content, and producing per-item detail pages with an extensive summary, key takeaways, and **personalized AI insights** mapped to the owner's five life contexts (Personal, Family, Wealth, Health, Twistag).

Read `PRD.md` in full before starting any new phase. Read `tasks/phase-N.md` for the chunk you're on.

---

## Stack (locked — do not substitute without asking)

- **Framework:** Next.js 14+, App Router, TypeScript, React Server Components where appropriate
- **Hosting:** Vercel
- **AI:** Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) — **Claude only** (no OpenAI fallback). Haiku for summary/tagging, Sonnet for personalized insights + chat.
- **DB:** Supabase (Postgres + pgvector). Use the Supabase JS client. Server Actions for writes.
- **Auth:** Supabase Auth — magic link + Google OAuth
- **Storage:** Supabase Storage for PDFs, image originals, HTML snapshots
- **Background jobs:** Vercel Queues + Cron (fall back to Inngest only if the DAG genuinely needs it — flag this in chat first)
- **UI:** Tailwind + shadcn/ui (Radix primitives)
- **Markdown:** `react-markdown` + `remark-gfm` + `rehype-sanitize` + Shiki for code
- **Extraction:** `@mozilla/readability` + `jsdom` for HTML, Playwright fallback for client-rendered pages, Playwright for YouTube transcript scraping, `pdf-parse` for PDFs, `sharp` for image thumbnails
- **Domain:** browselater.com (Vercel-managed DNS)

---

## Conventions

### Code style
- TypeScript strict mode. No `any` without a `// TODO:` comment explaining why.
- Server Components by default. Add `"use client"` only when you genuinely need browser APIs or interactivity.
- Server Actions for mutations. API routes only for: extraction webhooks, the bookmarklet endpoint, and the streaming chat endpoint.
- Prefer composition over abstraction. Don't introduce a generic helper until the third real caller appears.

### File layout
```
app/
  (auth)/login/page.tsx
  (app)/
    layout.tsx              # signed-in shell
    feed/page.tsx           # list view
    item/[id]/page.tsx      # detail page
    chat/page.tsx
    settings/profile/page.tsx
  api/
    save/route.ts           # POST URL → create item + enqueue job
    bookmarklet/route.ts
    chat/route.ts           # streaming SSE/AI SDK
components/
  ui/                       # shadcn primitives
  feed/                     # list-view components
  detail/                   # detail-page components (header, insights, summary, etc.)
lib/
  ai/                       # Claude prompts, Vercel AI SDK helpers
  extract/                  # one extractor per content type
  db/                       # Supabase client + typed queries
  search/                   # full-text + semantic
workers/
  jobs/                     # async pipeline jobs
supabase/
  migrations/               # SQL migrations
```

### Naming
- React components: PascalCase (`InsightCard.tsx`)
- Server actions: camelCase verbs (`saveUrl`, `regenerateInsights`)
- DB tables: snake_case singular noun (`item`, `insight_card`) — confirm against PRD §9.5 before adding
- Branch names: `phase-N/feature-slug`
- Commits: conventional commits (`feat:`, `fix:`, `chore:`)

### Testing
- Unit tests with Vitest. Co-located `*.test.ts`.
- Playwright for e2e on the save loop and the detail page.
- Don't skip tests on the extraction pipeline — that's where regressions silently hurt the most.

---

## Decisions already made — don't relitigate

| Topic | Decision |
|---|---|
| LLM provider | Claude only (Vercel AI SDK + `@ai-sdk/anthropic`) |
| Paywalls | Skip. Save metadata only, badge as "paywalled." Do **not** build workarounds. |
| YouTube transcripts | Scrape from the video page via Playwright. No paid 3rd-party service. |
| URL redirects | Resolve to canonical at save time. Store both original and canonical. Dedupe on canonical. Strip `utm_*`, `fbclid`, `gclid`. |
| Embedding chunking | 800-token recursive split, 100-token overlap, recursive-character splitter (paragraph → sentence → token). |
| Hosting | Vercel + Supabase. |
| Auth | Single-user. Magic link + Google OAuth via Supabase Auth. |
| Mobile | Responsive web + PWA. **No native apps in v1.** |
| Sharing | None in v1. **Private library only.** |

---

## Personalization profile — important

Every item that goes through AI insights gets the user's personalization profile injected into the system prompt. The profile is markdown and lives in DB as `user_profile.profile_md`, versioned.

**Five contexts**, with one paragraph each in the profile:
- Personal
- Family
- Wealth
- Health
- Twistag, with five sub-areas: Ops · Sales · DevEx · Innovation · Marketing

**Insight cards must be selective.** The model is allowed (and encouraged) to skip contexts when the source doesn't apply. Don't force five cards. PRD §6.3 has the card schema.

---

## What NOT to do

- **Don't add tracking / analytics SDKs.** No PostHog, Segment, GA, Mixpanel. We log events to our own Postgres table. Privacy is a feature.
- **Don't bypass paywalls.** If extraction fails because of a paywall, save metadata only and badge it.
- **Don't introduce a second LLM provider.** Claude only via Vercel AI SDK.
- **Don't add multi-tenancy / workspaces.** Single user. RLS policies should assume `user_id = auth.uid()` everywhere.
- **Don't import design systems beyond shadcn/ui.** No MUI, Chakra, Mantine. shadcn primitives + Tailwind only.
- **Don't render AI output as raw HTML.** All AI output is markdown. Render through `react-markdown` with `rehype-sanitize`.
- **Don't `npm install` an alternative to anything in the locked stack** without flagging it in chat first.

---

## How to work on this repo

1. Start each session by running `git status` and reading the most recent `tasks/phase-N.md` to see what's done and what's next.
2. Pick the next un-checked task in the current phase. Work in a branch.
3. Implement → write tests → run `npm run lint` and `npm test` → open PR with a description that references the task ID.
4. When a phase is complete, update `tasks/phase-N.md` to check all boxes and post a short summary in the PR description.
5. If you discover a decision the PRD doesn't cover, **ask in chat before deciding** — don't quietly improvise architecture.

---

## Useful prompts to run against this repo

- _"Read PRD.md and tasks/phase-0.md. Then scaffold phase 0."_
- _"Implement the YouTube transcript scraper described in PRD §9.1 and the F-5 acceptance criteria. Add Playwright tests."_
- _"Build the detail page layout per PRD §6.1 with placeholder data. Use shadcn primitives only."_
- _"Write the Claude prompt for personalized insights, conforming to the card schema in PRD §6.3. Make it skip irrelevant contexts."_
