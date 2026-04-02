# Phase 26: App store consultant actions extraction

## Goal

Continue shrinking `src/stores/app-store.ts` by isolating consultant-specific state transitions and chat orchestration into a dedicated store action module.

## What changed

- Added `src/stores/app-store-consultant-actions.ts`.
- Moved these handlers out of `src/stores/app-store.ts`:
  - `sendConsultantMessage`
  - `setConsultantContextMode`
  - `clearConsultantConversation`

## Why this matters

- Consultant chat has its own async lifecycle, optimistic-message handling, and error-path semantics.
- Keeping it inline in the root store made unrelated store changes harder to reason about and mixed AI chat behavior into scene/board/archive workflows.
- This extraction keeps one domain’s async behavior from leaking into every future store refactor.

## Result

- `src/stores/app-store.ts` reduced from 869 lines to 807 lines in this phase.
- Consultant behavior is now composed into the store root rather than implemented there.

## Validation

- `npm run lint`
- `npm run typecheck`
- `npm run test`

All passed after extraction.

## Remaining follow-up

- The biggest remaining `app-store` chunk is now the scene and board domains.
- Scene actions are the next most coherent extraction target because they still bundle:
  - scene CRUD
  - beat CRUD/reorder
  - folder mutations
  - selection side effects
