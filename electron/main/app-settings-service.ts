import fs from 'node:fs'
import path from 'node:path'

import { app, safeStorage } from 'electron'

import type {
  AIProvider,
  AppSettings,
  AppSettingsUpdateInput,
  ConsultantResponseStyle,
  SavedWindowLayout,
  WindowWorkspace,
} from '@/types/ai'
import type { TranscriptionLanguage, TranscriptionModelId, TranscriptionTimestampInterval } from '@/types/transcription'
import type { BoardViewMode } from '@/types/board'
import type { SceneDensity } from '@/types/view'

type StoredSecret = {
  encoding: 'safe' | 'plain'
  value: string
}

type SettingsFile = {
  ai?: {
    provider?: AIProvider
    openAiModel?: string
    geminiModel?: string
    systemPrompt?: string
    extraInstructions?: string
    responseStyle?: ConsultantResponseStyle
    openAiApiKey?: StoredSecret | null
    geminiApiKey?: StoredSecret | null
  }
  ui?: {
    restoreLastProject?: boolean
    restoreLastLayout?: boolean
    defaultBoardView?: BoardViewMode
    defaultSceneDensity?: SceneDensity
    defaultDetachedWorkspace?: WindowWorkspace
    lastProjectPath?: string | null
    lastLayoutByProject?: Record<string, string>
    savedLayouts?: SavedWindowLayout[]
  }
  transcription?: {
    modelId?: TranscriptionModelId
    language?: TranscriptionLanguage
    timestampInterval?: TranscriptionTimestampInterval
  }
}

type AppSettingsSecrets = {
  openAiApiKey: string | null
  geminiApiKey: string | null
}

const DEFAULT_SETTINGS: AppSettings = {
  ai: {
    provider: 'openai',
    openAiModel: 'gpt-5-mini',
    geminiModel: 'gemini-2.5-flash',
    systemPrompt:
      'Du er en skarp, erfaren dokumentarkonsulent. Gi konkrete, redaksjonelle forslag til struktur, dramaturgi, scenevalg, voiceover, tematiske linjer og hva som mangler. Vær presis og arbeidsnær, ikke vag.',
    extraInstructions: '',
    responseStyle: 'structured',
    secretStorageMode: resolveSecretStorageMode(),
    hasOpenAiApiKey: false,
    hasGeminiApiKey: false,
  },
  ui: {
    restoreLastProject: true,
    restoreLastLayout: true,
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
    timestampInterval: 'segment' as TranscriptionTimestampInterval,
  },
}

export class AppSettingsService {
  getSettings(): AppSettings {
    const { file } = this.readFile()
    return {
      ai: {
        provider: file.ai?.provider ?? DEFAULT_SETTINGS.ai.provider,
        openAiModel: file.ai?.openAiModel?.trim() || DEFAULT_SETTINGS.ai.openAiModel,
        geminiModel: file.ai?.geminiModel?.trim() || DEFAULT_SETTINGS.ai.geminiModel,
        systemPrompt: file.ai?.systemPrompt ?? DEFAULT_SETTINGS.ai.systemPrompt,
        extraInstructions: file.ai?.extraInstructions ?? DEFAULT_SETTINGS.ai.extraInstructions,
        responseStyle: file.ai?.responseStyle ?? DEFAULT_SETTINGS.ai.responseStyle,
        secretStorageMode: resolveSecretStorageMode(),
        hasOpenAiApiKey: !!this.readSecret(file.ai?.openAiApiKey),
        hasGeminiApiKey: !!this.readSecret(file.ai?.geminiApiKey),
      },
      ui: {
        restoreLastProject: file.ui?.restoreLastProject ?? DEFAULT_SETTINGS.ui.restoreLastProject,
        restoreLastLayout: file.ui?.restoreLastLayout ?? DEFAULT_SETTINGS.ui.restoreLastLayout,
        defaultBoardView: normalizeDefaultBoardView(file.ui?.defaultBoardView),
        defaultSceneDensity: file.ui?.defaultSceneDensity ?? DEFAULT_SETTINGS.ui.defaultSceneDensity,
        defaultDetachedWorkspace:
          file.ui?.defaultDetachedWorkspace ?? DEFAULT_SETTINGS.ui.defaultDetachedWorkspace,
        lastProjectPath: file.ui?.lastProjectPath ?? DEFAULT_SETTINGS.ui.lastProjectPath,
        lastLayoutByProject: file.ui?.lastLayoutByProject ?? DEFAULT_SETTINGS.ui.lastLayoutByProject,
        savedLayouts: normalizeLayouts(file.ui?.savedLayouts),
      },
      transcription: {
        modelId: normalizeTranscriptionModelId(file.transcription?.modelId),
        language: normalizeTranscriptionLanguage(file.transcription?.language),
        timestampInterval: normalizeTranscriptionTimestampInterval(file.transcription?.timestampInterval),
      },
    }
  }

