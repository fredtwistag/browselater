# BrowseLater — Product Requirements Document

**Domain:** browselater.com
**Status:** Draft v2.0 — open questions resolved, ready for build
**Owner:** Fred Sarmento (Twistag)
**Audience:** Engineering team (Claude Code is the implementer)
**Date:** 2026-05-28

> _Save anything. Read it later. Make it yours._

---

## 1. Executive Summary

BrowseLater is a personal web application for saving, organizing, and re-using links the user comes across — articles, YouTube videos, PDFs, and images. Unlike a bare bookmarks bar, BrowseLater fetches the content behind each link (article body, video transcript, PDF text, image metadata) so the saved item becomes a fully indexed, searchable record in a private library.

On top of that extraction layer, BrowseLater uses Claude (via the Vercel AI SDK) to turn each saved item into a structured detail page: an extensive summary, key takeaways, and — most importantly — **personalized insights** mapped to the contexts that matter to the owner (personal life, family, wealth, health, and Twistag work across ops, sales, devex, innovation, and marketing). The library is also fully chattable: ask a question, get an answer grounded in saved content with source citations.

The end goal is to convert passive saves into compounding knowledge that is already personalized — a save is not just stored, it is interpreted in relation to the owner's life and business.

**One-line pitch:** _"Pocket meets Notion meets ChatGPT — a private web app that saves anything I link, extracts the full content, and tells me what it means for me, my family, and Twistag."_

---

## 2. Problem Statement

The owner saves interesting links across at least four disconnected places today: browser bookmarks, the YouTube "Watch Later" queue, the Notes app, and Slack "saved items." None of these capture the content behind the link — only the URL — so re-finding a specific idea requires remembering where it was saved and re-opening the source, which is often paywalled, broken, or buried in a long video.

Worse, even when the source is re-found, the original lift remains: read the whole article or watch the whole video to extract the part that applies. The library compounds nothing — every revisit is full-cost.

**Evidence:**
- The owner maintains 4+ separate save surfaces with no cross-search.
- YouTube saves are particularly opaque — no way to find "the video where the founder talked about pricing experiments" without re-watching.
- Existing tools (Pocket, Raindrop, Instapaper) cover articles well but handle video transcripts poorly and have no personalized interpretation layer for the user's specific contexts.

---

## 3. Goals

### User goals
- **Save anything in under 3 seconds.** One paste or one bookmarklet click captures URL + underlying content.
- **Get a detail page worth opening.** Every saved item produces a beautifully typeset page with summary, key takeaways, and personalized insights — not just a stored URL.
- **Re-find any saved idea in under 10 seconds.** Full-text + semantic search across all content types.
- **Ask questions across the library.** Natural-language Q&A grounded in saved content with citations.

### Business / personal goals
- **Consolidate save surfaces.** Replace at least 3 of the 4 current save destinations within 60 days.
- **Compound knowledge.** Re-visit rate ≥25% (saved items opened again within 30 days).
- **Make saves actionable for Twistag.** ≥20% of saves should produce a Twistag-relevant insight the owner thumbs-ups.

---

## 4. Non-Goals (v1)

| Non-goal | Why out of scope |
|---|---|
| Multi-user / sharing | Personal tool. Single-user auth. Sharing → v2. |
| Native mobile app | v1 is responsive web + PWA. Native → later. |
| Browser extension | Deferred to v1.1. v1 ships paste-URL + bookmarklet. |
| Inline highlights/annotations | Out of scope. Notes per item is the substitute. |
| Podcast / generic audio transcription | v1 transcribes YouTube only (page-scrape). Whisper-class → later. |
| Paywalled articles | If extraction fails due to paywall, save metadata only with badge. No workarounds. |
| Public discovery / social | Private library. No following, no profiles. |

---

## 5. User & Contexts

v1 has a single user — the owner. Personalization is anchored to the five contexts below. The AI uses these when producing the personalized insights on each detail page.

### 5.1 The owner

- **Profile:** Fred Sarmento — co-founder/operator at Twistag (a software consultancy). Family man. Saves 5–15 items per week across articles, YouTube, PDFs.
- **Pain:** Saves outpace consumption; ideas are rarely re-found; nothing connects what he reads to what he does.
- **Success:** Opens BrowseLater weekly, finds 1–2 items he had forgotten, and uses ≥1 insight per week in family/personal/Twistag decisions.

### 5.2 The five contexts

