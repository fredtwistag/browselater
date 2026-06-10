# Plan 003: Make AI-pipeline DB writes fail loudly and fix the saveTags race

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 32ac5e5..HEAD -- workers/jobs/ai.ts`
> If the file changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (002 recommended first so CI gates this change)
- **Category**: bug
- **Planned at**: commit `32ac5e5`, 2026-06-10

## Why this matters

`workers/jobs/ai.ts` persists everything the AI pipeline produces — summary row (`item_ai`), insight cards, embeddings, tags — and **none of those writes check for errors**. A failed insert (schema drift, constraint violation, network blip) is silently swallowed: the item looks "ready" in the UI while semantic search, tags, or insights are quietly missing, and nothing appears in the `errors` table. Additionally, `saveTags` uses a SELECT-then-INSERT pattern per tag; the `tags` table has `unique (user_id, name)` (see migration excerpt below), so two concurrent pipeline runs producing the same new tag race — the loser's insert fails, the error object is never read, `tagId` is `undefined`, and the tag association is silently dropped. This plan makes every write checked (reported via the repo's existing `captureError` helper) and replaces the tag loop with a single batched, conflict-safe upsert.

## Current state

- `workers/jobs/ai.ts` — the whole AI pipeline (summary → tags → insights → embeddings). All excerpts below are from commit `32ac5e5`.

Unchecked `item_ai` insert (`ai.ts:77-86`):

```ts
await supabase.from("item_ai").insert({
  item_id: itemId,
  version: nextVersion,
  at_a_glance_md: summary.at_a_glance_md,
  summary_md: summary.summary_md,
  takeaways_md: summary.takeaways_md,
  primary_context: summary.primary_context,
  source_quality: summary.source_quality,
  model: HAIKU_MODEL,
});
```

Unchecked `insight_cards` insert (`ai.ts:119-130`):

```ts
if (insights && insights.cards.length > 0) {
  const rows = insights.cards.map((c) => ({ ... }));
  await supabase.from("insight_cards").insert(rows);
}
```

Unchecked embeddings upsert (`ai.ts:159-169`, inside `runEmbeddings`):

```ts
const rows = batch.map((c, j) => ({
  item_id: itemId,
  user_id: userId,
  chunk_index: c.index,
  chunk_text: c.text,
  tokens: c.tokens,
  embedding: vectors[j].vector as unknown as string, // pgvector accepts number[] serialized
}));
// supabase-js sends as JSON; pgvector input accepts the array literal "[..]" or a JSON array.
await supabase.from("embeddings").upsert(rows as never);
```

Racy, silent `saveTags` (`ai.ts:291-316`):

```ts
async function saveTags(itemId: string, userId: string, tags: string[]): Promise<void> {
  if (!tags.length) return;
  const supabase = createServiceClient();
  for (const name of tags) {
    const clean = name.trim().toLowerCase().slice(0, 60);
    if (!clean) continue;
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", userId)
      .eq("name", clean)
      .maybeSingle();
    let tagId = existing?.id;
    if (!tagId) {
      const { data: created } = await supabase
        .from("tags")
        .insert({ user_id: userId, name: clean })
        .select("id")
        .single();
      tagId = created?.id;
    }
    if (tagId) {
      await supabase.from("item_tags").upsert({ item_id: itemId, tag_id: tagId, source: "ai" });
    }
  }
}
```

- Schema facts (from `supabase/migrations/20260528000006_tags.sql` and `..0007_embeddings.sql`):
  - `tags` has `unique (user_id, name)`.
  - `item_tags` has `primary key (item_id, tag_id)`.
  - `embeddings` has `unique (item_id, chunk_index)`.
- Error-reporting convention — `lib/errors.ts` exports `captureError(source, err, context?, userId?)`, which logs and inserts into the `errors` table. The pipeline already uses it for model-call failures (`ai.ts:65-68`):

```ts
}).catch(async (err) => {
  await captureError("ai.summary", err, { itemId }, userId);
  return null;
});
```

Match this convention for the new write checks. Never put raw user content in `context`.

- One adjacent wart you will fix in passing: `ai.ts:71` has `await logEvent("ai.summary.failed" as never, userId, { itemId });` — the `as never` exists because the event-name union in `lib/events.ts` lacks this name. Add `"ai.summary.failed"` to that union and drop the cast.

## Commands you will need

| Purpose   | Command                                  | Expected on success          |
| --------- | ---------------------------------------- | ---------------------------- |
| Typecheck | `npm run typecheck`                      | exit 0                       |
| Tests     | `npm test`                               | all pass (30 existing + new) |
| One file  | `npx vitest run workers/jobs/ai.test.ts` | new tests pass               |
| Lint      | `npm run lint`                           | no errors                    |

## Scope

**In scope** (the only files you should modify):

- `workers/jobs/ai.ts`
- `workers/jobs/ai.test.ts` (create)
- `lib/events.ts` (only: add `"ai.summary.failed"` to the event-name union)

**Out of scope** (do NOT touch, even though they look related):

- `workers/jobs/extract.ts` — same hardening is desirable there, but keep this change reviewable; flag it as follow-up.
- `lib/ai/embeddings.ts` — Voyage HTTP error handling is already explicit (returns null + logs).
- Any DB migration — the constraints needed (`unique (user_id, name)`, PK on `item_tags`) already exist.
- The prompts in `lib/ai/prompts/` and model-call logic (`generateSummary` / `generateInsights`) — unchanged.

## Git workflow

- Branch: `advisor/003-ai-pipeline-persistence`
- Commits: conventional commits (e.g. `fix(ai): check pipeline DB writes and batch tag upsert`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Check the `item_ai` insert

Replace the bare insert (`ai.ts:77-86`) with one that destructures `{ error }`. On error: `await captureError("ai.save_summary", error, { itemId, version: nextVersion }, userId);` and `return;` — if the summary row didn't persist, continuing to insights would produce cards pointing at a version that doesn't exist.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Check the `insight_cards` insert

Same pattern at `ai.ts:129`: destructure `{ error }`; on error `await captureError("ai.save_insights", error, { itemId, version: nextVersion, cardCount: rows.length }, userId);` — do NOT return (the summary already saved; losing cards shouldn't erase the logEvent that follows, but change the `cardCount` reported in the `ai.insights.completed` event to `0` when the insert failed).

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Check the embeddings upsert

At `ai.ts:168`: destructure `{ error }`; on error `await captureError("ai.save_embeddings", error, { itemId, batchStart: i }, userId);` and `return;` (later batches will likely fail the same way; bail out of `runEmbeddings`, not the whole pipeline — note `runEmbeddings` is called before the summary, so just `return` from `runEmbeddings`). Keep the existing `as never` cast on the rows object (it works around supabase-js typing of the vector column) — your change is only the error check.

**Verify**: `npm run typecheck` → exit 0.

### Step 4: Rewrite `saveTags` as a batched conflict-safe upsert

Replace the body of `saveTags` (`ai.ts:291-316`) with:

1. Normalize: `const clean = [...new Set(tags.map((n) => n.trim().toLowerCase().slice(0, 60)).filter(Boolean))];` — return early if empty.
2. One upsert that absorbs the unique constraint instead of racing it:

```ts
const { data: tagRows, error: tagErr } = await supabase
  .from("tags")
  .upsert(
    clean.map((name) => ({ user_id: userId, name })),
    { onConflict: "user_id,name", ignoreDuplicates: false },
  )
  .select("id, name");
