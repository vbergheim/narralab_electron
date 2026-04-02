# Phase 8: Board Repository Read Paths

## Goal
- Remove repeated full-board materialization from hot board operations.
- Reduce avoidable main-process work in `BoardRepository` without changing behavior.

## Changes
- Refactored [board-repository.ts](/Users/vegard/Desktop/DocuDoc/electron/main/db/repositories/board-repository.ts) to introduce targeted helpers:
  - `getById(...)`
  - `getItemById(...)`
  - `getItemsByBoardId(...)`
  - `listBoardIds()`
  - `listBoardRows()`
  - `listItemRows()`
- Reworked `list()` to group board items by board id in one pass instead of repeatedly filtering the full item array per board.
- Removed repeated `this.list().find(...)` and `this.list().flatMap(...)` patterns from:
  - `create`
  - `createClone`
  - `delete`
  - `updateBoard`
  - `reorderBoards`
  - `addScene`
  - `duplicateItem`
  - `reorder`
  - `updateItem`

## Why this phase matters
- The old implementation rebuilt all boards and items far too often for single-board mutations.
- That pattern gets worse as the number of boards and board items grows.
- This phase does not solve every read-path problem in the app, but it removes a chunk of unnecessary main-thread work from one of the busiest repositories.

## Verification
- `npm run lint`
- `npx tsc -b`
- `npm rebuild better-sqlite3`
- `npx vitest run tests/integration/board-repository.test.ts tests/unit`
- `npm run test:integration`