| Context | Description | Example insight |
|---|---|---|
| **Personal** | Habits, learning, productivity, side projects, mindset. | "This habit-stacking technique would fit your morning routine after the gym." |
| **Family** | Wife, kids, parenting, home logistics, family rituals. | "20-min outdoor break after school improves kids' focus — easy to add Mon/Wed." |
| **Wealth** | Personal finance, investing, taxes, long-term planning. | "Points to rebalancing toward small-caps; Q3 review item." |
| **Health** | Fitness, nutrition, sleep, recovery, longevity. | "This zone-2 protocol fits your 4-day week; would replace current LISS sessions." |
| **Twistag** | Operations and growth across five sub-areas: **Ops**, **Sales**, **DevEx**, **Innovation**, **Marketing**. | "Twistag · Sales: discovery-call framework could replace our current intake questionnaire." |

---

## 6. The Detail Page (Core Feature)

The detail page is where most of BrowseLater's value is delivered. It must read like a well-designed magazine article + briefing memo — never like a database record.

> **Design intent:** opening a detail page should feel like getting a hand-written briefing on the source — what it said, what mattered, and what it means for me specifically.

### 6.1 Anatomy

| Section | Contents | Source |
|---|---|---|
| **Header** | Title, source URL, author, publish date, content-type icon, hero image, saved-at, read time | Extracted metadata |
| **At-a-glance card** | Sticky card: 2-sentence TL;DR, 3 tags, content type, primary context | Claude (Haiku) on save |
| **Extensive summary** | 400–800 words, clean markdown (headings, paragraphs, blockquote of original) | Claude on save, streamed via Vercel AI SDK |
| **Key takeaways** | 5–8 opinionated bullet sentences | Claude on save |
| **Tables** | When source content fits, render comparisons/frameworks/steps as markdown tables | Claude — part of the AI markdown |
| **Personalized insights** | One card per relevant context. See §6.3. | Claude (Sonnet) on save |
| **Original media** | YouTube embed with transcript scrubber; PDF inline viewer; image lightbox | Stored snapshot |
| **Full extracted content** | Collapsed by default. Expand to read full extracted text. | Extraction pipeline |
| **My notes** | Markdown notes field, autosaved | User-entered |
| **Actions** | Archive, Delete, Re-run AI, Copy summary, Open source | Built-in |

### 6.2 Markdown rendering

All AI long-form output is markdown, rendered by the UI.

- **Renderer:** `react-markdown` + `remark-gfm` (tables, task lists) + `rehype-sanitize`
- **Typography:** see §13.2. Long-form readability — generous line-height, comfortable measure, large headings
- **Tables:** zebra rows, sticky header on long tables, overflow-x on mobile
- **Code:** Shiki syntax highlighting (server-rendered)

### 6.3 Personalized insights

The headline feature. After extraction + summarization, Claude is prompted with the source content **plus** a personalization profile describing the owner's five contexts. The model returns one insight card per context it judges relevant — **never all five forced**, only the ones that meaningfully apply.

**Insight card shape:**

| Field | Description |
|---|---|
| Context | Personal · Family · Wealth · Health · Twistag·Ops · Twistag·Sales · Twistag·DevEx · Twistag·Innovation · Twistag·Marketing |
| Headline | One sentence summarizing the insight |
| Why it applies to you | 2–4 sentences linking the source to the owner's known situation |
| Suggested action | 1–3 concrete bullet actions |
| Confidence | low/medium/high — visual chip |
| Feedback | thumbs up/down — drives prompt tuning and §11 metrics |

**Personalization profile:** a single editable markdown document stored in DB as `user_profile`. Injected into the system prompt of every insight call. User edits in Settings. Versioned — history is preserved so old runs are reproducible.

Initial fields: About me · Family snapshot · Wealth context · Health context · Twistag context (one paragraph per sub-area).

> **Privacy note:** the personalization profile is sent to Claude with every save. It contains personal/family/financial/health context. The user is the only one who can edit or read it; it is encrypted at rest; it is never logged in plain text in app analytics.

### 6.4 Re-run AI

Each detail page has a "Re-run AI" action. Useful when (a) the user just edited their profile, (b) the model improved, or (c) the user marked output unhelpful. Re-runs are versioned — old outputs kept in history.

---

## 7. User Stories

Ordered by priority. See §10 for acceptance criteria.

### Saving
- **US-1:** As the owner, I want to paste any URL so the content behind it is fetched and saved automatically.
- **US-2:** As the owner, I want a bookmarklet so I can save the current tab with one click.
- **US-3:** As the owner, when I save a YouTube URL, I want the transcript scraped from the page so the video becomes searchable text.
- **US-4:** As the owner, when I save a PDF URL, I want the extracted text indexed.
- **US-5:** As the owner, when I save an image URL, I want a thumbnail + OG/alt metadata captured.

