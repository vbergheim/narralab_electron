# Phase 15: Notebook Service Extraction

## Goal
- Reduce `ProjectService` concentration by removing notebook-specific persistence and formatting logic from it.
- Keep notebook behavior unchanged while creating a narrower service boundary.

## Changes
- Added [notebook-service.ts](/Users/vegard/Desktop/DocuDoc/electron/main/notebook-service.ts) with:
  - notebook sanitization
  - legacy notebook migration
  - plaintext-to-HTML append behavior
  - snapshot normalization
  - metadata-backed get/update/append operations
- Updated [project-service.ts](/Users/vegard/Desktop/DocuDoc/electron/main/project-service.ts) to:
  - initialize `NotebookService`
  - delegate notebook reads and writes
  - reuse the extracted snapshot normalization helper
- Added integration coverage in [notebook-service.test.ts](/Users/vegard/Desktop/DocuDoc/tests/integration/notebook-service.test.ts) for:
  - legacy notebook migration
  - structured notebook updates clearing legacy keys
  - plaintext append behavior

## Why this phase matters
- Notebook handling was mixed into an already overgrown project coordination service.
- This phase removes one complete responsibility cluster from `ProjectService` without changing the public app behavior.
- It creates a cleaner seam for later service decomposition in main.

## Verification
- `npm run lint`
- `npm run typecheck`
- `npm rebuild better-sqlite3 && npx vitest run tests/integration/notebook-service.test.ts tests/unit && npm run test:integration`
