# Gridlock Phase 7 implementation

## Architecture audit

- Catalog Gridlock previously mounted a large legacy component inside `PuzzleFullscreenFrame`, below the shared puzzle header. It had no shared presentation contract and the outer page remained scroll-oriented.
- Daily Gridlock is an embedded homepage experience backed by `/api/gridlock/daily`; there is no dedicated `/daily/gridlock` route to replace. The embedded player now declares Daily persistence explicitly.
- Warz does not currently carry a Gridlock-safe battle payload or a Gridlock renderer. The core accepts a no-persistence mode, but this change intentionally does not advertise or synthesize unsupported Warz behavior.
- Existing production content includes legacy value-entry Gridlock data. Normalization retains that interaction and unknown extension fields; this change performs no automatic production-data migration.

## Shared contract and state

`src/lib/gridlockCore.ts` is the pure contract used for normalization, validation, state transitions, completion checks, submission validation, signatures, serialization, and restoration. It imports no React, browser, Next.js, Prisma, or persistence APIs.

The player exposes explicit loading, ready, playing, checking, completion-pending, won, failed, configuration-error, and network-error states. A completed board is persisted before submission. The same submission ID is retained for a retry, and celebration begins only after a successful server response.

Compatibility exports in `gridlockFile.ts` delegate normalization, validation, and answer checking to the core so the builder, importers, APIs, defensive player checks, and seed data share one implementation.

## Player and responsive shell

- Catalog uses the shared fixed `PuzzlePlayShell`, header timer/progress, help action, reset action, and safe-area behavior.
- The responsive console uses deterministic CSS Grid geometry, a compact analyst-note rail, a bottom command bar, and no horizontal page scrolling.
- Grid cells provide grid/gridcell semantics, roving tab index, arrow navigation, Home/End and Ctrl/Command+Home/End movement, Enter/Space selection, visible focus, locked-cell semantics, and a polite status region.
- Help/onboarding is an accessible focus-trapped dialog. Hints and in-progress selections are included in resumable state.
- Admin desktop and phone previews render the real player with submission, persistence, completion, and rewards disabled.

## Security and completion integrity

- Both dedicated Gridlock state endpoints return allowlisted client data without canonical answers or post-solve metadata.
- The general puzzle-detail sanitizer now strips Gridlock answer state as well, closing a separate broad-payload leak.
- Submission routes use the core validator to reject malformed JSON, unknown IDs, locked IDs, duplicate IDs, invalid value types, and wrong answer counts.
- Authenticated correct solves atomically claim unsolved progress before creating the solve and awarding points, XP, streaks, or achievements. Concurrent completion retries therefore cannot double-award.
- Wrong-submission retries with a stable submission ID return the existing recorded result instead of adding another attempt.
- Responses provide no per-cell correctness map; rule explanations and declassified metadata are returned only after a confirmed solve.

## Validation and test entry points

- `npm run lint:gridlock`
- `npm run test:gridlock`
- `npm run test:gridlock:e2e`
- `npm run build`

Coverage includes pure normalization/state/persistence, legacy compatibility, visual-builder round trips and imports, preview safety, keyboard/touch interaction, hint persistence, server payload validation, mobile viewport fit at 390×844 and 320×568, and failed-completion retry.

No database schema migration is required. Deploy the application normally; existing valid JSON remains compatible.
