import os from 'node:os'

import { describe, expect, it, vi } from 'vitest'

import type { AppSettings } from '@/types/ai'
import type { TranscriptionStatus } from '@/types/transcription'

vi.mock('electron', () => ({
  app: {
    getPath: () => os.tmpdir(),
    getVersion: () => 'test-version',
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}))

import { TranscriptionService } from '../../electron/main/transcription-service'

type InternalJob = {
  sender: { id: number; send: ReturnType<typeof vi.fn> }
  status: TranscriptionStatus
  ffmpegProc: import('node:child_process').ChildProcess | null
  whisperProc: import('node:child_process').ChildProcess | null
  cancelled: boolean
  diagnosticFfmpegStderr: string
  diagnosticWhisperStderr: string
  diagnosticWhisperStdout: string
}

function buildSettings(): AppSettings {
  return {
    ai: {
      provider: 'openai',
      openAiModel: 'gpt-5-mini',
      geminiModel: 'gemini-2.5-flash',
      systemPrompt: '',
      extraInstructions: '',
      responseStyle: 'structured',
      secretStorageMode: 'plain',
      hasOpenAiApiKey: false,
      hasGeminiApiKey: false,
    },
    ui: {
      restoreLastProject: false,
      restoreLastLayout: false,
      defaultBoardView: 'outline',
      defaultSceneDensity: 'compact',
      defaultDetachedWorkspace: 'outline',
      lastProjectPath: null,
      lastLayoutByProject: {},
      savedLayouts: [],
    },
    transcription: {
      modelId: 'small',
      language: 'auto',
      timestampInterval: 'segment',
    },
  }
}

describe('TranscriptionService job isolation', () => {
  it('tracks status per sender and leaves unrelated senders untouched when cancelling', () => {
    const service = new TranscriptionService(
      { getSettings: () => buildSettings() } as never,
      { getMeta: () => null } as never,
    )
    const jobs = (service as unknown as { jobs: Map<number, InternalJob> }).jobs
    const killSenderOne = vi.fn()

    jobs.set(1, {
      sender: { id: 1, send: vi.fn() },
      status: { phase: 'transcribing', message: 'Sender one' },
      ffmpegProc: { kill: killSenderOne } as unknown as import('node:child_process').ChildProcess,
      whisperProc: null,
      cancelled: false,
      diagnosticFfmpegStderr: 'ffmpeg one',
      diagnosticWhisperStderr: '',
      diagnosticWhisperStdout: '',
    })
    jobs.set(2, {
      sender: { id: 2, send: vi.fn() },
      status: { phase: 'idle', message: 'Sender two' },
      ffmpegProc: null,
      whisperProc: null,
      cancelled: false,
      diagnosticFfmpegStderr: '',
      diagnosticWhisperStderr: '',
      diagnosticWhisperStdout: '',
    })

    service.cancel(1)

    expect(killSenderOne).toHaveBeenCalledWith('SIGTERM')
    expect(service.getStatus(1)).toEqual({ phase: 'cancelled', message: 'Cancelled' })
    expect(service.getStatus(2)).toEqual({ phase: 'idle', message: 'Sender two' })
  })

  it('returns idle status and empty diagnostics for senders without a job', () => {
    const service = new TranscriptionService(
      { getSettings: () => buildSettings() } as never,
      { getMeta: () => null } as never,
    )
    vi.spyOn(service, 'resolveWhisperCliPath').mockReturnValue(null)

    expect(service.getStatus(999)).toEqual({ phase: 'idle', message: '' })
    expect(service.getDiagnostics(999)).toMatchObject({
      status: { phase: 'idle', message: '' },
      cancelled: false,
      ffmpegChildRunning: false,
      whisperChildRunning: false,
      ffmpegStderrTail: '',
      whisperStderrTail: '',
      whisperStdoutTail: '',
    })
  })
})
