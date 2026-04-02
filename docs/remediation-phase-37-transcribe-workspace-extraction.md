# Phase 37: Transcribe Workspace Extraction

## Why

`src/features/transcribe/transcribe-workspace.tsx` still mixed too many concerns in one place:

- subscription and refresh side effects
- job lifecycle state
- transcription library coordination
- scene-linking operations
- all panel rendering for header, new-run flow, metadata, and transcript editing

That shape was still workable, but it was exactly the kind of feature file that turns into a fragile coordination hub as more transcription-related features get added.

## What changed

- moved shared transcribe constants and helpers into `src/features/transcribe/transcribe-workspace-utils.ts`
- moved panel rendering into `src/features/transcribe/transcribe-workspace-sections.tsx`
- reduced `src/features/transcribe/transcribe-workspace.tsx` to state ownership, subscriptions, and action wiring
- kept library mutations and side effects in the root container while making the sections presentational

## Result

- the transcribe workspace now has clearer boundaries between:
  - job state and side effects
  - library and linking actions
  - presentational panel rendering
- new UI work in the transcribe flow can happen without expanding the root container back into a monolith
- the file is easier to reason about because the root now reads as orchestration instead of markup plus orchestration plus helpers

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test`
