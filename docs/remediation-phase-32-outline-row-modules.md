# Phase 32: Extract Outline Row Modules

## Why

`src/features/boards/outline-workspace.tsx` still contained the full outline-row rendering stack inline: sortable row adapters, scene row rendering, text block rendering, beat rendering, and drag-overlay presentation. That made the workspace file carry both workspace orchestration and the detailed row/UI implementation for every row type.

## What changed

- added `src/features/boards/outline-workspace-rows.tsx`
- moved sortable row rendering into `BoardSortableItem`
- moved scene row rendering into `OutlineSceneRow`
- moved beat list and beat row rendering into `OutlineBeatsSection` and `OutlineBeatRow`
- moved text block rendering into `OutlineTextRow`
- moved drag overlay presentation into `OutlineDragOverlayContent`
- rewired `outline-workspace.tsx` to import those renderers instead of defining them inline

## Outcome

- `src/features/boards/outline-workspace.tsx` dropped from 1936 lines to 1188 lines
- workspace orchestration is now separated from row-level rendering behavior
- drag overlay and row rendering can evolve without re-inflating the main outline workspace file
- the remaining size in `outline-workspace.tsx` is now much more concentrated around layout and DnD coordination rather than mixed with row UI details

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test`
