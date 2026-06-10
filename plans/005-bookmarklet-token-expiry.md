# Plan 005: Give bookmarklet tokens an expiry and tighten endpoint input validation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 32ac5e5..HEAD -- lib/bookmarklet.ts lib/bookmarklet.test.ts app/api/bookmarklet/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (one operator-visible effect: the installed bookmarklet must be re-created after ~180 days)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `32ac5e5`, 2026-06-10

## Why this matters

The bookmarklet authenticates with a signed token embedded in a `javascript:` snippet, sent as a **URL query parameter** (`?t=...`) on every save. Query strings end up in places cookies don't: server/CDN access logs, browser history on any machine the bookmarklet is used on, and anything that captures the snippet (screenshots, synced bookmarks). The token payload already contains a timestamp (`userId.Date.now()`), but `verifyBookmarkletToken` **never checks it** — a leaked token works forever, and there is no revocation short of rotating the global signing secret. Separately, the endpoint's zod schema accepts any 10-char string as a token while real tokens are ~48+ chars. The fix: enforce a max token age (180 days), tighten the schema to the actual token shape, and let the existing Settings → Bookmarklet panel (which regenerates the snippet on demand) handle renewal.

## Current state

- `lib/bookmarklet.ts` (entire file is 36 lines; signing at 9-13, verification at 15-31):

```ts
export function signBookmarkletToken(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const mac = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}

export async function verifyBookmarkletToken(token: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [b64, mac] = parts;
  let payload: string;
  try {
    payload = Buffer.from(b64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [userId] = payload.split(".");
  return userId || null;
}
```

Note: the timestamp is _in_ the payload (`userId.timestamp`) and covered by the HMAC, but only `userId` is ever read back.

- `app/api/bookmarklet/route.ts:17-20` — the schema to tighten:

```ts
const querySchema = z.object({
  u: z.string().min(4).max(2048),
  t: z.string().min(10),
});
```

The 401 branch (`route.ts:30-31`): `verifyBookmarkletToken` returning null → `new NextResponse("invalid token", { status: 401 })`. An expired token will flow through this same branch — no route change needed for expiry.

- `lib/bookmarklet.test.ts` — existing test file to extend (full current content):

```ts
import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.BOOKMARKLET_SIGNING_SECRET = "test-secret-test-secret-test-secret";
});

describe("bookmarklet token", () => {
  it("round-trips for the same user", async () => {
    const { signBookmarkletToken, verifyBookmarkletToken } = await import("./bookmarklet");
    const userId = "00000000-0000-0000-0000-000000000001";
    const token = signBookmarkletToken(userId);
    const verified = await verifyBookmarkletToken(token);
    expect(verified).toBe(userId);
  });

  it("rejects tampered token", async () => {
    const { signBookmarkletToken, verifyBookmarkletToken } = await import("./bookmarklet");
    const token = signBookmarkletToken("u");
    const tampered = token.slice(0, -2) + "00";
    expect(await verifyBookmarkletToken(tampered)).toBeNull();
  });
});
```

- Token shape: `base64url(<uuid>.<ms-timestamp>).<32-hex>` — base64url part is ~50 chars for a UUID payload; total ≥ 60 chars in practice. A regex for the overall shape: `/^[A-Za-z0-9_-]+\.[0-9a-f]{32}$/`.
- The token is regenerated in Settings → Profile → Bookmarklet (`app/(app)/settings/profile/bookmarklet-panel.tsx`) — renewal UX already exists; you do not need to touch it.

## Commands you will need

| Purpose   | Command                                  | Expected on success         |
| --------- | ---------------------------------------- | --------------------------- |
| One file  | `npx vitest run lib/bookmarklet.test.ts` | all pass (2 existing + new) |
| Tests     | `npm test`                               | all pass                    |
| Typecheck | `npm run typecheck`                      | exit 0                      |
| Lint      | `npm run lint`                           | no errors                   |

## Scope

**In scope** (the only files you should modify):

- `lib/bookmarklet.ts`
- `lib/bookmarklet.test.ts`
- `app/api/bookmarklet/route.ts` (the `querySchema` only)

**Out of scope** (do NOT touch, even though they look related):

- `app/(app)/settings/profile/bookmarklet-panel.tsx` and `draggable-bookmarklet.tsx` — regeneration UI already works.
- Moving the token from query string to a header/POST body — would break the `javascript:` bookmarklet mechanism (popup GET); accepted trade-off, mitigated by expiry.
- A DB-backed token table with per-token revocation — heavier design; revisit only if multi-device issues appear.
- `lib/env.ts` — no new env vars needed (max age is a code constant).

