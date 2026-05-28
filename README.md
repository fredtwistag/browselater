# BrowseLater — Build Handoff

This folder is the implementation handoff for **BrowseLater** (browselater.com), a personal web app for saving links and turning them into a personalized knowledge library.

The full product spec lives in [`PRD.md`](./PRD.md). Project conventions and locked decisions are in [`CLAUDE.md`](./CLAUDE.md) (Claude Code loads this automatically). The build is split into four phases under [`tasks/`](./tasks/).

---

## What this folder is

```
browselater/
├── README.md              # you are here
├── PRD.md                 # full product spec
├── CLAUDE.md              # project context Claude Code auto-loads
└── tasks/
    ├── phase-0.md         # foundations: repo, Vercel, Supabase, auth, schema
    ├── phase-1.md         # the save loop: paste URL → extract → list
    ├── phase-2.md         # AI layer: summary, insights, search, chat
    └── phase-3.md         # polish: typography, motion, dark mode, a11y
```

There is **no code yet** — only the spec and the plan. Claude Code will scaffold the Next.js project as part of phase 0.

---

## How to start the build with Claude Code

### 1. Move this folder somewhere git-tracked

Copy or move `browselater/` to wherever you keep code (e.g. `~/code/browselater`). Then:

```bash
cd ~/code/browselater
git init && git add . && git commit -m "chore: import PRD + phase plan"
```

### 2. Open it in Claude Code

In your terminal, from inside the folder:

```bash
claude
```

Claude Code auto-loads `CLAUDE.md` from the project root.

### 3. Kick off phase 0

Paste this as the first prompt:

> Read `PRD.md` and `tasks/phase-0.md`, then execute phase 0. Stop after each task in 0.1–0.6 to let me approve before continuing.

Claude Code will read the spec, scaffold the Next.js + Tailwind project, wire up Supabase, deploy to Vercel, and check off boxes in `tasks/phase-0.md` as it goes.

### 4. Continue phase by phase

After phase 0 is green, start phase 1:

> Phase 0 is complete. Read `tasks/phase-1.md` and execute it task by task, stopping to confirm any architectural choices not already in CLAUDE.md.

Repeat for phases 2 and 3.

---

## What you'll need before kicking off

| Need | Where |
|---|---|
| Vercel account | https://vercel.com |
| Supabase account | https://supabase.com |
| Anthropic API key | https://console.anthropic.com |
| Google OAuth client (optional, magic-link works alone) | https://console.cloud.google.com |
| `browselater.com` registered + DNS pointable to Vercel | your registrar |

Put the secrets in Vercel's project env vars; never commit them. `CLAUDE.md` lists which envs the code expects.

---

## Working effectively with Claude Code on this project

- **Trust but verify.** Read the diffs in each PR before merging.
- **Push back when needed.** If Claude Code reaches for a library that's not in `CLAUDE.md`'s locked stack, ask why and steer it back.
- **Update the PRD when reality changes.** If you decide mid-build to swap a library or change the data model, edit `PRD.md` and `CLAUDE.md` so future sessions see the new truth.
- **Keep tasks small.** If Claude Code wants to bundle three tasks into one PR, ask it to split.

---

## When you've finished v1

Hand the live URL to yourself, save 20 things across types, and run through PRD §11 leading metrics for 30 days. Then either:

- Promote P1 items from PRD §8.1 into a `tasks/phase-4.md` based on what you actually missed, or
- Sit with v1 and let usage tell you what's next.

Resist the urge to ship the browser extension or PWA before you've used v1 for two real weeks.
