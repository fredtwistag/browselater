# Plan 006: Block private/internal addresses in all server-side fetches of user-supplied URLs (SSRF guard)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 32ac5e5..HEAD -- lib/extract`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (legitimate public URLs are unaffected; the only behavior change is rejecting private/localhost targets)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `32ac5e5`, 2026-06-10

## Why this matters

BrowseLater's core loop is "user submits URL → server fetches it." Nothing validates the target: `http://localhost:3000/...`, `http://10.0.0.5/admin`, `http://169.254.169.254/latest/meta-data/` are all fetched happily, and `resolveCanonical` follows up to 5 redirects without re-checking each hop — so a public URL can redirect the server into an internal address. The blast radius is moderated by the deployment (Vercel serverless, single-user app where the URL-submitter is the owner), but the bookmarklet token (see plan 005) is a URL-borne credential: anyone who obtains it can make this server fetch arbitrary internal targets and read the response back through the item's extracted content. This plan adds one small, well-tested guard function and calls it at every fetch boundary in the extract pipeline.

## Current state

Fetch sites that take user-controlled URLs (all verified at `32ac5e5`):

- `lib/extract/url.ts:66-82` — `resolveCanonical` loops over redirect hops; `current` starts as user input and is replaced by each `location` header:

```ts
export async function resolveCanonical(input: string): Promise<CanonicalResult> {
  const originalUrl = ensureProtocol(input);
  let current = originalUrl;
  let hops = 0;

  while (hops < 5) {
    const res = await fetchSafe(current, "HEAD");
    if (!res) break;
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      current = new URL(loc, current).toString();
      hops++;
      continue;
    }
```

- `lib/extract/url.ts:100-113` — `fetchSafe` is the only fetch in that file; `redirect: "manual"`, 8s timeout, no target validation.
- `lib/extract/article.ts:34-37` — direct fetch of the (stored, canonicalized) URL:

```ts
const res = await fetch(url, {
  headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
  signal: AbortSignal.timeout(20_000),
});
```

Note: this fetch uses default `redirect: "follow"` — the canonical URL can _still_ redirect to an internal address at extract time, after `resolveCanonical` checked it.

- `lib/extract/pdf.ts:7` — `const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });`
- `lib/extract/image.ts:6` — `const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });`
- `lib/extract/twitter.ts` — fetches a fixed syndication host (`cdn.syndication.twimg.com`) with a user-controlled tweet _ID_, not a user-controlled host. No guard needed.
- `lib/extract/youtube.ts` — drives Playwright to the YouTube URL. Hostname is constrained by `detectType` in `url.ts` (only `youtube.com`/`youtu.be` variants reach it). No guard needed in this plan.
- Entry points calling `resolveCanonical`: `app/api/save/route.ts` and `app/api/bookmarklet/route.ts` (both catch a thrown error from it and return 400 — see `app/api/bookmarklet/route.ts:33-38`).
- Existing test conventions: co-located `*.test.ts`, Vitest. `lib/extract/url.test.ts` (11 tests) is the structural exemplar for this area.
- Repo convention (CLAUDE.md): TypeScript strict; prefer small focused modules in `lib/extract/`.

## Commands you will need

| Purpose   | Command                                        | Expected on success |
| --------- | ---------------------------------------------- | ------------------- |
| One file  | `npx vitest run lib/extract/url-guard.test.ts` | all new tests pass  |
| Tests     | `npm test`                                     | all pass            |
| Typecheck | `npm run typecheck`                            | exit 0              |
| Lint      | `npm run lint`                                 | no errors           |

## Scope

**In scope** (the only files you should modify):

- `lib/extract/url-guard.ts` (create)
- `lib/extract/url-guard.test.ts` (create)
- `lib/extract/url.ts` (wire the guard into `resolveCanonical`/`fetchSafe`)
- `lib/extract/article.ts`, `lib/extract/pdf.ts`, `lib/extract/image.ts` (one guard call each)

**Out of scope** (do NOT touch, even though they look related):

- `lib/extract/twitter.ts`, `lib/extract/youtube.ts` — fixed/constrained hosts, see above.
- DNS-resolution pinning (resolving the hostname and checking the resulting IP, defeating DNS rebinding) — meaningfully harder in a serverless fetch world; explicitly deferred and recorded as accepted residual risk in Maintenance notes.
- `app/api/save/route.ts`, `app/api/bookmarklet/route.ts` — they already 400 on a throwing `resolveCanonical`; no change needed.
- Outbound calls to fixed API hosts (`api.voyageai.com`, Supabase, Anthropic).

## Git workflow

