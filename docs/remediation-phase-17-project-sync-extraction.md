# Phase 17: Project Sync Extraction

## Why this phase

`src/stores/app-store.ts` still mixed three concerns in the same file:

- global UI state
- mutation actions
- project reload / sync merge logic

The reload path was especially important to isolate because it controls how renderer state reacts to broad `project-changed` events and decides which selections survive a partial refresh.

## What changed

- Added `/Users/vegard/Desktop/DocuDoc/src/stores/project-sync.ts`
  - owns full-project loading
  - owns scoped project-change loading
  - owns state-merge rules for partial updates
  - owns reset-state construction
  - owns scope normalization
- Updated `/Users/vegard/Desktop/DocuDoc/src/stores/app-store.ts`
  - `refreshAll()` now delegates to the sync module
  - `syncProjectChanges()` now delegates to the sync module
  - local reset/scope helper functions removed from the store file
  - store line count reduced from 1503 to 1341
- Added `/Users/vegard/Desktop/DocuDoc/tests/unit/project-sync.test.ts`
  - verifies full snapshot merge preserves valid selections
  - verifies partial change merge clears invalid selections and resets consultant history on project switch

## Risk reduced

- Project reload behavior is no longer buried inside the same store file as hundreds of unrelated mutation actions.
- Selection-retention rules now have a direct, testable boundary.
- Future work to replace broad refreshes with more targeted invalidation now has a dedicated module instead of more ad hoc branches inside `app-store`.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`
