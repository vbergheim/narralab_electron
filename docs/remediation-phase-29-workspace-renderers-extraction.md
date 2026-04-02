# Phase 29: Extract Shared Workspace Renderers

## Why

`src/app/app-workspace-panels.tsx` had become a second-order orchestration file: not just routing between workspaces, but also embedding the render-time adapter logic for outline, bank, archive, notebook, board-manager, inspector, and transcribe views. That made the file hard to change safely and forced a massive prop/type surface to live inline beside the panel switch logic.

## What changed

- moved the shared workspace prop contracts into `src/app/app-workspace-contract.ts`
- extracted reusable workspace renderer adapters into `src/app/app-workspace-renderers.tsx`
- rewired `DetachedWorkspacePanel` and `MainWorkspacePanel` to compose those renderer adapters instead of inlining every feature-specific render branch
- replaced the previous monolithic `SharedWorkspaceProps` reuse inside renderers with explicit per-renderer contracts so each workspace adapter only depends on the props it actually consumes

## Outcome

- `src/app/app-workspace-panels.tsx` dropped from 725 lines to 573 lines
- workspace routing is now separated from feature-to-prop adapter logic
- renderer contracts are explicit instead of hidden inside a giant panel switch file
- the extracted modules reduce the chance that new workspace features re-inflate `app-workspace-panels.tsx` into another god component

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test`
