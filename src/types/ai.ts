export type AIProvider = 'openai' | 'gemini'
export type ConsultantResponseStyle = 'structured' | 'concise' | 'exploratory'
export type ConsultantContextMode = 'none' | 'active-board'

export type AppSettings = {
  ai: {
    provider: AIProvider
    openAiModel: string
    geminiModel: string
    systemPrompt: string
    extraInstructions: string
    responseStyle: ConsultantResponseStyle
    hasOpenAiApiKey: boolean
    hasGeminiApiKey: boolean
  }
}

export type AppSettingsUpdateInput = {
  provider?: AIProvider
  openAiModel?: string
  geminiModel?: string
  systemPrompt?: string
  extraInstructions?: string
  responseStyle?: ConsultantResponseStyle
  openAiApiKey?: string
  geminiApiKey?: string
  clearOpenAiApiKey?: boolean
  clearGeminiApiKey?: boolean
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