if (tagErr || !tagRows) {
  await captureError("ai.save_tags", tagErr ?? new Error("no rows"), { itemId }, userId);
  return;
}
```

3. One `item_tags` upsert for all rows: `.upsert(tagRows.map((t) => ({ item_id: itemId, tag_id: t.id, source: "ai" as const })))` — destructure and `captureError("ai.save_item_tags", ...)` on error.

Keep the function signature unchanged (`saveTags(itemId, userId, tags)` returning `Promise<void>`); the caller at `ai.ts:89` stays as is.

**Verify**: `npm run typecheck` → exit 0; `grep -n "maybeSingle" workers/jobs/ai.ts` → only the one inside `nextAiVersion` remains.

### Step 5: Fix the event-name cast

In `lib/events.ts`, find the union/list of event names (it contains entries like `"ai.summary.started"`, `"ai.summary.completed"`) and add `"ai.summary.failed"`. Then in `ai.ts:71` remove ` as never`.

**Verify**: `npm run typecheck` → exit 0; `grep -n "as never" workers/jobs/ai.ts` → only the embeddings-rows cast at the upsert remains (1 match).

### Step 6: Write the tests

Create `workers/jobs/ai.test.ts`. Mock the service client; do not hit a real DB. Structural pattern for env-dependent tests: `lib/bookmarklet.test.ts` (uses `beforeAll` + dynamic import). For the Supabase mock, use `vi.mock`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const upsertMock = vi.fn();
const fromMock = vi.fn();
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({ from: fromMock }),
}));
vi.mock("@/lib/errors", () => ({ captureError: vi.fn() }));
```

