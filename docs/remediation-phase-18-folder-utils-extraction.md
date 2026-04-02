# Phase 18: Folder Utils Extraction

## Why this phase

`ProjectService` still contained three near-identical sets of folder path and metadata helpers for:

- board folders
- scene folders
- transcription folders

That duplication made future fixes risky because path normalization, deduplication, folder moves, and rename behavior had to stay aligned in multiple local implementations.

## What changed

- Added `/Users/vegard/Desktop/DocuDoc/electron/main/folder-utils.ts`
  - generic stored-folder parsing
  - generic folder normalization and deduplication
  - shared path helpers (`normalizeFolderPath`, `buildFolderPath`, `replaceFolderPathPrefix`, etc.)
  - shared folder-record factory
- Updated `/Users/vegard/Desktop/DocuDoc/electron/main/project-service.ts`
  - board, scene, and transcription folder flows now use the shared folder utility module
  - removed duplicated local folder parser / normalizer / path helper functions
  - line count reduced from 1497 to 1272
- Added `/Users/vegard/Desktop/DocuDoc/tests/unit/folder-utils.test.ts`
  - verifies parsing, normalization, deduplication, and nested prefix rewriting

## Risk reduced

- Folder semantics now live in one place instead of three drifting copies.
- Future fixes to path normalization or folder moves only need to be done once.
- `ProjectService` keeps shrinking toward orchestration instead of utility accumulation.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`
