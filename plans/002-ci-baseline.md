# Plan 002: Add a GitHub Actions CI gate (lint + typecheck + unit tests) and a one-command verify script

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 32ac5e5..HEAD -- package.json .github`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `32ac5e5`, 2026-06-10

## Why this matters

The repo has **no CI at all** (no `.github/workflows/` directory). Lint, typecheck, and 30 unit tests all pass locally in under a minute, but nothing enforces them: a broken commit can land on `main` silently, and every other plan in `plans/` loses its safety net. This plan adds a minimal GitHub Actions workflow that runs the three cheap verification gates on every push and PR, plus an `npm run verify` script so humans and agents have one local command. E2E tests are intentionally **excluded** from CI: they self-skip without a `STORAGE_STATE` auth fixture and need a live Supabase project (`tests/e2e/save-loop.spec.ts:8` — `test.skip(({}, testInfo) => !process.env.STORAGE_STATE, ...)`).

## Current state

- No `.github/` directory exists in the repo.
- `package.json` scripts (verbatim):

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test",
  "prepare": "husky"
}
```

- Verified baseline at `32ac5e5`: `npm run lint` → "No ESLint warnings or errors"; `npm run typecheck` → exit 0; `npm test` → `Test Files 5 passed (5)`, `Tests 30 passed (30)`, ~0.6s.
- The repo uses npm (`package-lock.json` is tracked; there is no yarn/pnpm lockfile).
- The `playwright` package is a production dependency; its install may attempt browser downloads. CI must set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` to keep installs fast since e2e doesn't run in CI.
- The remote is GitHub (`https://github.com/FredPersonal/browselater.git`), default branch `main`.

## Commands you will need

| Purpose   | Command                                   | Expected on success                              |
| --------- | ----------------------------------------- | ------------------------------------------------ |
| Install   | `npm ci`                                  | exit 0                                           |
| Lint      | `npm run lint`                            | "No ESLint warnings or errors"                   |
| Typecheck | `npm run typecheck`                       | exit 0                                           |
| Tests     | `npm test`                                | 30 tests pass                                    |
| CI status | `gh run list --workflow=ci.yml --limit 3` | latest run `completed success` (only after push) |

## Scope

**In scope** (the only files you should modify):

- `.github/workflows/ci.yml` (create)
- `package.json` (add one script)

**Out of scope** (do NOT touch, even though they look related):

- `tests/e2e/**` and `playwright.config.ts` — making e2e CI-runnable needs a seeded Supabase instance and an auth-state bootstrap; that is a separate piece of work.
- `.husky/` / `lint-staged` config — local hooks already work; don't duplicate or alter them.
- Branch-protection settings on GitHub — operator action, not a code change (see Maintenance notes).

## Git workflow

- Branch: `advisor/002-ci-baseline`
- Commits: conventional commits (e.g. `chore(ci): add lint+typecheck+test workflow`)
- Pushing the branch IS required here to verify the workflow runs (step 3) — push the branch only, do not merge to `main` and do not open a PR unless the operator instructed it.

## Steps

### Step 1: Add the `verify` script

In `package.json` scripts, add:

```json
"verify": "npm run lint && npm run typecheck && npm test"
```

**Verify**: `npm run verify` → all three stages pass, exit 0.

### Step 2: Create the workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: "1"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
```

Notes for the executor:

- `npm run lint` (`next lint`) does not need Supabase env vars; neither do typecheck or the unit tests (they set their own env, e.g. `lib/bookmarklet.test.ts` sets `BOOKMARKLET_SIGNING_SECRET` in `beforeAll`). Do NOT add repo secrets to this workflow.
- Do not add a `build` job — `next build` requires `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` at build time; wiring secrets into CI is out of scope here.

**Verify**: `npx --yes yaml-lint .github/workflows/ci.yml 2>/dev/null || python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('yaml ok')"` → parses without error.

### Step 3: Push the branch and confirm the run is green

Push `advisor/002-ci-baseline` to origin.

**Verify**: `gh run list --workflow=ci.yml --branch advisor/002-ci-baseline --limit 1` → status `completed`, conclusion `success`. If the run fails, read `gh run view --log-failed` and fix the workflow file only (one retry; see STOP conditions).

## Test plan

The workflow itself is the test. Acceptance: one green run on GitHub Actions for this branch, executing all three gates (visible as separate steps in the run log).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run verify` exits 0 locally
- [ ] `.github/workflows/ci.yml` exists and a run for this branch shows `completed success` in `gh run list`
- [ ] The run log shows all three commands executed (lint, typecheck, test)
- [ ] `git status` clean; only the two in-scope files changed
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `npm run verify` fails locally before any of your changes (the baseline has drifted from green).
- The CI run fails twice for reasons that are not in `.github/workflows/ci.yml` itself (e.g. a test passes locally but fails on Linux — report the log, don't patch the test in this plan).
- `gh` is not authenticated or the repo has no GitHub remote you can push to.
- A `.github/workflows/` directory already exists (someone added CI since this plan was written).

## Maintenance notes

- **Operator follow-up**: enable branch protection on `main` requiring the `verify` check — that's a GitHub settings change, not code.
- When e2e becomes CI-runnable (seeded Supabase + storage-state bootstrap), add it as a separate workflow/job rather than extending this one — it needs secrets, this one deliberately has none.
- Plan 001 (Next patch) and every later plan should be validated by this workflow once merged; if you land 002 first, re-run CI on those branches.
