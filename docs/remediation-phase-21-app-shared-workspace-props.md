# Phase 21: App shared workspace props

## Goal

Reduce orchestration duplication in `src/app/App.tsx` by building one shared workspace-panel prop object instead of manually wiring the same contract twice for detached and main workspace rendering.

## What changed

- Added a single `sharedWorkspaceProps` object in `src/app/App.tsx`.
- Updated `DetachedWorkspacePanel` and `MainWorkspacePanel` call sites to consume the shared prop bundle plus only their mode-specific props.
- Preserved existing panel contracts and behavior; this is a wiring refactor, not a workflow change.

## Why this matters

- `App.tsx` had become a fragile copy-paste integration point. The detached and main panel invocations repeated a large prop surface with slightly different local extras.
- That duplication makes future feature work error-prone because adding or changing one shared prop risks drifting the other call site.
- Consolidating the shared contract makes `App.tsx` more declarative and lowers the chance of accidentally wiring a feature into one mode but not the other.

## Result

- `src/app/App.tsx` reduced from 1071 lines to 995 lines.
- The main remaining complexity in `App.tsx` is now event handling and shell composition rather than repeated workspace prop plumbing.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`

All passed after the refactor.

## Remaining follow-up

- `src/stores/app-store.ts` is still the largest renderer-side coordination point.
- `src/features/boards/outline-workspace-canvas.tsx` remains large and is still a valid next-phase split target.
