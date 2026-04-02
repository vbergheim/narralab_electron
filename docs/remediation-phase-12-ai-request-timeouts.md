# Phase 12: AI Request Timeouts

## Goal
- Stop consultant API requests from hanging indefinitely.
- Make network failure behavior explicit and testable.

## Changes
- Updated [ai-consultant-service.ts](/Users/vegard/Desktop/DocuDoc/electron/main/ai-consultant-service.ts):
  - added a constructor-configurable request timeout
  - wrapped provider fetches in `fetchWithTimeout(...)`
  - translate aborted requests into readable provider-specific timeout errors
- Added unit coverage in [ai-consultant-service.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/ai-consultant-service.test.ts) for:
  - successful OpenAI response handling
  - OpenAI timeout behavior

## Why this phase matters
- AI calls were previously unbounded. A stalled provider request could leave the desktop app waiting forever.
- Desktop apps need explicit failure boundaries, not browser-style optimism about network behavior.
- This phase turns a silent hang risk into deterministic failure behavior the UI can surface.

## Verification
- `npm run lint`
- `npm run typecheck`
- `npm rebuild better-sqlite3 && npx vitest run tests/unit/ai-consultant-service.test.ts tests/unit && npm run test:integration`
