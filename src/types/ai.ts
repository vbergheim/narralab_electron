import type { BoardViewMode } from './board'
import type { TranscriptionLanguage, TranscriptionModelId, TranscriptionTimestampInterval } from './transcription'
import type { SceneDensity } from './view'

export type AIProvider = 'openai' | 'gemini'
export type ConsultantResponseStyle = 'structured' | 'concise' | 'exploratory'
export type ConsultantContextMode = 'none' | 'active-board'
export type WindowWorkspace =
  | 'outline'
  | 'bank'
  | 'inspector'
  | 'notebook'
  | 'archive'
  | 'board-manager'
  | 'transcribe'

export type SavedWindowLayoutWindow = {
  id: string
  workspace: WindowWorkspace
  boardId: string | null
  viewMode: BoardViewMode
  sceneDensity: SceneDensity
  bounds: { x: number; y: number; width: number; height: number }
  displayId: number | null
}

export type SavedWindowLayout = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  windows: SavedWindowLayoutWindow[]
}

export type AppTranscriptionSettings = {
  modelId: TranscriptionModelId
  language: TranscriptionLanguage
  /** How often to insert [HH:MM:SS] markers in transcript output. */
  timestampInterval: TranscriptionTimestampInterval
}

export type AppSettings = {
  ai: {
    provider: AIProvider
    openAiModel: string
    geminiModel: string
    systemPrompt: string
    extraInstructions: string
    responseStyle: ConsultantResponseStyle
    secretStorageMode: 'safe' | 'plain'
    allowPlaintextSecrets: boolean
    hasOpenAiApiKey: boolean
    hasGeminiApiKey: boolean
  }
  ui: {
    restoreLastProject: boolean
    restoreLastLayout: boolean
    defaultBoardView: BoardViewMode
    defaultSceneDensity: SceneDensity
    defaultDetachedWorkspace: WindowWorkspace
    lastProjectPath: string | null
    lastLayoutByProject: Record<string, string>
    savedLayouts: SavedWindowLayout[]
  }
  transcription: AppTranscriptionSettings
}

export type AppSettingsUpdateInput = {
  provider?: AIProvider
  openAiModel?: string
  geminiModel?: string
  systemPrompt?: string
  extraInstructions?: string
  responseStyle?: ConsultantResponseStyle
  allowPlaintextSecrets?: boolean
  openAiApiKey?: string
  geminiApiKey?: string
  clearOpenAiApiKey?: boolean
  clearGeminiApiKey?: boolean
  restoreLastProject?: boolean
  restoreLastLayout?: boolean
  defaultBoardView?: BoardViewMode
  defaultSceneDensity?: SceneDensity
  defaultDetachedWorkspace?: WindowWorkspace
  lastProjectPath?: string | null
  lastLayoutByProject?: Record<string, string>
  savedLayouts?: SavedWindowLayout[]
  transcriptionModelId?: TranscriptionModelId
  transcriptionLanguage?: TranscriptionLanguage
  transcriptionTimestampInterval?: TranscriptionTimestampInterval
}

export type ConsultantRole = 'system' | 'user' | 'assistant'

export type ConsultantMessage = {
  id: string
  role: Exclude<ConsultantRole, 'system'>
  content: string
  createdAt: string
  error?: boolean
}

export type ConsultantChatMessage = {
  role: ConsultantRole
  content: string
}

export type ConsultantChatInput = {
  messages: ConsultantChatMessage[]
  activeBoardId?: string | null
  contextMode?: ConsultantContextMode
}

export type ConsultantChatResult = {
  provider: AIProvider
  model: string
  message: string
}