  updateSettings(input: AppSettingsUpdateInput): AppSettings {
    const current = this.readFile()
    const nextFile: SettingsFile = {
      ai: {
        provider: input.provider ?? current.file.ai?.provider ?? DEFAULT_SETTINGS.ai.provider,
        openAiModel: input.openAiModel?.trim() || current.file.ai?.openAiModel || DEFAULT_SETTINGS.ai.openAiModel,
        geminiModel: input.geminiModel?.trim() || current.file.ai?.geminiModel || DEFAULT_SETTINGS.ai.geminiModel,
        systemPrompt: input.systemPrompt ?? current.file.ai?.systemPrompt ?? DEFAULT_SETTINGS.ai.systemPrompt,
        extraInstructions:
          input.extraInstructions ?? current.file.ai?.extraInstructions ?? DEFAULT_SETTINGS.ai.extraInstructions,
        responseStyle: input.responseStyle ?? current.file.ai?.responseStyle ?? DEFAULT_SETTINGS.ai.responseStyle,
        openAiApiKey: current.file.ai?.openAiApiKey ?? null,
        geminiApiKey: current.file.ai?.geminiApiKey ?? null,
      },
      ui: {
        restoreLastProject:
          input.restoreLastProject ?? current.file.ui?.restoreLastProject ?? DEFAULT_SETTINGS.ui.restoreLastProject,
        restoreLastLayout:
          input.restoreLastLayout ?? current.file.ui?.restoreLastLayout ?? DEFAULT_SETTINGS.ui.restoreLastLayout,
        defaultBoardView: normalizeDefaultBoardView(
          input.defaultBoardView ?? current.file.ui?.defaultBoardView,
        ),
        defaultSceneDensity:
          input.defaultSceneDensity ??
          current.file.ui?.defaultSceneDensity ??
          DEFAULT_SETTINGS.ui.defaultSceneDensity,
        defaultDetachedWorkspace:
          input.defaultDetachedWorkspace ??
          current.file.ui?.defaultDetachedWorkspace ??
          DEFAULT_SETTINGS.ui.defaultDetachedWorkspace,
        lastProjectPath:
          input.lastProjectPath !== undefined
            ? input.lastProjectPath
            : current.file.ui?.lastProjectPath ?? DEFAULT_SETTINGS.ui.lastProjectPath,
        lastLayoutByProject:
          input.lastLayoutByProject ?? current.file.ui?.lastLayoutByProject ?? DEFAULT_SETTINGS.ui.lastLayoutByProject,
        savedLayouts: normalizeLayouts(input.savedLayouts ?? current.file.ui?.savedLayouts),
      },
      transcription: {
        modelId:
          input.transcriptionModelId !== undefined
            ? normalizeTranscriptionModelId(input.transcriptionModelId)
            : normalizeTranscriptionModelId(current.file.transcription?.modelId),
        language:
          input.transcriptionLanguage !== undefined
            ? normalizeTranscriptionLanguage(input.transcriptionLanguage)
            : normalizeTranscriptionLanguage(current.file.transcription?.language),
        timestampInterval:
          input.transcriptionTimestampInterval !== undefined
            ? normalizeTranscriptionTimestampInterval(input.transcriptionTimestampInterval)
            : normalizeTranscriptionTimestampInterval(current.file.transcription?.timestampInterval),
      },
    }

    if (input.clearOpenAiApiKey) {
      nextFile.ai!.openAiApiKey = null
    } else if (input.openAiApiKey !== undefined) {
      nextFile.ai!.openAiApiKey = input.openAiApiKey.trim()
        ? this.encryptSecret(input.openAiApiKey.trim())
        : null
    }

    if (input.clearGeminiApiKey) {
      nextFile.ai!.geminiApiKey = null
    } else if (input.geminiApiKey !== undefined) {
      nextFile.ai!.geminiApiKey = input.geminiApiKey.trim()
        ? this.encryptSecret(input.geminiApiKey.trim())
        : null
    }

    this.writeFile(nextFile)
    return this.getSettings()
  }

  getSecrets(): AppSettingsSecrets {
    const { file } = this.readFile()
    return {
      openAiApiKey: this.readSecret(file.ai?.openAiApiKey),
      geminiApiKey: this.readSecret(file.ai?.geminiApiKey),
    }
  }