Have `fromMock` return chainable objects per table (`upsert().select()` resolving to `{ data, error }`). Import `saveTags` — you will need to `export` it from `ai.ts` (add `export` to the function declaration; that is in scope).

**Verify**: `npx vitest run workers/jobs/ai.test.ts` → all new tests pass.

## Test plan

In `workers/jobs/ai.test.ts`, minimum cases:

1. `saveTags` happy path — two tags → exactly one `tags` upsert with both rows (deduped, normalized to lowercase/trimmed/≤60 chars) and one `item_tags` upsert with both ids.
2. `saveTags` empty/whitespace tags → no DB calls.
3. `saveTags` tags upsert returns `{ error }` → `captureError` called with source `"ai.save_tags"`, no `item_tags` call.
4. `saveTags` duplicate names differing only by case/whitespace (`"AI"`, `ai`) → single row sent.
5. (Regression for the race) the upsert call uses `onConflict: "user_id,name"` — assert on the mock's call arguments.

Full-suite verification: `npm test` → 30 existing + ≥5 new tests pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npm test` exits 0; `workers/jobs/ai.test.ts` exists with ≥5 passing tests
- [ ] `npm run lint` exits 0
- [ ] Every `.insert(` / `.upsert(` in `workers/jobs/ai.ts` destructures and handles `error` (manual grep: `grep -n "await supabase.from" workers/jobs/ai.ts` and inspect each)
- [ ] `grep -n '"ai.summary.failed" as never' workers/jobs/ai.ts` returns no matches
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the cited lines doesn't match the excerpts (drift).
- supabase-js `upsert(..., { onConflict })` typings reject `"user_id,name"` for the `tags` table — report the exact type error rather than adding `as never` casts beyond the one pre-existing embeddings cast.
- You find yourself wanting to change the DB schema or `workers/jobs/extract.ts` — both out of scope.
- Mocking `createServiceClient` proves impossible without restructuring `ai.ts` beyond exporting `saveTags`.

## Maintenance notes

- Follow-up (deliberately deferred): apply the same checked-write pattern to `workers/jobs/extract.ts`, and consider a `failed_at`/error surface on items so the UI can show "AI step failed — retry" instead of a silent gap.
- Reviewer should scrutinize: that step 1's early-return on `item_ai` failure doesn't skip the `ai.summary.completed` event in the success path, and that `saveTags` still tolerates Claude returning zero tags.
- If a future change adds tag _renaming_, the `ignoreDuplicates: false` merge semantics on the upsert are what keeps ids stable — don't flip it to `true` (it would return no rows for existing tags).