- Branch: `advisor/006-ssrf-guard`
- Commits: conventional commits (e.g. `fix(security): reject private/internal hosts in extract fetches`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the guard

Create `lib/extract/url-guard.ts` exporting:

```ts
export class PrivateUrlError extends Error {}

/** Throws PrivateUrlError if the URL targets a private/internal/non-http location. */
export function assertPublicUrl(input: string): void;
```

Rules `assertPublicUrl` must enforce (parse with `new URL`; invalid URLs throw `PrivateUrlError` too):

1. Protocol must be `http:` or `https:` (rejects `file:`, `ftp:`, `javascript:`, etc.).
2. Reject hostname `localhost`, `*.localhost`, `*.local`, `*.internal`, and the empty hostname.
3. If the hostname is an **IPv4 literal** (all-numeric dotted form — parse the octets, including shorthand like `127.1` by rejecting any hostname matching `/^\d+(\.\d+){0,3}$/` whose canonical form is private), reject these ranges: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16` (cloud metadata), `172.16.0.0/12`, `192.168.0.0/16`, `198.18.0.0/15`.
4. If the hostname is an **IPv6 literal** (URL form `[...]`), reject `::`, `::1`, `fc00::/7` (unique-local), `fe80::/10` (link-local), and IPv4-mapped forms (`::ffff:a.b.c.d` — extract the v4 part and apply rule 3).
5. Everything else (public DNS names, public IPs) passes.

Implement the IPv4 range checks by converting to a 32-bit integer and comparing against (base, mask) pairs — table-driven, not a regex per range.

**Verify**: `npm run typecheck` → exit 0.

### Step 2: Tests first-class

Create `lib/extract/url-guard.test.ts` (model after `lib/extract/url.test.ts` — plain `describe`/`it`, no setup needed). See Test plan below for the required table.

**Verify**: `npx vitest run lib/extract/url-guard.test.ts` → all pass.

### Step 3: Wire into `resolveCanonical` (covers redirect hops)

In `lib/extract/url.ts`, call `assertPublicUrl` in `fetchSafe` (the function both the initial request and every redirect hop go through), before the `fetch`:

```ts
async function fetchSafe(url: string, method: "HEAD" | "GET"): Promise<Response | null> {
  assertPublicUrl(url); // throws PrivateUrlError → bubbles out of resolveCanonical
  try {
    ...
```

Important: the `assertPublicUrl` call goes **outside** the existing `try` (which swallows all errors into `null`) — a private-URL submission must _throw_ out of `resolveCanonical`, because both API entry points already translate a throw into HTTP 400 ("could not resolve url").

**Verify**: `npx vitest run lib/extract/url.test.ts` → existing 11 tests still pass (they exercise `normalizeUrl`/`detectType`, not network).

### Step 4: Wire into the three extractors

At the top of each fetch path, guard the URL and convert a violation into the function's existing "couldn't extract" behavior (these run in the background worker — a throw here would 500 the job; a null/stub return is the established failure mode):

- `lib/extract/article.ts` — before the fetch at line 34: on `PrivateUrlError`, `log.warn("article.private_url", { url })` and `return paywalledStub(url, "blocked url")`? **No** — do not mark it paywalled. Return `null` instead (matches the `ExtractedContent | null` contract) after logging.
- `lib/extract/pdf.ts` — before the fetch at line 7: same pattern, `log.warn("pdf.private_url", { url }); return null;`
- `lib/extract/image.ts` — before the fetch at line 6: same pattern.

Use an explicit try/catch around the single `assertPublicUrl(url)` call (catching only `PrivateUrlError` via `instanceof`), not a blanket try around the function body.

**Verify**: `npm run typecheck` → exit 0; `grep -rn "assertPublicUrl" lib/extract` → 4 call sites (url.ts, article.ts, pdf.ts, image.ts) + the definition.

### Step 5: Full suite

**Verify**: `npm test` → all pass; `npm run lint` → no errors.

## Test plan

`lib/extract/url-guard.test.ts`, table-driven:

**Rejected** (expect `PrivateUrlError`): `http://localhost:3000/x`, `http://app.localhost/`, `https://foo.local/`, `http://127.0.0.1/`, `http://127.8.9.10/`, `http://0.0.0.0/`, `http://10.1.2.3/`, `http://100.64.0.1/`, `http://172.16.0.1/`, `http://172.31.255.255/`, `http://192.168.1.1/`, `http://169.254.169.254/latest/meta-data/`, `http://198.18.0.1/`, `http://[::1]/`, `http://[fc00::1]/`, `http://[fe80::1]/`, `http://[::ffff:127.0.0.1]/`, `file:///etc/passwd`, `ftp://example.com/`, `not a url`.

**Accepted** (no throw): `https://example.com/article`, `http://93.184.216.34/` (public IPv4), `https://sub.domain.co.uk/path?q=1`, `https://[2606:2800:220:1:248:1893:25c8:1946]/` (public IPv6), `https://example.com:8443/x` (non-standard port on public host is fine).

Plus two integration-ish cases in the same file using the real exports from `url.ts` if cheap, otherwise skip — the unit table is the requirement.

Verification: `npx vitest run lib/extract/url-guard.test.ts` → ~25 assertions pass.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `lib/extract/url-guard.ts` and its test file exist; `npx vitest run lib/extract/url-guard.test.ts` exits 0
- [ ] `grep -rn "assertPublicUrl" lib/extract --include="*.ts" | grep -v test | wc -l` → 5 (1 definition + 4 call sites)
- [ ] `npm run lint`, `npm run typecheck`, `npm test` all exit 0
- [ ] Existing `lib/extract/url.test.ts` (11 tests) still passes unmodified
- [ ] No files outside the in-scope list modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The fetch sites listed in "Current state" don't match the live code (drift — new extractors may have appeared and need scoping in).
- Making `resolveCanonical` throw on private URLs breaks an existing test or an API route in a way not covered by the existing 400 handling.
- You're tempted to add DNS resolution to the guard — that's explicitly deferred; note it and move on.
- `tests/e2e/save-loop.spec.ts` starts failing AND `STORAGE_STATE` is set in your environment (the e2e flow saves a real URL; investigate before assuming your guard is wrong).

## Maintenance notes

- **Accepted residual risk (documented, not forgotten)**: DNS rebinding — a public hostname can resolve to a private IP. Defeating that requires resolve-then-pin connections, which standard `fetch` doesn't expose. Revisit if the app ever becomes multi-user or moves off Vercel.
- Any **new extractor** added to `lib/extract/` that fetches a user-controlled URL must call `assertPublicUrl` — reviewers should check for this in future extractor PRs (worth a line in CLAUDE.md when one is next edited).
- The Playwright/YouTube path relies on `detectType`'s hostname allowlist; if YouTube extraction ever falls back to navigating arbitrary URLs, it needs this guard too.