## Git workflow

- Branch: `advisor/005-bookmarklet-token-expiry`
- Commits: conventional commits (e.g. `fix(security): expire bookmarklet tokens after 180 days`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Enforce max token age in `verifyBookmarkletToken`

In `lib/bookmarklet.ts`:

1. Add a module-level constant with a short comment:

```ts
// Tokens ride in bookmarklet URLs (logs, history); cap their useful life.
export const TOKEN_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
```

2. After the existing HMAC check passes, parse and validate the timestamp. Replace the final two lines (`const [userId] = payload.split("."); return userId || null;`) with:

```ts
const [userId, issuedAtRaw] = payload.split(".");
const issuedAt = Number(issuedAtRaw);
if (!userId || !Number.isFinite(issuedAt)) return null;
if (Date.now() - issuedAt > TOKEN_MAX_AGE_MS) return null;
return userId;
```

Ordering matters: the HMAC check stays first (don't give unauthenticated input a different code path), and a missing/garbled timestamp now **fails closed** (previously `userId.` with no timestamp would verify if signed).

**Verify**: `npx vitest run lib/bookmarklet.test.ts` → the 2 existing tests still pass (they sign fresh tokens, so expiry doesn't affect them).

### Step 2: Tighten the endpoint schema

In `app/api/bookmarklet/route.ts:19`, change `t: z.string().min(10),` to:

```ts
t: z.string().min(40).max(256).regex(/^[A-Za-z0-9_-]+\.[0-9a-f]{32}$/),
```

(Belt-and-suspenders: malformed tokens already fail HMAC; this just rejects garbage before any crypto work and pins the documented shape.)

**Verify**: `npm run typecheck` → exit 0.

### Step 3: Add tests

Extend `lib/bookmarklet.test.ts` (same `describe`, same dynamic-import pattern). Use `vi.useFakeTimers()` / `vi.setSystemTime()` to control `Date.now()`:

```ts
import { describe, expect, it, beforeAll, afterEach, vi } from "vitest";
// ...
afterEach(() => vi.useRealTimers());
```

**Verify**: `npx vitest run lib/bookmarklet.test.ts` → all pass.

## Test plan

New cases in `lib/bookmarklet.test.ts`:

1. **Expired token rejected**: sign a token, advance fake time by `TOKEN_MAX_AGE_MS + 1`, expect `verifyBookmarkletToken` → `null`.
2. **Near-expiry token accepted**: advance by `TOKEN_MAX_AGE_MS - 60_000`, expect the userId back.
3. **Missing timestamp fails closed**: hand-craft a payload without a timestamp (`Buffer.from("some-user-id").toString("base64url")` + valid HMAC over `"some-user-id"` computed with the same test secret via `node:crypto`), expect `null`.
4. **Garbage timestamp fails closed**: payload `userId.notanumber`, valid HMAC, expect `null`.

Pattern to model after: the existing two tests in the same file. Full verification: `npm test` → all pass (30 existing + 4 new + plan-003 tests if already landed).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "TOKEN_MAX_AGE_MS" lib/bookmarklet.ts` → constant defined and used in `verifyBookmarkletToken`
- [ ] `grep -n "min(10)" app/api/bookmarklet/route.ts` → no matches
- [ ] `npx vitest run lib/bookmarklet.test.ts` → ≥6 tests pass
- [ ] `npm run lint`, `npm run typecheck`, `npm test` all exit 0
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The token format in `signBookmarkletToken` no longer matches `userId.Date.now()` (drift — the expiry parse would be wrong).
- Any _other_ call site of `verifyBookmarkletToken` exists beyond `app/api/bookmarklet/route.ts` (grep first; at planning time there is exactly one).
- The regex in step 2 rejects a token produced by `signBookmarkletToken` in a quick REPL check — fix the regex to match reality, and if you can't, drop the regex and keep only min/max length.

## Maintenance notes

- **Operator-visible behavior change**: ~180 days after a token is issued, the installed bookmarklet starts getting 401s. The fix is regenerate-and-reinstall in Settings → Bookmarklet. Consider (deferred) making the 401 HTML response say "token expired — regenerate in Settings" instead of the generic `invalid token` text.
- If per-token revocation is ever needed (e.g. multiple devices), that's the DB-backed token table deliberately deferred above; the expiry check here remains valid alongside it.
- Reviewer should scrutinize: the fail-closed change for timestamp-less payloads — confirm no legacy tokens without timestamps exist in the wild (at planning time, `signBookmarkletToken` has always included one).