  private readFile(): { file: SettingsFile } {
    const filePath = this.getFilePath()
    if (!fs.existsSync(filePath)) {
      return { file: {} }
    }

    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      return { file: JSON.parse(raw) as SettingsFile }
    } catch (error) {
      const backupPath = this.quarantineCorruptedFile(filePath)
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Failed to read settings file at ${filePath}. Backed up corrupted contents to ${backupPath}.`, message)
      return { file: {} }
    }
  }

  private writeFile(file: SettingsFile) {
    const filePath = this.getFilePath()
    const dir = path.dirname(filePath)
    const tempPath = path.join(dir, `${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`)
    fs.mkdirSync(dir, { recursive: true })
    try {
      fs.writeFileSync(tempPath, JSON.stringify(file, null, 2), 'utf8')
      fs.renameSync(tempPath, filePath)
    } catch (error) {
      fs.rmSync(tempPath, { force: true })
      throw error
    }
  }

  private getFilePath() {
    return path.join(app.getPath('userData'), 'settings.json')
  }

  private quarantineCorruptedFile(filePath: string) {
    const backupPath = `${filePath}.corrupt-${Date.now()}`
    try {
      fs.renameSync(filePath, backupPath)
      return backupPath
    } catch (error) {
      console.error(`Failed to move corrupted settings file ${filePath} out of the way.`, error)
      return filePath
    }
  }

  private encryptSecret(value: string): StoredSecret {
    if (safeStorage.isEncryptionAvailable()) {
      return {
        encoding: 'safe',
        value: safeStorage.encryptString(value).toString('base64'),
      }
    }

    return {
      encoding: 'plain',
      value: Buffer.from(value, 'utf8').toString('base64'),
    }
  }

  private readSecret(secret?: StoredSecret | null) {
    if (!secret?.value) {
      return null
    }

    try {
      if (secret.encoding === 'safe' && safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(secret.value, 'base64'))
      }

      return Buffer.from(secret.value, 'base64').toString('utf8')
    } catch {
      return null
    }
  }
}

function normalizeLayouts(value?: SavedWindowLayout[] | null): SavedWindowLayout[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((layout) => ({
      ...layout,
      windows: Array.isArray(layout.windows)
        ? layout.windows.map((windowState) => ({
            ...windowState,
            viewMode: normalizeDefaultBoardView(windowState.viewMode),
            displayId:
              typeof windowState.displayId === 'number' && Number.isFinite(windowState.displayId)
                ? windowState.displayId
                : null,
          }))
        : [],
    }))
    .filter((layout) => layout.id && layout.name)
}

function normalizeDefaultBoardView(value?: BoardViewMode | string | null): BoardViewMode {
  if (value === 'board') return 'canvas'
  if (value === 'canvas') return 'canvas'
  if (value === 'timeline') return 'outline'
  if (value === 'outline') return 'outline'
  return 'outline'
}

function resolveSecretStorageMode(): 'safe' | 'plain' {
  return safeStorage.isEncryptionAvailable() ? 'safe' : 'plain'
}

const transcriptionModelIds = new Set<TranscriptionModelId>([
  'base',
  'small',
  'medium',
  'large-v3-turbo',
  'nb-whisper-medium',
  'nb-whisper-large',
])
const transcriptionLanguages = new Set<TranscriptionLanguage>([
  'auto',
  'en',
  'nb',
  'nn',
  'sv',
  'da',
  'de',
  'fr',
  'es',
  'it',
  'pt',
  'nl',
  'pl',
  'ru',
  'uk',
  'ja',
  'zh',
])

function normalizeTranscriptionModelId(value?: TranscriptionModelId | string | null): TranscriptionModelId {
  if (typeof value === 'string' && transcriptionModelIds.has(value as TranscriptionModelId)) {
    return value as TranscriptionModelId
  }
  return DEFAULT_SETTINGS.transcription.modelId
}

function normalizeTranscriptionLanguage(value?: TranscriptionLanguage | string | null): TranscriptionLanguage {
  if (typeof value === 'string' && transcriptionLanguages.has(value as TranscriptionLanguage)) {
    return value as TranscriptionLanguage
  }
  return DEFAULT_SETTINGS.transcription.language
}

function normalizeTranscriptionTimestampInterval(
  value?: TranscriptionTimestampInterval | string | number | null,
): TranscriptionTimestampInterval {
  if (value === 'none' || value === 'segment') {
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }
  // Backwards compatibility for '1min', '5min' strings
  if (value === '1min') return 60
  if (value === '5min') return 300

  return DEFAULT_SETTINGS.transcription.timestampInterval
}
