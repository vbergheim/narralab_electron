# Phase 35: Extract Scene Bank Row and Utility Modules

## Why

`src/features/scenes/scene-bank-view.tsx` was still a core renderer monolith. It owned folder grouping, folder utility helpers, row selection behavior, inline scene editing, row actions, and the main scene bank shell in one file. That was still too much responsibility for a central workspace view.

## What changed

- added `src/features/scenes/scene-bank-utils.ts`
- moved folder grouping and folder helper functions into the utils module
- moved root-folder constants into the utils module
- added `src/features/scenes/scene-bank-row.tsx`
- moved row selection logic and inline row editing into the row module
- moved scene row rendering and row action affordances into the row module
- rewired `scene-bank-view.tsx` to compose those helpers and row renderers instead of defining them inline

## Outcome

- `src/features/scenes/scene-bank-view.tsx` dropped from 1209 lines to 682 lines
- scene bank orchestration is now separated from row editing and folder grouping mechanics
- the remaining scene bank root component is focused on workspace wiring, menus, and container behavior rather than low-level row implementation

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test`
