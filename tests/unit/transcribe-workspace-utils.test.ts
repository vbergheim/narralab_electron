import { describe, expect, it } from 'vitest'

import {
  resolveTranscribeWorkspaceView,
} from '@/features/transcribe/transcribe-workspace-utils'

describe('resolveTranscribeWorkspaceView', () => {
  it('defaults to library when no saved item is selected', () => {
    expect(resolveTranscribeWorkspaceView('initial')).toBe('library')
  })

  it('defaults to library when a saved item is already selected', () => {
    expect(resolveTranscribeWorkspaceView('initial')).toBe('library')
  })

  it('switches to transcribe for a new transcription flow', () => {
    expect(resolveTranscribeWorkspaceView('new-transcription')).toBe('transcribe')
  })

  it('switches to library when selecting a saved transcript', () => {
    expect(resolveTranscribeWorkspaceView('library-selection')).toBe('library')
  })

  it('switches to library for external transcript openings', () => {
    expect(resolveTranscribeWorkspaceView('external-selection')).toBe('library')
  })

  it('switches to library after an auto-saved transcription completes', () => {
    expect(resolveTranscribeWorkspaceView('autosave-complete')).toBe('library')
  })
})
