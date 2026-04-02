# Phase 24: App store project actions extraction

## Goal

Start decomposing `src/stores/app-store.ts` by extracting the project lifecycle, sync, import/export, and settings actions into a dedicated module backed by an explicit store contract.

## What changed

- Added `src/stores/app-store-contract.ts` to define the shared app-store contract and action/state types.
- Added `src/stores/app-store-project-actions.ts` to own:
  - `initialize`
  - `refreshAll`
  - `syncProjectChanges`
  - `createProject`
  - `openProject`
  - `saveProjectAs`
  - `importJson`
  - `importShootLog`
  - `updateAppSettings`
  - `updateProjectSettings`
  - `exportJson`
  - `exportActiveBoardScript`
- Added `src/stores/app-store-utils.ts` for shared app-store helpers like `runProjectAction`, `toMessage`, `sortBeats`, tag typing, and board reorder helpers.
- Updated `src/stores/app-store.ts` to compose the extracted project action module instead of holding that logic inline.

## Why this matters

- `app-store.ts` was still acting as a god-store with every domain action embedded inline.
- Project lifecycle and sync code form a coherent concern boundary and are a good first extraction target because they:
  - touch global project state
  - own error/reset behavior
  - are reused by many workflows
  - create a natural contract for future renderer/store refactors
- Introducing the explicit contract file also reduces friction for the next extractions instead of repeatedly inventing local helper types.

## Result

- `src/stores/app-store.ts` reduced from 1341 lines at the start of this renderer-remediation track to 950 lines now.
- Project/sync/settings behavior is now isolated behind a dedicated module instead of being welded into the store root.
- Shared app-store helper logic is centralized instead of duplicated or buried at the bottom of the monolith.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`

All passed after the extraction.

## Remaining follow-up

- The next logical app-store extractions are domain actions for:
  - scenes and scene folders
  - boards and board folders
  - archive
  - consultant
- `src/stores/app-store.ts` is smaller, but it is still the largest remaining renderer coordination surface and still needs more domain splitting.
