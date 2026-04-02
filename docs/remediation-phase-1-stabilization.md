# Phase 1: Stabilization

Date: 2026-04-02
Branch: `codex/phase-1-stabilization`

## Scope

This phase addresses the highest-risk findings from the technical health audit:

1. Renderer-controlled execution of arbitrary local binaries through transcription settings.
2. Data corruption in board cloning due to incorrect SQL parameter ordering.
3. JSON import failure for tagged scenes because `scene_tags` were inserted before `tags`.
4. Weak BrowserWindow hardening at the Electron boundary.
5. Missing invariant validation for board item reorder operations.
6. Weak settings-file durability and silent corruption handling.
7. Existing lint violations that would otherwise leave the repository in a knowingly red state.

## Changes

### Electron security boundary

- Removed renderer-controlled `whisperCliPath` persistence from app settings and IPC payload parsing.
- Updated transcription resolution so the main process only uses bundled, installed, or PATH-discovered binaries.
- Enabled `sandbox` in `BrowserWindow`.
- Added explicit `setWindowOpenHandler(() => deny)` and blocked non-app navigation through `will-navigate`.

### Data integrity fixes

- Fixed `BoardRepository.createClone()` so cloned board items write `created_at`, `updated_at`, `board_x`, `board_y`, `board_w`, and `board_h` in the correct order.
- Fixed `ProjectService.replaceWithSnapshot()` so tags are inserted before `scene_tags`.
- Hardened `BoardRepository.reorder()` to reject partial, duplicate, and foreign item IDs instead of writing partial order state.

### Persistence hardening

- Changed app settings writes from direct overwrite to temp-file-plus-rename.
- Corrupted `settings.json` files are now quarantined with a `.corrupt-<timestamp>` suffix instead of being silently treated as an empty file with no trace.

### Frontend hygiene included in this phase

- Removed the unsafe manual whisper binary path field from the Settings UI.
- Cleared the current lint blockers in:
  - `src/features/settings/settings-workspace.tsx`
  - `src/features/transcribe/transcribe-workspace.tsx`
  - `src/hooks/use-panel-resize.ts`
  - `src/features/notebook/notebook-editor.tsx`
  - `test_fetch_omp.ts`

## Regression coverage added

- `tests/integration/board-repository.test.ts`
  - verifies cloned board items preserve geometry and timestamps
  - verifies invalid board reorder payloads are rejected
- `tests/unit/project-service-import.test.ts`
  - verifies tagged JSON imports succeed without foreign-key breakage
- `tests/unit/app-settings-service.test.ts`
  - verifies settings writes do not leave temp files behind
  - verifies corrupted settings files are quarantined

## Validation

Completed after the changes:

- `npm run lint`
- `npx tsc -b`
- `npm run test`

## Deferred to next phases

This phase intentionally does not yet split `ProjectService`, narrow the preload bridge, or replace the global refresh model. Those are larger architectural changes and belong in the cleanup/scaling phases after the immediate security and integrity faults are stabilized.
