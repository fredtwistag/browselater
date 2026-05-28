# Phase 1 — The Save Loop

**Goal:** I can paste a URL (article, YouTube, PDF, image) and within seconds see it appear in the feed with title, thumbnail, and extracted content. No AI yet — that's phase 2.

**Estimate:** 2 weeks.

**Done when:** All four content types extract successfully on a representative test set (≥18/20 URLs across types), redirects resolve correctly, and the feed shows fresh saves progressively via Supabase Realtime.

---

## Tasks

### 1.1 Save endpoint + placeholder item

- [x] `POST /api/save` — accepts `{ url }`, returns `{ item_id, status: "pending" }`.
- [x] Creates an `items` row with `status='pending'`, original_url, canonical_url (resolved synchronously, see 1.2).
- [x] Enqueues an extraction job (Vercel Queue) with the item_id.
- [x] Server Action `saveUrl(url)` wrapping the endpoint, used by the home-screen input.
- [x] Home screen: single big input "Paste a URL…" with Enter-to-submit, optimistic add to top of feed.

### 1.2 URL normalization

- [x] `lib/extract/canonicalize.ts` — follow redirects up to 5 hops (`fetch` with `redirect: "manual"` loop, or `node-fetch`).
- [x] Strip known trackers: `utm_*`, `fbclid`, `gclid`, `mc_eid`, `igshid`, `ref`, `ref_src`.
- [x] Lowercase scheme + host, remove trailing slash on root, sort query params alphabetically.
- [x] Dedupe: on save, if a row with the same `(user_id, canonical_url)` exists, return it instead of creating a duplicate. Surface "Already saved on {date}" in the UI.
- [x] Unit tests: 20 representative URLs (t.co, lnkd.in, news sites with tracking, YouTube short and long forms).

### 1.3 Content-type detection

- [x] `lib/extract/detect.ts` — given a canonical URL + HEAD response Content-Type, classify as `article | youtube | pdf | image | generic`.
- [x] YouTube: `youtube.com/watch`, `youtu.be/*`, `youtube.com/shorts/*`.
- [x] PDF: Content-Type `application/pdf` OR `.pdf` extension.
- [x] Image: Content-Type `image/*` OR common image extensions.
- [x] Article: HTML pages that aren't the above (default).

### 1.4 Article extractor

- [x] `lib/extract/article.ts` — fetch HTML, run `@mozilla/readability` + `jsdom`.
- [x] Capture: title, byline, hero image (largest OG image or article hero), publish date, raw_text, html_snapshot.
- [x] Fallback: if Readability returns empty content OR the page looks JS-rendered (small initial body, large script payload), render with Playwright and re-run.
- [x] Persist snapshot HTML to Supabase Storage; URL stored on `item_content.html_snapshot`.

### 1.5 YouTube extractor

- [x] `lib/extract/youtube.ts` — use Playwright to load the video page, accept consent, expand the description, click "Show transcript", and scrape the transcript text + timestamps.
- [x] Persist: video title, channel, publish date, thumbnail, duration, full transcript JSON (`[{ start, text }, ...]`).
- [x] If transcript section is absent (no captions), save the item with title/thumbnail/description and add an internal flag `no_transcript = true`. UI shows a "no transcript" chip.
- [x] Test against 5 videos covering: auto-captions, manual captions, no captions, age-restricted, short.

### 1.6 PDF extractor

- [x] `lib/extract/pdf.ts` — download PDF, run `pdf-parse`, extract text + page count.
- [x] Persist the original PDF to Supabase Storage; key stored on `item_content.pdf_storage_key`.
- [x] Title fallback chain: PDF metadata title → first H1-ish line → filename.

### 1.7 Image extractor

- [x] `lib/extract/image.ts` — fetch image, generate 800px-wide JPEG thumbnail via `sharp`.
- [x] Parse OG/Twitter card metadata from the referring page if URL is an `<img>` on a page (best effort).
- [x] Persist original + thumbnail to Supabase Storage.

### 1.8 Worker pipeline

- [x] `workers/jobs/extract.ts` — receives item_id, routes to the matching extractor based on `items.type`, writes results to `item_content`, sets `items.status` to `ready` or `failed`.
- [x] On failure, set `status='failed'` and `error` field; update UI to show failure card with Retry button.
- [x] Retry 3× with exponential backoff before marking failed.

### 1.9 Feed (list view)

- [x] `(app)/feed/page.tsx` — reverse-chronological list of `items` for the signed-in user.
- [x] Card per item: thumbnail, title, source domain, content-type icon, saved-at relative time, status chip (pending shimmer / ready / failed).
- [x] Subscribe to `items` row changes via Supabase Realtime so pending items reveal their content live as the worker finishes.
- [x] Empty state preserved from phase 0; appears only when there are no items.
- [x] Filter chips (top of feed): All · Articles · YouTube · PDFs · Images · Failed.

### 1.10 Item detail page (skeleton)

- [x] `(app)/item/[id]/page.tsx` — shows the extracted content with no AI fields yet.
- [x] Header (title, source URL, author, date, hero image, content type icon).
- [x] Original media: YouTube embed / PDF inline viewer / image lightbox / article hero.
- [x] "Full extracted content" collapsible block (collapsed by default).
- [x] Actions: Archive, Delete, Open source.

---

## Acceptance test (e2e)

`tests/e2e/phase-1.spec.ts`:

1. Sign in. Paste an article URL → placeholder card appears within 2s → updates to "ready" with title and thumbnail within 30s.
2. Paste a YouTube URL → "ready" with transcript stored (verifiable via DB).
3. Paste a PDF URL → "ready" with extracted text non-empty.
4. Paste a redirect URL (`t.co/...` to a known article) → item's `canonical_url` matches the article's real URL.
5. Paste the same article URL twice → second save surfaces the existing item.
6. Click an item → detail page renders extracted content + original media.

---

## Out of scope

- AI summary, takeaways, insights, chat — phase 2
- Detail-page typography pass and animations — phase 3
