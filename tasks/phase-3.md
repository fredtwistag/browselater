# Phase 3 — Polish & Launch

**Goal:** the app feels like Feedly / usepanda.com / Readwise Reader — generous spacing, beautiful typography, smooth motion, light + dark. Accessibility audit clean. Empty/error states handled. Logged events flowing into the `events` table.

**Estimate:** 1.5 weeks.

**Done when:** Lighthouse a11y + best-practices ≥95 on feed and detail. Keyboard nav covers save/search/open/archive. Dark mode usable. Manual review against PRD §13 passes.

---

## Tasks

### 3.1 Typography pass (PRD §13.2)
- [ ] Install Inter (variable) and Source Serif 4 via `next/font/google` with `display: 'swap'`.
- [ ] Tailwind theme: `font-sans` = Inter, `font-serif` = Source Serif 4.
- [ ] Detail-page body uses serif. UI (nav, buttons, lists) uses sans.
- [ ] Body 17–18px, line-height 1.6–1.7, measure capped at 70ch on detail.
- [ ] Heading scale: 36/28/22/18/16 with weights 700/600/600/500/500.

### 3.2 Detail page layout (PRD §6.1, §13.3)
- [ ] Single column, max 720px measure on mobile/tablet.
- [ ] Wide screens ≥1024px: sticky at-a-glance card on the right rail.
- [ ] Insight cards grouped under their context with subtle tinted backgrounds (one tint per context — five total).
- [ ] AI markdown rendered via `react-markdown` + `remark-gfm`:
  - Tables: zebra rows, sticky header on long tables, rounded outer corners, overflow-x on mobile
  - Blockquotes: left-accent bar, serif italic, muted
  - Code: Shiki theme matching light/dark mode

### 3.3 List view polish (PRD §13.3)
- [ ] Card layout: 1-col mobile, 2-col tablet, 3-col wide.
- [ ] Hero thumbnail with subtle gradient overlay where titles overlay images.
- [ ] Hover: card lifts 2–4px, thumbnail scales 1.02.
- [ ] Context chips with per-context tint.

### 3.4 Motion (PRD §13.4)
- [ ] New item: scale-in + fade at top of list.
- [ ] AI-streaming fields: shimmer placeholder → progressive reveal with caret while streaming.
- [ ] List → detail: Next.js `unstable_ViewTransition` so the card morphs into the detail header.
- [ ] Respect `prefers-reduced-motion` → fall back to opacity transitions only.

### 3.5 Dark mode (PRD §13.5)
- [ ] `next-themes` system default with manual toggle in avatar menu.
- [ ] Warm off-white in light mode (`#FAFAF7`-ish), soft near-black in dark (`#16161A`-ish). No pure black or pure white.
- [ ] Verify shadcn primitives, Shiki theme, blockquote color, and context tints all switch correctly.

### 3.6 Empty & error states
- [ ] Feed empty (no saves): big input + tutorial copy + bookmarklet drag-to-bookmark-bar widget.
- [ ] Feed filtered empty: friendly "nothing matches this filter."
- [ ] Item extraction failed: card shows reason (paywall, 404, bot-blocked) + Retry button.
- [ ] Search empty: suggests a few example queries.
- [ ] Chat empty: starter prompts based on the user's tags.

### 3.7 Accessibility audit
- [ ] All interactive elements keyboard-reachable.
- [ ] Keyboard shortcuts: `/` focus search, `n` focus save input, `j/k` navigate feed cards, `o` open focused card, `e` archive, `?` shortcuts modal.
- [ ] All images have alt text (extracted from source where possible, fallback to title).
- [ ] Color contrast ≥4.5:1 for text, ≥3:1 for UI controls.
- [ ] Markdown renderer outputs proper semantic HTML (`<h2>`, `<ul>`, `<table>`, not `<div>` soup).
- [ ] Run `axe` in Playwright tests on feed + detail + chat.

### 3.8 Event logging
- [ ] `logEvent(name, payload)` helper writes to the `events` table.
- [ ] Events to log: `save_started`, `save_completed`, `save_failed`, `summary_ready`, `insights_ready`, `insight_thumbs_up`, `insight_thumbs_down`, `re_run_ai`, `search_query`, `chat_message`, `item_opened`, `item_archived`.
- [ ] No PII in payloads beyond user_id (the owner is the only user anyway).

### 3.9 Launch checklist
- [ ] Robots: `noindex` everywhere (private app).
- [ ] Sentry-free error reporting: log unhandled rejections + API errors to Postgres `errors` table; dashboard page lists recent errors.
- [ ] DB backup: enable Supabase daily backups.
- [ ] Settings → Privacy page lists everything sent to 3rd parties (Anthropic, YouTube).
- [ ] Manual smoke against PRD §10 acceptance criteria — all green.

---

## Acceptance test (manual)

Open the app on desktop and mobile.
1. Feel — does it feel like Feedly / Readwise Reader? (Generous spacing? Typography that's pleasant to read? Smooth motion?)
2. Save 3 items of different types — does the feed reveal them gracefully?
3. Open the most recent — does the detail page feel like a briefing memo, not a database record?
4. Switch theme — does everything switch cleanly?
5. Keyboard-only navigate through save → open → archive — no traps, no hidden focus.

---

## Out of scope
- Browser extension — v1.1
- PWA install + share-target — v1.1
- OCR — v1.1
- Native apps — v2
