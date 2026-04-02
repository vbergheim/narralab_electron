# Phase 13: Plaintext Secret Opt-In

## Goal
- Stop treating base64 secret storage as an automatic fallback when OS secure storage is unavailable.
- Require explicit user consent before storing API keys without platform encryption.

## Changes
- Updated [ai.ts](/Users/vegard/Desktop/DocuDoc/src/types/ai.ts) to add `allowPlaintextSecrets` to app settings and update input.
- Updated [app-settings-service.ts](/Users/vegard/Desktop/DocuDoc/electron/main/app-settings-service.ts):
  - persist `allowPlaintextSecrets`
  - require the flag before storing secrets with `encoding: 'plain'`
  - throw a readable error when secure storage is unavailable and plaintext fallback has not been explicitly enabled
- Updated [app-store.ts](/Users/vegard/Desktop/DocuDoc/src/stores/app-store.ts) default AI settings to include the new flag.
- Updated [settings-workspace.tsx](/Users/vegard/Desktop/DocuDoc/src/features/settings/settings-workspace.tsx):
  - show a stronger warning when secure storage is unavailable
  - expose a toggle for explicit plaintext opt-in
  - include the opt-in flag in AI-settings saves and per-provider key saves
- Added regression coverage in [app-settings-service.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/app-settings-service.test.ts) for:
  - rejecting plaintext key storage without opt-in
  - allowing and persisting plaintext storage once the user explicitly enables it

## Why this phase matters
- Base64 is not secret storage. Treating it as an automatic fallback was a real security weakness.
- This phase preserves functionality on systems without `safeStorage`, but only after an explicit user decision.
- It turns a silent downgrade into a visible, auditable choice.

## Verification
- `npm run lint`
- `npm run typecheck`
- `npm rebuild better-sqlite3 && npx vitest run tests/unit/app-settings-service.test.ts tests/unit && npm run test:integration`
