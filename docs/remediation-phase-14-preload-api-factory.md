# Phase 14: Preload API Factory

## Goal
- Make the preload bridge testable instead of defining the entire API as one untestable side effect.
- Add contract coverage around the bridge surface and drag-session behavior.

## Changes
- Added [electron/preload/api.ts](/Users/vegard/Desktop/DocuDoc/electron/preload/api.ts) with `createNarraLabApi(...)`.
- Simplified [electron/preload/index.ts](/Users/vegard/Desktop/DocuDoc/electron/preload/index.ts) to a thin `contextBridge.exposeInMainWorld(...)` wrapper over the factory.
- Added unit coverage in [tests/unit/preload-api.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/preload-api.test.ts) for:
  - absence of the removed `refreshProject` bridge
  - drag-session cache behavior
  - dropped-file path resolution

## Why this phase matters
- The preload bridge is still broad, but it is no longer opaque.
- Testable bridge construction is a prerequisite for safely shrinking it further.
- This phase improves preload quality without forcing a breaking renderer rewrite.

## Verification
- `npm run lint`
- `npm run typecheck`
- `npm rebuild better-sqlite3 && npx vitest run tests/unit/preload-api.test.ts tests/unit && npm run test:integration`
