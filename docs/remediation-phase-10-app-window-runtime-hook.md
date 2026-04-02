# Phase 10: App Window Runtime Hook

## Goal
- Reduce root-component orchestration pressure in `App.tsx`.
- Pull cross-window runtime synchronization into one dedicated hook instead of scattering it through the shell component.

## Changes
- Added [use-window-runtime.ts](/Users/vegard/Desktop/DocuDoc/src/app/use-window-runtime.ts) to own:
  - window context loading
  - saved layout loading
  - `windows:event` subscription handling
  - scoped project-change sync handling
  - detached-window context synchronization
  - normalization of board view mode
- Updated [App.tsx](/Users/vegard/Desktop/DocuDoc/src/app/App.tsx) to consume the hook instead of embedding the full window-runtime lifecycle directly in the root component.
- Kept rendering logic in `App.tsx` while moving window/runtime effects into a narrower, testable boundary.

## Why this phase matters
- `App.tsx` had become a mixed concern file: shell rendering, window lifecycle wiring, project sync orchestration, and local UI behavior all in one place.
- This extraction does not finish the renderer cleanup, but it removes one of the highest-friction non-visual responsibilities from the root component.
- It creates a cleaner seam for later renderer decomposition without forcing a risky UI rewrite now.

## Verification
- `npm run lint`
- `npx tsc -b`
- `npm rebuild better-sqlite3 && npx vitest run tests/unit && npm run test:integration`
