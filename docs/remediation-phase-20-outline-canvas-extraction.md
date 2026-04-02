# Phase 20: Outline canvas extraction

## Goal

Reduce the size and coordination burden of `src/features/boards/outline-workspace.tsx` by extracting the board canvas subsystem and its shared helpers into dedicated modules without changing runtime behavior or external props.

## What changed

- Extracted the full canvas interaction stack into `src/features/boards/outline-workspace-canvas.tsx`.
- Extracted shared inline action and resize UI primitives into `src/features/boards/outline-workspace-shared.tsx`.
- Extracted non-React helpers for color conversion and drag-session resolution into `src/features/boards/outline-workspace-utils.ts`.
- Updated `src/features/boards/outline-workspace.tsx` to orchestrate outline-mode rendering and import the extracted canvas subsystem instead of embedding it inline.

## Why this matters

- `outline-workspace.tsx` had become a dual-purpose file: outline renderer plus canvas engine plus shared helpers. That made it harder to change either view safely.
- The canvas path has a different failure surface from the outline path: zooming, panning, marquee selection, drag sessions, drop coordinate translation, and card-position persistence. Isolating it reduces regression radius.
- Keeping utility functions out of React component modules also avoids `react-refresh/only-export-components` drift and makes the module boundaries clearer.

## Result

- `src/features/boards/outline-workspace.tsx` reduced from 3169 lines to 1936 lines.
- Canvas-specific logic now lives in a dedicated file at 1159 lines, which is still large but materially more coherent than mixing it into the outline view.
- Shared helper concerns are split by purpose:
  - component helpers in `outline-workspace-shared.tsx`
  - pure utilities in `outline-workspace-utils.ts`

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`

All passed after extraction.

## Remaining follow-up

- `src/features/boards/outline-workspace-canvas.tsx` is still a substantial file and remains a valid next-phase target.
- The next logical split inside the canvas module is card rendering/editing versus viewport/selection/drag state.
