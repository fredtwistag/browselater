# BrowseLater

A personal web app for saving links (articles, YouTube, PDFs, images), extracting their content, and producing per-item detail pages with an extensive summary, key takeaways, and **personalized AI insights** mapped to your five life contexts (Personal, Family, Wealth, Health, Twistag).

Full spec: [`PRD.md`](./PRD.md). Conventions and locked decisions: [`CLAUDE.md`](./CLAUDE.md). Phased work: [`tasks/`](./tasks/).

---

## Getting started locally

```bash
# 1. Install
npm install
npx playwright install --with-deps chromium

# 2. Configure env
cp .env.example .env.local
#    then fill in:
#    - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
#    - ANTHROPIC_API_KEY
#    - VOYAGE_API_KEY (for embeddings + semantic search; without it, search is FTS-only)
#    - BOOKMARKLET_SIGNING_SECRET (any 32+ char random string)

# 3. Push the schema to Supabase
supabase link --project-ref <your-project-ref>
supabase db push

# 4. Generate DB types (optional — hand-typed types in lib/db/types.ts are kept in sync)
supabase gen types typescript --linked > lib/db/database.types.ts

# 5. Run
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`.

## Scripts

| Command             | Purpose            |
| ------------------- | ------------------ |
| `npm run dev`       | Next.js dev server |
| `npm run build`     | Production build   |
| `npm run lint`      | ESLint             |
| `npm run typecheck` | `tsc --noEmit`     |
| `npm test`          | Vitest unit tests  |
| `npm run test:e2e`  | Playwright e2e     |
| `npm run format`    | Prettier           |

## Architecture (one-paragraph)

Next.js App Router + Server Actions for writes, Supabase (Postgres + pgvector) for data, Supabase Auth (magic link + Google), Supabase Storage for snapshots/PDFs/images. Save flow: `POST /api/save` resolves canonical URL → inserts placeholder → fires `enqueueExtract` → `/api/worker/extract` runs the extractor pipeline (article/YouTube/PDF/image) → AI pipeline runs Claude Haiku for summary+tags and Claude Sonnet for personalized insights, with the user profile injected into the system prompt. Vercel AI SDK is the only LLM interface; Voyage AI handles embeddings (1024-dim, IVFFlat). Chat uses RAG over those embeddings with FTS fallback. UI is shadcn/Tailwind. Detail page is single-column reading column for the summary + an at-a-glance sticky card and insight cards mapped to context tints.

## Deploy notes

- **Vercel**: standard Next.js project. Add the env vars from `.env.example` to both Production and Preview.
- **`maxDuration`** on `/api/worker/extract` is set to 300s — works on Vercel Pro; on Hobby you'll hit 60s and large transcripts may not complete. Move the worker to Inngest later if this becomes a problem (see [`tasks/phase-1.md`](./tasks/phase-1.md)).
- **Playwright** for YouTube scraping needs Chromium installed in the runtime. On Vercel, this means the `nodejs` runtime and either the `playwright` package's bundled browsers (sometimes too large) or `@sparticuz/chromium` (smaller, recommended for prod). The current code uses bare `playwright`; switch to `@sparticuz/chromium` if Vercel rejects the bundle size.
- **Supabase Realtime**: enable on the `items` table so the detail page can subscribe to status changes. Without it, the page falls back to a 5s poll.

## Where things live

```
app/
  (auth)/login/           # magic link + Google OAuth UI
  (app)/                  # signed-in shell
    feed/                 # list view
    item/[id]/            # detail page
    chat/                 # chat with library
    search/               # FTS + semantic search
    settings/profile/     # personalization profile editor + bookmarklet
  api/
    save/                 # POST URL → create item + enqueue
    bookmarklet/          # bookmarklet endpoint (signed token)
    chat/                 # SSE streaming via Vercel AI SDK
    worker/extract/       # background pipeline entry
  auth/callback/          # OAuth/Magic-link return
components/
  ui/                     # shadcn primitives
  feed/                   # list view components
  detail/                 # detail page components
  shell/                  # top nav, etc.
lib/
  ai/                     # Claude clients + prompts + chunking + embeddings
  db/                     # typed Supabase types
  extract/                # url canonicalization + per-type extractors
  search/                 # FTS + semantic merge
  supabase/               # browser / server / service / middleware clients
workers/
  jobs/                   # extract + ai pipelines
  queue.ts                # enqueue helper
supabase/
  migrations/             # SQL schema (PRD §9.5)
tests/
  e2e/                    # Playwright
```

## Privacy

No 3rd-party analytics SDKs. Events log to our own `events` Postgres table. Data sent externally: Claude API + YouTube page scrape only. Personalization profile is sent to Claude with every save (PRD §6.3 privacy note).
