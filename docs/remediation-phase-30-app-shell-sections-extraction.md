# Phase 30: Extract App Shell Sections

## Why

`src/app/App.tsx` was still carrying too much shell-specific UI: detached window header chrome, top workspace tabs, inline error banner, inspector side rail, and the floating consultant dock. That left the root component mixing runtime wiring with a large amount of presentational chrome and made further growth in the shell layer harder to control.

## What changed

- added `src/app/app-shell-sections.tsx`
- moved detached-window header UI into `DetachedWindowHeader`
- moved the workspace tab strip into `WorkspaceTabsBar`
- moved the error banner into `ErrorBanner`
- moved the inspector rail/sidebar shell into `InspectorSidebar`
- moved the floating consultant dock into `ConsultantDock`
- extracted a shared `openViewMenu` callback in `App.tsx` to remove duplicated menu-position logic

## Outcome

- `src/app/App.tsx` dropped from 902 lines to 772 lines
- root app logic is now more clearly split between runtime/state wiring and shell presentation
- the top-level shell sections are reusable and easier to evolve independently
- inspector and consultant shell behavior are no longer buried in the main app component

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test`
