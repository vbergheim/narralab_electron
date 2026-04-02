# Phase 3: Transcription Job Isolation

Date: 2026-04-02
Branch: `codex/phase-1-stabilization`

## Scope

This phase removes one of the largest remaining reliability risks from the audit:

- the transcription subsystem was modeled as one shared mutable singleton
- status, diagnostics, cancellation, and child-process handles were global
- one window could overwrite or cancel another window’s job state

## Changes

### Sender-scoped transcription jobs

- Refactored [electron/main/transcription-service.ts](/Users/vegard/Desktop/DocuDoc/electron/main/transcription-service.ts) from a single global runtime into a sender-scoped job map keyed by `WebContents.id`.
- Each sender now has isolated:
  - status
  - cancellation state
  - `ffmpeg` child process handle
  - `whisper` child process handle
  - diagnostic stderr/stdout tails

### IPC contract changes

- `transcription:cancel` now cancels only the current sender’s active job.
- `transcription:getStatus` now returns the current sender’s status.
- `transcription:getDiagnostics` now returns the current sender’s diagnostics.
- Download progress events remain sender-directed instead of relying on a shared mutable `progressSender`.

### Behavioral outcome

Before this phase:

- window A could steal status from window B
- window A could cancel window B’s transcription
- diagnostics were a global scratchpad instead of window/job-local state

After this phase:

- job state is isolated per sender
- cancellation is local to the sender that requested it
- diagnostics reflect the sender’s own runtime, not the last global mutation

## Regression coverage added

- [tests/unit/transcription-service.test.ts](/Users/vegard/Desktop/DocuDoc/tests/unit/transcription-service.test.ts)
  - verifies sender-local cancellation
  - verifies sender-local status lookup
  - verifies idle/empty diagnostics for senders without a job

## Validation

Completed after the changes:

- `npm run lint`
- `npx tsc -b`
- `npx vitest run tests/unit`
- `npm run test:integration`

## Deferred to next phases

- explicit job IDs instead of sender-keyed jobs
- queued/background transcription orchestration
- further preload/IPC narrowing for the transcription surface
- deeper decomposition of the main-process service layer around transcription and project persistence
