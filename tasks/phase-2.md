# Phase 2 — AI Layer

**Goal:** every saved item produces an AI-generated summary, key takeaways, tags, and personalized insight cards. Search and chat work across the library.

**Estimate:** 2 weeks.

**Done when:** Saving an article produces a populated detail page (summary + takeaways + at-a-glance + 0–9 insight cards) within ~60s, search returns relevant results for fuzzy queries, and chat answers cite source items.

---

## Tasks

### 2.1 Vercel AI SDK + Claude wiring
- [ ] Install `ai` + `@ai-sdk/anthropic`. Add `ANTHROPIC_API_KEY` to Vercel envs.
- [ ] `lib/ai/client.ts` — typed helpers: `streamText`, `generateObject` with Zod schemas, model selectors (`haikuModel`, `sonnetModel`).
- [ ] Centralized prompt files under `lib/ai/prompts/`. One file per prompt. Each exports a `buildPrompt(input)` function and the Zod schema for the output.

### 2.2 Summarization + takeaways + at-a-glance (Haiku)
- [ ] `lib/ai/prompts/summary.ts` — input: extracted text + metadata. Output: markdown summary (400–800 words), 5–8 takeaways, at-a-glance (2-sentence TL;DR + 3 tags + primary context).
- [ ] Worker step after extraction: call summary prompt, write `item_ai` row with `version=1`.
- [ ] Stream the summary back to the UI via Server-Sent Events so the detail page reveals it progressively.

### 2.3 Auto-tagging
- [ ] Reuse the summary prompt output (it already returns 3 tags). Persist into `tags` + `item_tags` with `source='ai'`.
- [ ] Settings → Tags: allow user to rename or merge tags.

### 2.4 Personalization profile editor
- [ ] `(app)/settings/profile/page.tsx` — markdown editor (start with `react-textarea-autosize` + live preview via `react-markdown`).
- [ ] Sections (templated): About me · Family · Wealth · Health · Twistag (with sub-headings Ops, Sales, DevEx, Innovation, Marketing).
- [ ] Save creates a new `user_profile` row with incremented `version`. Old versions retained.
- [ ] First-run wizard if profile is empty.

### 2.5 Personalized insight cards (Sonnet)
- [ ] `lib/ai/prompts/insights.ts` — system prompt includes the latest `user_profile.profile_md`. User prompt: extracted source content + summary.
- [ ] Output (Zod): array of cards with `{ context, headline, body_md, suggested_actions_md, confidence }`. **The model is instructed to skip irrelevant contexts.** Empty array is valid.
- [ ] Worker step after summary: call insights prompt, persist each card into `insight_cards`.
- [ ] Detail page renders insight cards under their context, with the soft tint per context (§13.5).
- [ ] Each card has thumbs up/down → updates `insight_cards.user_feedback`.

### 2.6 Re-run AI
- [ ] Detail-page action "Re-run AI" → re-runs summary + insights with the current `user_profile` version, writes a new `item_ai` and new `insight_cards` rows with incremented `version`.
- [ ] UI shows current version + a small "see previous versions" expander.

### 2.7 Embeddings
- [ ] On extraction completion, chunk `raw_text` (or transcript text) into 800-token chunks with 100-token overlap using a recursive-character splitter.
- [ ] Embed each chunk via the chosen embedding model (start with Voyage or OpenAI `text-embedding-3-small`). Persist to `embeddings`.
- [ ] Tune IVFFlat `lists` per pgvector docs once we have ~500 rows.

### 2.8 Search
- [ ] Postgres full-text index on `items.title || items.author || item_ai.summary_md || item_ai.takeaways_md || item_content.raw_text || tags`. Use `tsvector` + GIN.
- [ ] `lib/search/fulltext.ts` and `lib/search/semantic.ts`. Combined search ranks results by a hybrid score (configurable).
- [ ] Search UI: top-bar input with `/` keyboard shortcut, results page with same card layout as feed + result snippets with query terms highlighted.
- [ ] Filter by context: surface "show me all `Twistag · Sales`" entry point on the insights panel.

### 2.9 Chat with library
- [ ] `(app)/chat/page.tsx` — chat UI built on the Vercel AI SDK `useChat` hook.
- [ ] `app/api/chat/route.ts` — streaming endpoint. On each user message:
  - Embed the query
  - Retrieve top-K (start with K=8) chunks via pgvector
  - Build a system prompt that injects the retrieved chunks and instructs Claude to cite item_ids by inline marker `[[item:UUID]]`
  - Stream Claude (Sonnet) response back
- [ ] Render citation markers as clickable chips → open the source item's detail page.
- [ ] If retrieval returns nothing relevant (low similarity), instruct the model to say so explicitly rather than hallucinate.
- [ ] Persist conversation in `chat_messages`.

---

## Acceptance test (e2e)

`tests/e2e/phase-2.spec.ts`:
1. Save an article → within 60s the detail page shows at-a-glance, 400+ word summary, 5+ takeaways, and ≥1 insight card.
2. Save a Twistag-relevant article (e.g. about DevEx tooling) → at least one insight card has context `Twistag · DevEx`.
3. Edit personalization profile, click Re-run AI on an existing item → new insight card versions appear; old versions accessible.
4. Search for a phrase that exists in a saved article's body → that item ranks in the top 3.
5. Open Chat, ask a question that's answerable from a saved item → response streams in with at least one citation chip; clicking the chip opens the source item.

---

## Out of scope
- Detail-page typography pass + streaming animations — phase 3
- Browser extension (F-24) — v1.1
