# Feature Removal & Decommissioning Guidelines

Purpose: a short checklist and guidance to follow when removing or decommissioning a feature from the codebase. Follow these steps to ensure safe removal, traceability, and easy recovery.

Quick checklist

1. Confirm decision
   - Link to the issue or RFC that approved the removal.
   - Note the reason and expected impact.

2. Archive implementation
   - Move source files to `archive/<feature-name>/` or create an `archive` branch with the feature commit.
   - Keep tests and docs together in the archive so restoration is straightforward.

3. Update user-facing docs
   - Update `README.md`, `DOCUMENTATION_INDEX.md`, and any relevant guide files.
   - Add a brief deprecation note where users expect the feature (e.g., Help page).

4. Update tests & CI
   - Remove or skip tests that assert the removed behavior (mark them with `test.skip()` if you prefer to keep historical tests).
   - Ensure CI does not reference deleted tests (playwright config, workflow files).

5. Changelog & release note
   - Add an entry to `CHANGELOG.md` (or `FINAL_DELIVERY.md`) detailing the removal, date, and rationale.

6. Backwards-compatibility & DB changes
   - If removal includes DB schema changes, add a migration with a reversible strategy and plan a data-migration or cleanup job.

7. Communication
   - Link the PR to the issue and notify stakeholders (Slack/email) when deploying the change.

8. Post-removal validation
   - Run smoke tests to verify core flows. Add a short test plan to the PR describing which features were manually or automatically validated.

9. Optional: feature flag or deactivated branch
   - If the feature may be restored later, consider moving it behind a feature flag or preserving it on a feature branch rather than deleting.

Guidance for PRs performing removal

- Keep each removal PR narrowly scoped and easy to review. Prefer smaller steps: documentation + tests first, then code removal.
- Include references to archived code & note how to restore it.
- Add a `BREAKING CHANGE` banner to PR body if user-facing behavior changed.

Minimal PR checklist (copy into PR template):

- [ ] Linked issue or RFC
- [ ] Archive or backup created
- [ ] Updated docs & README
- [ ] Updated tests / skipped tests
- [ ] Changelog entry added
- [ ] CI adjusted and smoke tests pass
- [ ] Stakeholders notified

Thank you — following this checklist will keep removals safe, reviewable, and reversible.