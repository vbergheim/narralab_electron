# Phase 25: App store archive actions extraction

## Goal

Continue decomposing `src/stores/app-store.ts` by pulling archive-specific actions into their own module so filesystem/archive behavior is no longer mixed inline with project, board, and scene mutations.

## What changed

- Added `src/stores/app-store-archive-actions.ts` for archive-domain actions:
  - folder create/rename/update/delete
  - item add/move/delete
  - item open/reveal
  - selected archive folder updates
- Updated `src/stores/app-store.ts` to compose the archive action module instead of implementing those handlers inline.

## Why this matters

- Archive operations are their own concern surface:
  - they depend on filesystem-backed item behavior
  - they mutate a separate UI selection state
  - they have different failure modes from scenes/boards
- Keeping them embedded in the main store root made `app-store.ts` harder to reason about and increased the chance of accidental coupling between unrelated domains.

## Result

- `src/stores/app-store.ts` reduced from 950 lines to 869 lines in this phase.
- Archive behavior now lives behind an explicit domain module instead of inline store sprawl.
- The store root is becoming more of a composition layer and less of a monolith.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`

All passed after extraction.

## Remaining follow-up

- The next high-value store extractions are:
  - consultant actions
  - scene/scene-folder actions
  - board/board-folder actions
- Those remaining domains still account for most of the complexity left in `src/stores/app-store.ts`.
