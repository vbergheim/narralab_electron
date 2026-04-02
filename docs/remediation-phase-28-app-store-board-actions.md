# Phase 28: App store board actions extraction

## Goal

Finish the major renderer-store decomposition by extracting the board domain out of `src/stores/app-store.ts`.

## What changed

- Added `src/stores/app-store-board-actions.ts`.
- Moved the full board-domain action surface out of the root store:
  - board CRUD
  - board folder create/update/delete/rename
  - board move/reorder/clone
  - board item draft persistence
  - add/remove/reorder/duplicate board items
  - add scene to board
  - add block / block template to board
  - block template create/delete
  - copy block between boards

## Why this matters

- Before this phase, `app-store.ts` still bundled:
  - global project lifecycle
  - archive behavior
  - consultant behavior
  - scene behavior
  - board behavior
  - UI selection/workspace state
- That is exactly the “god store” shape the audit called out.
- Extracting the board domain is the phase that turns the root store from a monolith into an actual composition layer.

## Result

- `src/stores/app-store.ts` reduced from 521 lines to 159 lines in this phase.
- Board behavior now lives in its own module instead of being welded into the root store.
- The root store now mainly owns:
  - initial state
  - composition of domain action modules
  - notebook persistence
  - selection/workspace mutations
  - a few remaining UI-level helpers

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`

All passed after extraction.

## Remaining follow-up

- The remaining `app-store.ts` work is no longer about breaking a god object; it is about polishing the last UI-selection/workspace concerns and deciding whether notebook persistence should also move into its own small domain module.
- `src/app/app-workspace-panels.tsx` remains a secondary renderer composition surface that may still deserve further modularization if new workspace modes continue to be added.
