# Phase 31: Extract App Derived State Helpers

## Why

After the shell extraction, `src/app/App.tsx` still held too much derived-state logic: scene filter matching, board/scene/block selection derivation, workspace summary generation, block-kind availability rules, and the full inspector-content branching tree. That logic was tightly coupled to the root component and made it harder to reason about app state versus rendering.

## What changed

- added `src/app/app-view-model.tsx`
- moved scene filter matching into `matchesSceneFilters`
- moved selection derivation into `deriveSelectionState`
- moved workspace summary generation into `getWorkspaceSummary`
- moved enabled block-kind derivation into `getBoardBlockKindsForProject`
- moved inspector branch selection into `buildInspectorContent`
- exported `FilterState` from `src/stores/filter-store.ts` so filter logic can be reused explicitly instead of inferred through store internals

## Outcome

- `src/app/App.tsx` dropped from 772 lines to 718 lines
- root app code now reads more like composition/wiring and less like a mixed bag of UI and domain derivations
- inspector typing is now anchored to the actual inspector component contracts instead of ad hoc domain guesses
- filter semantics and workspace-summary rules now have a dedicated home instead of living inline in the root component

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test`
