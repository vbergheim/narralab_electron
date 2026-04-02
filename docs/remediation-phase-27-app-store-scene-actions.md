# Phase 27: App store scene actions extraction

## Goal

Remove the largest remaining coherent domain block from `src/stores/app-store.ts` by extracting scene-related actions into a dedicated module.

## What changed

- Added `src/stores/app-store-scene-actions.ts`.
- Moved the following scene-domain behavior out of `src/stores/app-store.ts`:
  - scene create/delete/bulk delete
  - scene duplication
  - scene draft persistence
  - scene bulk updates
  - scene folder create/update/delete
  - scene move/reorder
  - beat create/update/delete/reorder

## Why this matters

- Scene behavior previously mixed together:
  - CRUD
  - nested beat management
  - folder mutation
  - tag upsert logic
  - selection side effects
  - board cleanup when scenes are removed
- That is a full domain in its own right, and leaving it inside the root store kept `app-store.ts` acting like a god object.

## Result

- `src/stores/app-store.ts` reduced from 807 lines to 521 lines in this phase.
- The remaining store root is now materially closer to a composition shell than a monolith.
- Scene behavior has a dedicated seam for future tests and further refinement.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`

All passed after extraction.

## Remaining follow-up

- The next major extraction target is the board domain:
  - board CRUD
  - board folder mutation
  - board item/block operations
  - board reorder/move/clone behavior
- After that, the root store should be small enough that the remaining selection/workspace mutations can be reviewed as a separate concern.
