# Phase 4: Project Metadata Extraction

## Goal
- Remove direct `app_meta` table knowledge from `ProjectService`.
- Put notebook and metadata blob persistence behind a dedicated repository boundary.
- Add regression coverage for legacy notebook cleanup and metadata round-trips.

## Changes
- Added [project-metadata-repository.ts](/Users/vegard/Desktop/DocuDoc/electron/main/db/repositories/project-metadata-repository.ts) as the single main-process repository for `app_meta` keys used by project metadata.
- Wired `ProjectService` to initialize and use `metadata: ProjectMetadataRepository` inside its repository bundle.
- Replaced raw `app_meta` reads and writes in [project-service.ts](/Users/vegard/Desktop/DocuDoc/electron/main/project-service.ts) for:
  - transcription folders
  - scene folders
  - board folders
  - block templates
  - notebook document persistence
  - legacy notebook fallback reads
- Added integration coverage in [project-metadata-repository.test.ts](/Users/vegard/Desktop/DocuDoc/tests/integration/project-metadata-repository.test.ts) for:
  - metadata blob round-trips
  - notebook persistence clearing legacy notebook keys

## Why this phase matters
- `ProjectService` had become a second persistence layer with hardcoded `app_meta` keys and ad hoc SQL.
- That coupling made metadata storage changes expensive and guaranteed more spread if left alone.
- This phase does not remove JSON blobs yet, but it does put them behind one boundary so later schema cleanup can happen without touching service orchestration code.

## Verification
- `npm run lint`
- `npx tsc -b`
- `npm rebuild better-sqlite3`
- `npx vitest run tests/unit`
- `npm run test:integration`
