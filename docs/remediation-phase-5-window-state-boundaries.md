# Phase 5: Window State Boundaries

## Goal
- Stop using `WindowManager.globalUiState` as a cross-process dump for renderer-local selection state.
- Keep only truly shared UI state in main.
- Reduce drift between renderer selection state and main-process state.

## Changes
- Narrowed [GlobalUiState](/Users/vegard/Desktop/DocuDoc/src/types/project.ts) to the fields that are actually shared across windows:
  - `activeBoardId`
  - `selectedArchiveFolderId`
  - `selectedTranscriptionItemId`
- Removed board and scene selection fields from the main-process default state in [window-manager.ts](/Users/vegard/Desktop/DocuDoc/electron/main/window-manager.ts).
- Tightened [parseGlobalUiStatePatch](/Users/vegard/Desktop/DocuDoc/electron/main/ipc-validators.ts) so the IPC contract no longer accepts renderer-local selection fields as shared state.
- Removed renderer calls that were pushing local board/scene/item selection into `windows.updateGlobalUiState(...)` from [app-store.ts](/Users/vegard/Desktop/DocuDoc/src/stores/app-store.ts).
- Kept `activeBoardId` updates where they matter for cross-window behavior, such as detached-window defaults and shared board focus.
- Added/updated tests in:
  - [window-manager.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/window-manager.test.ts)
  - [ipc-validators-windows.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/ipc-validators-windows.test.ts)

## Why this phase matters
- Before this phase, main owned a second copy of board and scene selection that renderer also owned locally.
- That made cross-window behavior fragile and encouraged more UI state to leak into the Electron boundary.
- The remaining shared state is now intentional instead of accidental.

## Verification
- `npm run lint`
- `npx tsc -b`
- `npm rebuild better-sqlite3`
- `npx vitest run tests/unit`
- `npm run test:integration`
