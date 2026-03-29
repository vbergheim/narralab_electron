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
    } catch {
      return { file: {} }
    }
  }

  private writeFile(file: SettingsFile) {
    const filePath = this.getFilePath()
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, JSON.stringify(file, null, 2), 'utf8')
  }

  private getFilePath() {
    return path.join(app.getPath('userData'), 'settings.json')
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

function normalizeDefaultBoardView(value?: BoardViewMode | null): BoardViewMode {
  if (value === 'board') {
    return 'board'
  }

  return 'outline'
}

function resolveSecretStorageMode(): 'safe' | 'plain' {
  return safeStorage.isEncryptionAvailable() ? 'safe' : 'plain'
}
