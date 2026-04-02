import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', async () => {
  if (!process.env.NARRALAB_TEST_USER_DATA) {
    process.env.NARRALAB_TEST_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'narralab-settings-'))
  }

  return ({
  app: {
    getPath: () => process.env.NARRALAB_TEST_USER_DATA as string,
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value, 'utf8'),
    decryptString: (value: Buffer) => value.toString('utf8'),
  },
  })
})

import { AppSettingsService } from '../../electron/main/app-settings-service'

describe('AppSettingsService', () => {
  const tempRoot = process.env.NARRALAB_TEST_USER_DATA as string
  const service = new AppSettingsService()
  const settingsPath = path.join(tempRoot, 'settings.json')

  beforeEach(() => {
    fs.rmSync(settingsPath, { force: true })
    for (const entry of fs.readdirSync(tempRoot)) {
      if (entry.startsWith('settings.json.corrupt-')) {
        fs.rmSync(path.join(tempRoot, entry), { force: true })
      }
    }
  })

  afterEach(() => {
    fs.rmSync(settingsPath, { force: true })
    for (const entry of fs.readdirSync(tempRoot)) {
      if (entry.startsWith('settings.json.corrupt-')) {
        fs.rmSync(path.join(tempRoot, entry), { force: true })
      }
    }
  })

  it('writes settings through a temporary file and persists transcription defaults without custom paths', () => {
    const updated = service.updateSettings({
      transcriptionModelId: 'medium',
      transcriptionLanguage: 'nb',
      transcriptionTimestampInterval: 120,
    })

    expect(updated.transcription).toEqual({
      modelId: 'medium',
      language: 'nb',
      timestampInterval: 120,
    })

    const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
      transcription?: { modelId?: string; language?: string; timestampInterval?: number | string; whisperCliPath?: string }
    }

    expect(raw.transcription).toEqual({
      modelId: 'medium',
      language: 'nb',
      timestampInterval: 120,
    })
    expect(fs.readdirSync(tempRoot).some((entry) => entry.endsWith('.tmp'))).toBe(false)
  })

  it('quarantines a corrupted settings file instead of silently reusing it', () => {
    fs.writeFileSync(settingsPath, '{"broken": ', 'utf8')

    const settings = service.getSettings()
    const corruptCopies = fs.readdirSync(tempRoot).filter((entry) => entry.startsWith('settings.json.corrupt-'))

    expect(settings.ai.provider).toBe('openai')
    expect(corruptCopies).toHaveLength(1)
    expect(fs.existsSync(settingsPath)).toBe(false)
  })
})
