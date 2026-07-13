---
name: verify
description: How to build, launch, and drive Puzzle Warz to verify changes end-to-end in the running app.
---

# Verifying Puzzle Warz changes

## Launch

- `npm run dev` (webpack). A dev server is often already running on port 3000 —
  check first; a second instance refuses to start ("Another next dev server is
  already running") and falls back to 3001 uselessly. Reuse :3000; it hot-reloads.
- Env comes from `.env.local` / `.env` (Postgres via Prisma). DB is live in dev.

## Auth (most pages redirect to /auth/signin)

- Credentials provider requires `emailVerified` set. Create a fixture user with
  tsx + Prisma (model field is `name`, NOT `username`):
  `prisma.user.upsert({ where: { email }, create: { email, name, password: <bcrypt hash>, emailVerified: new Date() }, ... })`
- Sign in via UI: fill `input[type=email]` + `input[type=password]` on
  `/auth/signin`, submit, wait for redirect to `/dashboard`.

## Driving

- Playwright is a devDependency. ESM scripts importing `@playwright/test` must
  live under the repo root (node resolves from the script's path, not cwd) —
  drop a `.tmp.mjs` in the root and delete it after.
- tsx runs TS as CJS here — no top-level await; wrap in `async function main()`.
- The dev DB may have few/no puzzles of the type you need (check
  `prisma.puzzle.groupBy({ by: ["puzzleType"] })`). Create a one-off fixture
  puzzle (needs `categoryId` from `prisma.puzzleCategory.findFirst()`,
  `puzzleType: "general"`, `solutions.create` with the answer) and delete it
  (solutions + progress + submissions first) when done.
- Solving is one-shot per user: re-testing the submit flow needs
  `userPuzzleProgress.deleteMany` for that user+puzzle between runs.
- Console noise to expect (pre-existing, not a finding): transient
  "Failed to fetch user info" and next-auth CLIENT_FETCH_ERROR during
  navigation; React dev-mode double-invoke stack traces flood stdout — pipe
  through `grep -vE "recursivelyTraverse|webpack-internal|^\s+at "`.

## Flows worth driving

- Text puzzle solve: `/puzzles/<id>` → textarea + "Submit Answer" button.
  Wrong answer → `.pw-pop-in` error box with attempts counter, `.pw-shake`
  wrapper, red border. Correct answer → confetti + "Puzzle Complete!" XP modal.
- Settings: `/settings` (the real page is `src/app/settings/page.tsx`;
  `UserPreferencesSettings.tsx` is orphaned/unmounted). Sound/haptics toggles
  persist to localStorage keys `pw-juice-sound` / `pw-juice-haptics`.
