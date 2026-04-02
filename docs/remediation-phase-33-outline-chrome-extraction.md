# Phase 33: Extract Outline Workspace Chrome

## Why

After moving row rendering out, `src/features/boards/outline-workspace.tsx` still owned a large amount of workspace chrome and layout scaffolding: droppable panel chrome, the collapsed rail, add-block menu, and the outline/canvas toggle. Those concerns are not the same as drag coordination or board state orchestration, and they kept the workspace file larger than necessary.

## What changed

- added `src/features/boards/outline-workspace-chrome.tsx`
- moved `DropPanel` into the chrome module
- moved `CollapsedWorkspaceRail` into the chrome module
- moved `AddBlockMenu` into the chrome module
- moved `ViewModeToggle` into the chrome module
- rewired `outline-workspace.tsx` to compose those pieces instead of defining them inline

## Outcome

- `src/features/boards/outline-workspace.tsx` dropped from 1187 lines to 942 lines
- the remaining code in the main workspace file is now more focused on drag state, insertion logic, and board/workspace coordination
- workspace shell primitives now live in a reusable module instead of inflating the orchestration file

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test`
