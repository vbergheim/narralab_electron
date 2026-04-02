# Phase 11: CI Native Runtime Discipline

## Goal
- Make test commands reliable despite `better-sqlite3` switching between Node and Electron ABIs.
- Add a real packaging smoke test to CI so build drift is caught before release work.

## Changes
- Added [run-unit-tests.mjs](/Users/vegard/Desktop/DocuDoc/scripts/run-unit-tests.mjs) to run unit tests in Node ABI and restore Electron ABI afterward.
- Added [run-test-suite.mjs](/Users/vegard/Desktop/DocuDoc/scripts/run-test-suite.mjs) to:
  - rebuild `better-sqlite3` once for Node
  - run both unit and integration suites
  - restore Electron ABI at the end
- Updated [package.json](/Users/vegard/Desktop/DocuDoc/package.json):
  - added `typecheck`
  - made `test:unit` ABI-safe
  - made `test` deterministic instead of depending on current native-module state
  - pointed `check` at the explicit `typecheck` script
- Updated [ci.yml](/Users/vegard/Desktop/DocuDoc/.github/workflows/ci.yml):
  - use `npm run typecheck`
  - keep `npm run test`
  - add `npm run build:dir` as a packaging smoke test with signing auto-discovery disabled

## Why this phase matters
- Before this phase, test reliability depended on which ABI `better-sqlite3` happened to be built for.
- That is a real maintenance defect, not a cosmetic inconvenience.
- CI also lacked any packaging validation, so Electron-builder drift could have stayed invisible until release time.

## Verification
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test`
- `CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:dir`
