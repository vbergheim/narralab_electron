# Phase 36: Settings Workspace Extraction

## Why

`src/features/settings/settings-workspace.tsx` had become the next likely dumping ground for future feature growth:

- four different settings domains lived in one file
- shared field primitives, tab routing, and panel implementations were mixed together
- app, project, and AI forms held local copies of incoming props without a safe refresh path when settings changed outside the tab

That last point was not cosmetic. It created stale form state if app or project settings were updated elsewhere while the settings workspace stayed mounted.

## What changed

- moved shared settings UI primitives into `src/features/settings/settings-workspace-shared.tsx`
- moved non-component helpers into `src/features/settings/settings-workspace-utils.ts`
- moved tab definitions into `src/features/settings/settings-workspace-config.ts`
- moved the four major settings panels into `src/features/settings/settings-workspace-panels.tsx`
- reduced `src/features/settings/settings-workspace.tsx` to tab routing and panel composition
- replaced unsafe prop-to-state resync effects with controlled remount keys so forms reset cleanly when upstream settings actually change

## Result

- the settings workspace now has explicit module boundaries
- new settings areas can be added without expanding the root workspace file into another monolith
- external settings updates no longer leave app/project/AI forms showing stale values
- the feature follows the same decomposition pattern already applied to app shell, app store, outline workspace, and scene bank

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test`
