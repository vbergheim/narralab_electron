# Phase 19: App Workspace Panels Extraction

## Why this phase

`src/app/App.tsx` still owned the two largest renderer routing branches:

- detached-window workspace rendering
- main-window workspace rendering

That kept the root component responsible for both shell/runtime wiring and nearly all feature-level workspace composition.

## What changed

- Added `/Users/vegard/Desktop/DocuDoc/src/app/app-workspace-panels.tsx`
  - `DetachedWorkspacePanel`
  - `MainWorkspacePanel`
  - shared `WelcomePanel`
- Updated `/Users/vegard/Desktop/DocuDoc/src/app/App.tsx`
  - root now delegates workspace-specific render branches to the panel module
  - retains shell/runtime concerns, inspector composition, dock state, keyboard handling, and toolbar wiring
  - reduced from 1227 lines to 1071

## Risk reduced

- `App.tsx` no longer mixes shell chrome with every workspace subtree.
- Detached and main workspace routing now have a dedicated boundary, which makes future feature additions less likely to further bloat the app root.
- Workspace rendering contracts are now explicit props instead of being buried inside one large root function.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`
