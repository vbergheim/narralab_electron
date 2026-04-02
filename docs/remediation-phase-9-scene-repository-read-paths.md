# Phase 9: Scene Repository Read Paths

## Goal
- Remove single-scene and single-beat operations that were still routing through full scene list materialization.
- Keep scene/tag/beat semantics intact while reducing unnecessary database work.

## Changes
- Refactored [scene-repository.ts](/Users/vegard/Desktop/DocuDoc/electron/main/db/repositories/scene-repository.ts) to add targeted helpers:
  - `getTagIdsBySceneId(...)`
  - `listSceneIds()`
  - `listSceneRows()`
  - `listSceneTagRows()`
  - `listSceneBeatRows()`
- Updated `list()` to build tag/beat lookup maps from dedicated helper queries.
- Replaced full `list()`-based single-entity lookups in:
  - `getById(...)`
  - `getBeatsBySceneId(...)`
  - `reorder(...)`
- Preserved scene-tag order for single-scene reads by reading `scene_tags` in insertion order instead of forcing lexical sort.

## Why this phase matters
- The old read path kept paying whole-project cost for operations that only needed one scene or one scene’s beats.
- Scene editing is a hot path; these costs compound as scene and beat counts grow.
- This phase keeps behavior stable while reducing unnecessary main-process work.

## Verification
- `npm run lint`
- `npx tsc -b`
- `npm rebuild better-sqlite3`
- `npx vitest run tests/integration/scene-repository.test.ts tests/unit`
- `npm run test:integration`
