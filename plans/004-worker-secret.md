# Plan 004: Authenticate the worker endpoint with a dedicated secret instead of the Supabase service-role key

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 32ac5e5..HEAD -- app/api/worker workers/queue.ts lib/env.ts .env.example`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `32ac5e5`, 2026-06-10

## Why this matters

The internal worker route is protected by comparing an HTTP header against `SUPABASE_SERVICE_ROLE_KEY` — the single most powerful credential in the system (full RLS bypass on all data). That key is therefore serialized into an outbound HTTP header on **every** save (`workers/queue.ts`), multiplying the places it can leak (request logs, proxies, traces). The middleware explicitly exempts `/api/worker` from session auth (`lib/supabase/middleware.ts:5` lists it in `PUBLIC_PATHS`), so this header check is the route's _only_ protection. Secrets should be least-privilege: a leaked worker secret should let an attacker trigger extract jobs at worst, not read/write the entire database. The fix is a dedicated `WORKER_SECRET` compared in constant time.

## Current state

- `app/api/worker/extract/route.ts` is the **only** worker route (verified: `find app/api/worker -type f` → one file). Its auth check (`route.ts:10-14`):

```ts
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-worker-secret");
  if (!secret || secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new NextResponse("unauthorized", { status: 401 });
  }
```

- `workers/queue.ts:18-32` — the only caller; sends the key on every enqueue:

```ts
export async function enqueueExtract(job: ExtractJob): Promise<void> {
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/api/worker/extract`;
  log.debug("queue.enqueue", { itemId: job.itemId });
  try {
    void fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-worker-secret": process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      },
      body: JSON.stringify(job),
    }).catch((err) => log.error("queue.enqueue_failed", { err: String(err) }));
```

- `lib/env.ts:3-14` — zod schema for env vars; new vars get added here. Existing entries look like `SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),`.
- `.env.example` — documents every var with a comment block; the bookmarklet secret entry shows the documentation style:

```
# Bookmarklet shared secret — long random string. Used to sign per-user tokens.
BOOKMARKLET_SIGNING_SECRET=replace-with-32-byte-random-hex
```

- Constant-time comparison convention already exists in this repo — `lib/bookmarklet.ts:26-28` uses `timingSafeEqual` from `node:crypto` with a length guard. Match it.
- There are exactly 2 code references to fix (verified by grep): `app/api/worker/extract/route.ts:12` and `workers/queue.ts:26`. `lib/supabase/service.ts` legitimately uses the key for DB access — do not touch it.

## Commands you will need

| Purpose   | Command                                                       | Expected on success          |
| --------- | ------------------------------------------------------------- | ---------------------------- |
| Typecheck | `npm run typecheck`                                           | exit 0                       |
| Tests     | `npm test`                                                    | all pass                     |
| Lint      | `npm run lint`                                                | no errors                    |
| Residue   | `grep -rn "x-worker-secret" --include="*.ts" app workers lib` | both sites use WORKER_SECRET |

## Scope

**In scope** (the only files you should modify):

- `app/api/worker/extract/route.ts`
- `workers/queue.ts`
- `lib/env.ts`
- `.env.example`

**Out of scope** (do NOT touch, even though they look related):

- `lib/supabase/service.ts` — its use of `SUPABASE_SERVICE_ROLE_KEY` for database access is the key's intended purpose.
- `.env` (the operator's local file) — never edit or read it; the operator adds the new var themselves.
- Vercel project settings — operator action (see Maintenance notes).
- The bookmarklet token scheme — separate plan (005).

## Git workflow

- Branch: `advisor/004-worker-secret`
- Commits: conventional commits (e.g. `fix(security): dedicated WORKER_SECRET for worker route auth`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Register the env var

In `lib/env.ts`, add to the schema (alphabetical placement is not required; put it near `BOOKMARKLET_SIGNING_SECRET`):

```ts
WORKER_SECRET: z.string().min(32).optional(),
```

In `.env.example`, under the `# --- App ---` section, add:

```
# Worker route shared secret — authenticates internal job dispatch (app → /api/worker/*).
# Generate with: openssl rand -hex 32
WORKER_SECRET=replace-with-64-char-random-hex
```

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Switch the route to WORKER_SECRET with constant-time compare

In `app/api/worker/extract/route.ts`, replace the check at lines 11-14 with a fail-closed, constant-time comparison (import `timingSafeEqual` from `node:crypto`, mirroring `lib/bookmarklet.ts:26-28`):

```ts
const secret = request.headers.get("x-worker-secret");
const expected = process.env.WORKER_SECRET;
if (!secret || !expected || !safeEqual(secret, expected)) {
  return new NextResponse("unauthorized", { status: 401 });
}
```

with a small local helper:

```ts
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
```

Fail-closed property to preserve: if `WORKER_SECRET` is unset in the environment, **every** request gets 401 (the `!expected` arm). Do not fall back to the service-role key.

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Switch the dispatcher

In `workers/queue.ts:26`, change the header to:

```ts
"x-worker-secret": process.env.WORKER_SECRET ?? "",
```

**Verify**: `grep -rn "SUPABASE_SERVICE_ROLE_KEY" --include="*.ts" app workers` → zero matches (the only remaining references are in `lib/env.ts` and `lib/supabase/service.ts`).

### Step 4: Local smoke test

Add `WORKER_SECRET` to your local env (generate with `openssl rand -hex 32`), start `npm run dev`, then:

**Verify**:

1. `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/worker/extract -H 'content-type: application/json' -d '{}'` → `401` (no header).
2. `curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/worker/extract -H 'content-type: application/json' -H "x-worker-secret: $WORKER_SECRET" -d '{"itemId":"00000000-0000-0000-0000-000000000001","userId":"00000000-0000-0000-0000-000000000001"}'` → `400` or `500` (auth passed; body validation/DB is what fails) — NOT `401`.

Stop the dev server afterwards.

## Test plan

The route handler is thin glue (header check + zod + dispatch); the smoke test in step 4 covers it. If you prefer a unit test, add `safeEqual` cases to a new `app/api/worker/extract/route.test.ts` modeled on `lib/bookmarklet.test.ts` — optional, not required for done.

Full-suite verification: `npm test` → all existing tests still pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -rn "SUPABASE_SERVICE_ROLE_KEY" --include="*.ts" app workers` → no matches
- [ ] `grep -n "WORKER_SECRET" lib/env.ts .env.example app/api/worker/extract/route.ts workers/queue.ts` → present in all four
- [ ] Unauthenticated POST to the route returns 401; correctly-authenticated POST does not (step 4)
- [ ] `npm run lint`, `npm run typecheck`, `npm test` all exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- More worker routes exist than `app/api/worker/extract/route.ts` (drift — the plan's grep inventory is stale; the new routes need the same treatment, re-scope first).
- Any code path appears to _depend_ on the worker secret equaling the service-role key (none found at planning time).
- You are tempted to set the Vercel env var via CLI — that's the operator's call.

## Maintenance notes

- **Operator follow-ups (required before deploy)**: (1) generate a `WORKER_SECRET` (`openssl rand -hex 32`) and set it in Vercel env + local `.env`; (2) since the service-role key was previously sent as an HTTP header on every save, **rotate the Supabase service-role key** in the Supabase dashboard as hygiene, then update the env var everywhere.
- Deploy note: app and worker share one deployment, so there is no cross-version window — but the first deploy _without_ `WORKER_SECRET` set will 401 every extract job (fail-closed). Set the env var first.
- If Vercel Queues gets wired in later (the TODO in `workers/queue.ts`'s doc comment), carry the dedicated-secret pattern over rather than reverting to platform defaults silently.