### Detail page
- **US-6:** As the owner, I want each item to have a detail page with an extensive summary.
- **US-7:** As the owner, I want key takeaways so I can scan the value in 15 seconds.
- **US-8:** As the owner, I want personalized insight cards mapped to my contexts.
- **US-9:** As the owner, I want thumbs up/down on each insight so the AI improves.
- **US-10:** As the owner, I want to edit my personalization profile.
- **US-11:** As the owner, I want a "Re-run AI" action.

### Organizing
- **US-12:** Auto-tag each item with 3–7 topical tags.
- **US-13:** Override / add tags manually.
- **US-14:** Archive processed items.

### Re-finding
- **US-15:** Full-text search across all extracted content.
- **US-16:** Semantic search by describing the idea.
- **US-17:** Filter by context (e.g. "all Twistag · Sales insights").
- **US-18:** Chat with the library; answers cite source items.

### Edge cases
- **US-19:** Extraction failure → save anyway with clear error state.
- **US-20:** Source goes dark later → snapshot preserves content.
- **US-21:** First-launch empty state.

---

## 8. Requirements

### 8.1 Functional (MoSCoW: P0=must, P1=fast-follow, P2=future)

| ID | Requirement | Priority |
|---|---|---|
| F-1 | Save by pasting URL into a single input on the home screen | P0 |
| F-2 | Save via bookmarklet | P0 |
| F-3 | Content-type detection: article, YouTube, PDF, image, generic | P0 |
| F-4 | Article extraction (Readability-style: body, title, author, hero, date) | P0 |
| F-5 | YouTube extraction: metadata + full transcript with timestamps, scraped from the video page via Playwright | P0 |
| F-6 | PDF extraction: text + page count, original stored | P0 |
| F-7 | Image extraction: thumbnail + OG/alt metadata | P0 |
| F-8 | Resolve redirect chains, dedupe on canonical URL, store original + canonical | P0 |
| F-9 | Detail page (see §6.1) | P0 |
| F-10 | AI summary (400–800 word markdown), streamed via Vercel AI SDK + Claude | P0 |
| F-11 | AI key takeaways (5–8 bullets) | P0 |
| F-12 | Personalized insight cards (see §6.3) | P0 |
| F-13 | Markdown rendering: tables, blockquotes, code, task lists | P0 |
| F-14 | Editable, versioned personalization profile in Settings | P0 |
| F-15 | Re-run AI action, outputs versioned | P0 |
| F-16 | Thumbs up/down on each insight card | P0 |
| F-17 | Auto-tag with 3–7 tags, user can edit | P0 |
| F-18 | List view with filters (type, tag, context, read/unread) | P0 |
| F-19 | Full-text search | P0 |
| F-20 | Semantic search via pgvector | P0 |
| F-21 | Chat with library (RAG, streamed, citations) | P0 |
| F-22 | Archive + delete with 30-day trash | P0 |
| F-23 | Notes field per item (markdown, autosaved) | P0 |
| F-24 | Browser extension (Chrome, Firefox) | P1 |
| F-25 | PWA with web-share-target | P1 |
| F-26 | Image OCR | P1 |
| F-27 | Weekly digest email | P1 |
| F-28 | Export to JSON / Markdown | P1 |
| F-29 | Highlight + annotation reader view | P2 |
| F-30 | Native iOS/Android | P2 |
| F-31 | Sharing via signed public links | P2 |

### 8.2 Non-functional

| Category | Requirement |
|---|---|
| Performance | Save returns <1.5s. List loads <500ms for 10k items. Detail renders <800ms, summary streams progressively. |
| Reliability | Extraction success ≥90% across top 50 domains. 3× retry on failure. |
| Availability | 99% monthly. Vercel Hobby is enough. |
| Security | Supabase Auth (magic link + Google OAuth). HTTPS only. Encrypted at rest. Bookmarklet uses per-user token, not session cookies. Profile encrypted, never logged. |
| Privacy | No 3rd-party analytics SDKs. Data sent externally: Claude API + YouTube page-scrape only. Both listed in Settings → Privacy. |
| Cost | <$25/month at ~50 saves/wk, ~200 chat queries/mo. |
| Accessibility | WCAG 2.1 AA on list/detail/chat. Keyboard shortcuts. |
| Responsive | Usable at 375px. Detail page single-column on mobile. |

