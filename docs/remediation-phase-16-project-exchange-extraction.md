# Phase 16: Project Exchange Extraction

## Why this phase

`ProjectService` still carried too many unrelated responsibilities after the notebook extraction:

- snapshot export/import normalization
- destructive snapshot replacement against SQLite
- board script rendering
- consultant context shaping

That made the main-process coordination layer too wide and kept a large amount of serialization logic trapped inside the same god class that already owns project lifecycle, repositories, folders, boards, scenes, archive flows, and transcription library access.

## What changed

- Added `/Users/vegard/Desktop/DocuDoc/electron/main/project-exchange.ts`
  - new `ProjectExchangeService`
  - owns snapshot creation
  - owns snapshot normalization and replacement into SQLite
  - owns board script rendering
  - owns consultant-context rendering
  - exports project settings normalization helpers reused by `ProjectService`
- Updated `/Users/vegard/Desktop/DocuDoc/electron/main/project-service.ts`
  - delegates snapshot/import/export/script responsibilities to `ProjectExchangeService`
  - imports shared settings normalization helpers instead of defining them inline
  - reduced from 2180 lines at audit start to 1497 lines after this phase
- Added `/Users/vegard/Desktop/DocuDoc/tests/unit/project-exchange-service.test.ts`
  - covers board-script rendering contract
  - covers consultant-context rendering contract
- Existing `/Users/vegard/Desktop/DocuDoc/tests/unit/project-service-import.test.ts`
  - continues to verify tagged JSON import through the higher-level `ProjectService` path

## Risk reduced

- `ProjectService` no longer mixes domain orchestration with serialization and formatting internals.
- Snapshot replacement logic now has an explicit boundary that can be tested without dragging the whole service surface with it.
- Board script export and consultant-context generation are no longer buried in the same file as folder mutation and repository lifecycle code.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`
