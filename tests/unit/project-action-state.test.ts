import { describe, expect, it } from 'vitest'

import { beginProjectAction, finishProjectAction } from '../../src/stores/project-action-state'

describe('project action state', () => {
  it('increments the pending action count and clears stale errors', () => {
    expect(
      beginProjectAction({
        busy: false,
        error: 'Previous failure',
        pendingProjectActionCount: 0,
      }),
    ).toEqual({
      busy: true,
      error: null,
      pendingProjectActionCount: 1,
    })
  })

  it('keeps busy true while nested actions are still pending', () => {
    expect(
      finishProjectAction({
        pendingProjectActionCount: 2,
      }),
    ).toEqual({
      busy: true,
      pendingProjectActionCount: 1,
    })
  })

  it('never drops below zero when finishing after the last action', () => {
    expect(
      finishProjectAction({
        pendingProjectActionCount: 1,
      }),
    ).toEqual({
      busy: false,
      pendingProjectActionCount: 0,
    })

    expect(
      finishProjectAction({
        pendingProjectActionCount: 0,
      }),
    ).toEqual({
      busy: false,
      pendingProjectActionCount: 0,
    })
  })
})
