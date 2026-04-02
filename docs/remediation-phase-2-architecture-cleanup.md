# Phase 2: Architecture Cleanup

Date: 2026-04-02
Branch: `codex/phase-1-stabilization`

## Scope

This phase reduces one of the largest architectural bottlenecks identified in the audit:

- overly broad `project-changed` broadcasts
- full-project reloads in the renderer for narrowly scoped mutations
- state drift between windows after app-settings/layout changes
- excessive coupling between main-process mutation handlers and renderer-wide refresh behavior

## Changes

### Scoped project-change events

- Introduced `ProjectChangeScope` and a typed `ProjectChangedEvent` in [src/types/project.ts](/Users/vegard/Desktop/DocuDoc/src/types/project.ts).
- `WindowManager` now broadcasts project changes with:
  - `revision`
  - `scopes`
- Supported scopes include:
  - `project-settings`
  - `app-settings`
  - `notebook`
  - `archive`
  - `scenes`
  - `scene-folders`
  - `boards`
  - `board-folders`
  - `block-templates`
  - `tags`
  - `transcription-library`
  - `layouts`
  - `all`

### Main-process cleanup

- Added scope parsing/validation in [electron/main/ipc-validators.ts](/Users/vegard/Desktop/DocuDoc/electron/main/ipc-validators.ts).
- Replaced broad `windowManager.notifyProjectChanged()` calls in [electron/main/ipc.ts](/Users/vegard/Desktop/DocuDoc/electron/main/ipc.ts) with scoped notifications.
- Layout mutations now explicitly broadcast `layouts`.
- App settings mutations now broadcast `app-settings`.
- `WindowManager` only persists `lastProjectPath` when the change actually affects project identity (`meta` / `all`), instead of rewriting settings on every scene or board mutation.

### Renderer synchronization cleanup

- Added targeted store synchronization in [src/stores/app-store.ts](/Users/vegard/Desktop/DocuDoc/src/stores/app-store.ts) via `syncProjectChanges(scopes)`.
- `App.tsx` now handles scoped project events instead of re-running `initialize()` for every mutation.
- `App.tsx` refreshes saved layouts only when the event scopes require it.
- Removed an unnecessary manual `refreshProject()` call after cross-window board insertion; the board mutation event now propagates through the normal scoped channel.
- The transcribe workspace now refreshes only the library/scenes data it actually depends on when matching scopes change.

## Why this matters

Before this phase, most write operations triggered a renderer-wide “reload everything” path. That was already a scaling problem and a source of fragile cross-window behavior.

After this phase:

- windows receive narrower change signals
- the renderer only re-fetches the datasets affected by the mutation
- app-settings and layout changes propagate explicitly instead of relying on incidental local state
- the project event channel has a typed contract instead of an implicit “something changed somewhere” meaning

This does not finish the broader architectural cleanup, but it removes one of the biggest sources of accidental coupling in the current design.

## Validation

Completed after the changes:

- `npm run lint`
- `npx tsc -b`
- `npx vitest run tests/unit`
- `npm run test:integration`

## Regression coverage added/expanded

- [tests/unit/window-manager.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/window-manager.test.ts)
  - verifies scoped project events
  - verifies monotonic project revision numbers
- [tests/unit/ipc-validators-windows.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/ipc-validators-windows.test.ts)
  - verifies project change scope parsing, deduplication, and invalid-scope rejection

## Deferred to next phases

- breaking up `ProjectService` into narrower main-process services
- reducing preload breadth further
- isolating long-running jobs such as transcription into explicit session/job models
- replacing remaining global UI state duplication between main and renderer
