# Phase 7: Electron Window Policy

## Goal
- Make BrowserWindow hardening testable instead of burying it inside `app.ts`.
- Remove dead preload/IPC surface that no longer serves the renderer.

## Changes
- Added [browser-window-policy.ts](/Users/vegard/Desktop/DocuDoc/electron/main/browser-window-policy.ts) to hold:
  - `buildBrowserWindowOptions(...)`
  - `isAllowedAppNavigation(...)`
- Updated [app.ts](/Users/vegard/Desktop/DocuDoc/electron/main/app.ts) to use the shared window-policy helper instead of inlining security-critical BrowserWindow configuration.
- Added unit coverage in [browser-window-policy.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/browser-window-policy.test.ts) for:
  - hardened BrowserWindow webPreferences
  - workspace-specific minimum window bounds
  - same-origin dev navigation policy
  - file-only packaged navigation policy
- Removed the dead `windows.refreshProject` capability from:
  - [ipc.ts](/Users/vegard/Desktop/DocuDoc/electron/main/ipc.ts)
  - [preload/index.ts](/Users/vegard/Desktop/DocuDoc/electron/preload/index.ts)
  - [types/project.ts](/Users/vegard/Desktop/DocuDoc/src/types/project.ts)
- Updated [window-manager.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/window-manager.test.ts) to stop depending on the removed dead path.

## Why this phase matters
- Security settings that are not testable tend to drift.
- Dead privileged APIs are still attack surface until they are removed.
- This phase shrinks the preload contract a little and makes the remaining BrowserWindow policy far easier to keep correct.

## Verification
- `npm run lint`
- `npx tsc -b`
- `npm rebuild better-sqlite3`
- `npx vitest run tests/unit`
- `npm run test:integration`
