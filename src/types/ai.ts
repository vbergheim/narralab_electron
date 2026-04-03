import type { BoardViewMode } from './board'
import type { TranscriptionLanguage, TranscriptionModelId, TranscriptionTimestampInterval } from './transcription'
import type { SceneDensity } from './view'

export type AIProvider = 'openai' | 'gemini'
export type ConsultantResponseStyle = 'structured' | 'concise' | 'exploratory'
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

export type ConsultantLauncherPosition = {
  x: number
  y: number
}

export type ConsultantDialogSize = {
  width: number
  height: number
}

export type ConsultantDialogPosition = {
  x: number
  y: number
}

export type ConsultantContextPayload = {
  ambient: string
  focused?: string
  triggerReason?: string | null
}

export type ConsultantProactiveHint = {
  id: string
  title: string
  prompt: string
  reason: string
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
    consultantLauncherPosition: ConsultantLauncherPosition | null
    consultantDialogSize: ConsultantDialogSize | null
    consultantDialogPosition: ConsultantDialogPosition | null
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
  consultantLauncherPosition?: ConsultantLauncherPosition | null
  consultantDialogSize?: ConsultantDialogSize | null
  consultantDialogPosition?: ConsultantDialogPosition | null
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
  context?: ConsultantContextPayload
}

export type ConsultantChatResult = {
  provider: AIProvider
  model: string
  message: string
}