---

## 9. Technical Architecture

### 9.1 Stack (locked for v1)

| Layer | Choice |
|---|---|
| Framework | Next.js 14+ (App Router), TypeScript, React Server Components |
| Hosting | **Vercel** |
| AI SDK | **Vercel AI SDK** (`ai` + `@ai-sdk/anthropic`) for streaming |
| LLM | **Claude only** — Haiku for tagging/summary, Sonnet for insights + chat |
| Database | **Supabase** (Postgres + pgvector) |
| Auth | Supabase Auth — magic link + Google OAuth |
| Storage | Supabase Storage — PDFs, images, HTML snapshots |
| Background jobs | Vercel Cron + Queues (or Inngest if richer DAG needed) |
| HTML extraction | `@mozilla/readability` + `jsdom`, Playwright fallback for client-rendered pages |
| YouTube extraction | Playwright scrape of the video page transcript (no paid 3rd-party service) |
| PDF extraction | `pdf-parse` |
| Image extraction | `sharp` thumbnails + OG/Twitter card parsing |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-sanitize` + Shiki |
| UI | shadcn/ui + Radix + Tailwind |
| Domain | browselater.com (Vercel DNS) |

### 9.2 URL normalization & redirects

Follow redirects up to 5 hops at save time. Store both the original submitted URL and the canonical URL (final hop + strip known trackers: `utm_*`, `fbclid`, `gclid`, etc.). Dedupe on canonical — re-saving the same article surfaces the existing item.

### 9.3 Embedding chunking

Fixed-token recursive split: 800 tokens per chunk, 100-token overlap, using the standard recursive-character splitter (paragraph → sentence → token). Predictable, well-supported, works across all content types. Semantic-aware chunking is a P2.

### 9.4 Async pipeline

1. User submits URL → API enqueues a job, returns immediately with placeholder item (status `pending`)
2. Worker resolves redirects, fetches canonical URL, detects content type, runs matching extractor
3. Worker chunks extracted text and generates embeddings → pgvector
4. Worker calls Claude (Haiku) for at-a-glance card + summary + takeaways + tags
5. Worker calls Claude (Sonnet) for personalized insight cards, with personalization profile in system prompt
6. Worker writes results to item record. UI subscribes via Supabase Realtime and progressively reveals the detail page as fields populate. Summary streams in first, insights last.

### 9.5 Data model (sketch)

| Table | Key fields |
|---|---|
| `items` | id, user_id, original_url, canonical_url, type, title, author, published_at, hero_image_url, status, created_at, archived_at |
| `item_content` | item_id, raw_text, html_snapshot, transcript_json, pdf_storage_key, image_storage_key |
| `item_ai` | item_id, version, at_a_glance_md, summary_md, takeaways_md, model, created_at |
| `insight_cards` | id, item_id, version, context, headline, body_md, suggested_actions_md, confidence, user_feedback |
| `tags` | id, user_id, name |
| `item_tags` | item_id, tag_id, source (ai\|user) |
| `embeddings` | id, item_id, chunk_index, chunk_text, vector |
| `chat_messages` | id, user_id, role, content, sources (item_ids[]), created_at |
| `user_profile` | user_id, version, profile_md, created_at |

---

## 10. Acceptance Criteria (selected)

### US-1 — Paste a URL to save
- **Given** the owner is on the home screen
- **When** they paste a URL and press Enter
- **Then** a placeholder card appears at the top of the list within 1.5s
- **And** within 30s the card updates with title, summary, tags, thumbnail
- **And** if the URL is a redirect, the canonical URL is resolved
- **And** if the same canonical URL was saved before, the existing item is surfaced (no duplicate)

### US-3 — Save a YouTube video
- **Given** a YouTube URL is pasted
- **When** the video page contains a transcript section
- **Then** the full transcript with timestamps is stored, the video is embedded, and the summary is generated from the transcript
- **When** the transcript is unavailable
- **Then** the item still saves with title/thumbnail/description, tagged "no transcript"

### US-8 — Personalized insights
- **Given** the personalization profile is populated
- **When** AI processing finishes
- **Then** the detail page shows 0–9 insight cards, each tagged with a context
- **And** the model only emits cards for contexts where the source genuinely applies — empty contexts are skipped, never padded
- **And** each card has headline, why-it-applies, suggested actions, confidence chip, thumbs up/down

### US-18 — Chat with library
- **Given** ≥1 ready item
- **When** the owner asks a question
- **Then** the response is streamed via Vercel AI SDK, grounded in retrieved chunks, with 1–5 source citations
- **And** if no relevant content exists, the assistant says so explicitly

---

## 11. Success Metrics

### Leading (first 30 days)
| Metric | Target |
|---|---|
| Save rate | ≥10/wk |
| Extraction success | ≥90% |
| Summary acceptance (not regenerated) | ≥85% |
| Insight usefulness (thumbs-up rate) | ≥60% |
| Twistag-relevant insights | ≥20% of items |
| Search usage | ≥5/wk |
| Chat usage | ≥2/wk |
| Time-to-save (p50) | <1.5s |

### Lagging (60–90 days)
| Metric | Target |
|---|---|
| Re-visit rate (within 30 days) | ≥25% |
| Replaced save surfaces | ≥3 of 4 |
| Citation rate on chat | ≥80% |
| Insights-to-action | ≥3/wk |
| Cost/month | <$25 |

---

## 12. Decisions Log

| Q | Decision |
|---|---|
| Q1 LLM provider | Claude only. Haiku for summary/tagging, Sonnet for insights + chat. |
| Q2 Paywalls | Skip. Save metadata only, badge as "paywalled." |
| Q3 Hosting | Vercel + Supabase. |
| Q4 Domain | browselater.com. |
| Q5 YouTube transcripts | Scrape from the video page via Playwright. No paid 3rd-party service. |
| Q6 Redirects | Resolve to canonical at save time. Store both. Dedupe on canonical. |
| Q7 Chunking | 800-token recursive split with 100-token overlap. |

---

## 13. Design Direction

### 13.1 Inspiration
- **Feedly** — calm, content-first, generous spacing, clear hierarchy.
- **usepanda.com** — card feed with strong imagery, smooth hover/scroll, friendly typography.
- **Reader by Readwise** — the reading experience itself; measure, line-height, comfortable line length.
- **Linear / Notion** — subtle micro-interactions, fast keyboard nav, no chrome.

### 13.2 Typography
- **UI font:** Inter (variable).
- **Reading font:** Source Serif 4 (or Tiempos Text) for the detail page summary. Long-form should not feel like UI.
- **Sizes:** body 17–18px, line-height 1.6–1.7, max measure 70ch on detail pages.
- **Hierarchy:** Hero titles 36–40px. No more than three weight steps.

### 13.3 Layout & spacing
- 8px spacing scale. Large vertical rhythm — 32/48/64 between sections on the detail page.
- **List view:** card layout. 1-col mobile, 2-col tablet, 3-col wide.
- **Detail view:** single column, 720px max measure. Sticky at-a-glance card on the right ≥1024px; collapses inline on mobile.
- **Context chips:** subtle pill backgrounds, one soft tint per context.

### 13.4 Motion
- **Save:** new item flies into top of list with soft scale-in; AI fields shimmer-fill as they stream.
- **Hover:** cards lift 2–4px with soft shadow; thumbnail gently scales.
- **Page transitions:** Next.js view transitions for list → detail (card morphs into detail header).
- **Streaming text:** chunk-by-chunk with cursor caret, never a spinner that snaps in 600 words.
- **Reduced-motion:** respect `prefers-reduced-motion` → opacity-only fallback.

### 13.5 Color
- Light + dark themes at v1. System preference default with manual override.
- Warm off-whites + soft grays (avoid pure black on white).
- Single accent (deep blue tentatively) for primary actions and links.
- Five soft context tints, one per context, on insight cards.

### 13.6 Markdown rendering style
- **Tables:** zebra rows, generous padding, sticky header, rounded outer corners.
- **Blockquotes:** left-accent bar, serif italic, muted color — used when AI quotes the source.
- **Headings in markdown:** reading serif at smaller scale than page H1/H2.
- **Code:** Shiki, one cohesive theme matching light/dark.

---

## 14. Timeline & Phasing

One full-stack engineer, part-time. See `tasks/phase-{0..3}.md` for the executable breakdown.

| Phase | Focus | Est. |
|---|---|---|
| 0 — Foundations | Vercel + Supabase + Next.js shell + DNS | 1 week |
| 1 — The save loop | URL save + extractors + async pipeline + list view | 2 weeks |
| 2 — AI layer | Vercel AI SDK + Claude + insights + search + chat | 2 weeks |
| 3 — Polish + launch | Detail page typography, animations, dark mode, a11y | 1.5 weeks |

**Total ≈ 6.5 weeks to v1.**
