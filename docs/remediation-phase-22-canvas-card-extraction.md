# Phase 22: Canvas card extraction

## Goal

Continue decomposing the board canvas implementation by separating card/editor rendering from viewport, selection, and drag orchestration.

## What changed

- Extracted `BoardCanvasCard` and its rendering/editor subcomponents into `src/features/boards/outline-workspace-canvas-card.tsx`.
- Kept `src/features/boards/outline-workspace-canvas.tsx` focused on:
  - zoom and panning
  - marquee selection
  - grouped drag preview
  - native drop handling
  - viewport centering and reveal behavior
- Passed the drag-target guard from the canvas coordinator into the card module instead of duplicating drag-ignore logic.

## Why this matters

- The canvas file previously mixed two very different concerns:
  - viewport state and pointer coordination
  - per-card presentation and inline editing
- Those concerns evolve for different reasons and carry different regression risks. Splitting them reduces local complexity and makes future changes more isolated.

## Result

- `src/features/boards/outline-workspace-canvas.tsx` reduced from 1159 lines to 706 lines.
- Card/editor rendering now lives in `src/features/boards/outline-workspace-canvas-card.tsx` at 466 lines.
- The canvas module is now substantially closer to a coordinator instead of a monolith.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`

All passed after the split.

## Remaining follow-up

- `src/stores/app-store.ts` remains the largest renderer-side orchestration unit.
- The next likely store refactor target is domain-specific action extraction for scenes/boards/archive rather than further UI-level decomposition.
