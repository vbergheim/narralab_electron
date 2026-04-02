# Phase 23: App shell controls extraction

## Goal

Remove local shell-helper clutter from `src/app/App.tsx` so the root app component stays focused on orchestration instead of housing rail controls, resize UI, and shell utility constants.

## What changed

- Extracted shell UI primitives into `src/app/app-shell-controls.tsx`:
  - `CollapsedRail`
  - `ResizeHandle`
- Extracted non-React shell utilities into `src/app/app-shell-utils.ts`:
  - `densityOptions`
  - `isTextInputTarget`
  - `detachedLabel`
- Updated `src/app/App.tsx` to import these helpers instead of defining them inline.

## Why this matters

- `App.tsx` had accumulated both orchestration logic and shell scaffolding. That increases parse cost and makes root-level changes feel riskier than they need to be.
- Separating component helpers from non-component utilities also keeps the file boundaries compatible with the React refresh lint rules already enforced in the repo.

## Result

- `src/app/App.tsx` reduced from 995 lines to 902 lines.
- The root app file now contains less local shell noise and a clearer split between:
  - workspace orchestration
  - shell UI primitives
  - shell utility/constants

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`

All passed after extraction.

## Remaining follow-up

- `src/stores/app-store.ts` remains the main renderer coordination hotspot.
- `src/app/app-workspace-panels.tsx` still holds a large multi-workspace switch surface and is a valid future split target if more workspace types are added.
