# Phase 6: Project Action State

## Goal
- Remove the single-flag `busy` model that let one completed async action hide another ongoing action.
- Make renderer action state safe for nested and parallel project operations.

## Changes
- Added [project-action-state.ts](/Users/vegard/Desktop/DocuDoc/src/stores/project-action-state.ts) with explicit helpers for beginning and finishing project actions.
- Introduced `pendingProjectActionCount` in [app-store.ts](/Users/vegard/Desktop/DocuDoc/src/stores/app-store.ts).
- Updated `runProjectAction(...)` to:
  - increment a pending counter on start
  - keep `busy` true while any project action is still in flight
  - clamp the counter at zero on finish
  - clear stale errors at action start
- Added unit coverage in [project-action-state.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/project-action-state.test.ts) for:
  - error reset on new action start
  - nested action completion while remaining busy
  - zero-floor behavior on final completion

## Why this phase matters
- The old model was already wrong for this codebase because actions can nest and overlap.
- A binary flag creates false idle states, which means inconsistent disabled states in the UI and misleading feedback during long operations.
- This phase keeps the current UI contract intact while making it materially harder for async flows to lie about their state.

## Verification
- `npm run lint`
- `npx tsc -b`
- `npm rebuild better-sqlite3`
- `npx vitest run tests/unit`
- `npm run test:integration`
