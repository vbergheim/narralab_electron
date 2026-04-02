# Phase 34: Extract Outline DnD Coordination Helpers

## Why

Even after moving rows and chrome out, `src/features/boards/outline-workspace.tsx` still contained the full drag lifecycle and insert-position logic inline. That kept the workspace root responsible for low-level DnD bookkeeping instead of just orchestrating state and wiring callbacks.

## What changed

- added `src/features/boards/outline-workspace-dnd.ts`
- moved `DragPayload` into the new DnD module
- moved `handleDragStart` into the new DnD module
- moved `handleDragEnd` into the new DnD module
- moved `resolveInsertAfterItemId` into the new DnD module
- moved `resolveInsertAfterItemIdAtPoint` into the new DnD module
- kept `outline-workspace.tsx` focused on view state and DnD wiring instead of implementing the drag mechanics inline

## Outcome

- `src/features/boards/outline-workspace.tsx` dropped from 941 lines to 721 lines
- outline insertion and reorder mechanics now have a dedicated home
- the main workspace file is now much closer to a composition/orchestration layer than a mixed implementation file

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test`
