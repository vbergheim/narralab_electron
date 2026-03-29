import type { ArchiveFolderUpdateInput, ArchiveItemUpdateInput } from '@/types/archive'
import type { AppSettingsUpdateInput, ConsultantChatInput, SavedWindowLayout, WindowWorkspace } from '@/types/ai'
import type { BoardItemKind, BoardItemUpdateInput, BoardTextItemKind, BoardUpdateInput, BoardViewMode } from '@/types/board'
import type { ProjectSettingsUpdateInput, WindowContext } from '@/types/project'
import type { SceneColor, SceneStatus, SceneBeatUpdateInput, SceneUpdateInput } from '@/types/scene'
import type { TagType } from '@/types/tag'
import type { SceneDensity } from '@/types/view'

const sceneColors = new Set<SceneColor>([
  'charcoal',
  'slate',
  'amber',
  'ochre',
  'crimson',
  'rose',
  'olive',
  'moss',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'plum',
])
const sceneStatuses = new Set<SceneStatus>(['candidate', 'selected', 'maybe', 'omitted', 'locked'])
const boardTextKinds = new Set<BoardTextItemKind>(['chapter', 'voiceover', 'narration', 'text-card', 'note'])
const boardViews = new Set<BoardViewMode>(['outline', 'timeline', 'board'])
const sceneDensities = new Set<SceneDensity>(['table', 'compact', 'detailed'])
const windowWorkspaces = new Set<WindowWorkspace>(['outline', 'bank', 'inspector', 'notebook', 'archive'])
const aiProviders = new Set(['openai', 'gemini'] as const)
const responseStyles = new Set(['structured', 'concise', 'exploratory'] as const)
const tagTypes = new Set<TagType>(['general', 'character', 'theme', 'location'])

type AnyRecord = Record<string, unknown>

export function requireString(value: unknown, label: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }

  return value
}

export function optionalString(value: unknown, label: string) {
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string`)
  }

  return value
}

export function nullableString(value: unknown, label: string) {
  if (value === null) {
    return null
  }

  return optionalString(value, label)
}

export function requireStringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new Error(`${label} must be an array of strings`)
  }

  return value
}

export function parseSceneUpdateInput(value: unknown): SceneUpdateInput {
  const input = requireObject(value, 'Scene update')
  const next: SceneUpdateInput = {
    id: requireString(input.id, 'Scene id'),
  }

  if (input.sortOrder !== undefined) next.sortOrder = requireFiniteNumber(input.sortOrder, 'Scene sort order')
  if (input.title !== undefined) next.title = optionalString(input.title, 'Scene title') ?? ''
  if (input.synopsis !== undefined) next.synopsis = optionalString(input.synopsis, 'Scene synopsis') ?? ''
  if (input.notes !== undefined) next.notes = optionalString(input.notes, 'Scene notes') ?? ''
  if (input.color !== undefined) next.color = requireSceneColor(input.color, 'Scene color')
  if (input.status !== undefined) next.status = requireSceneStatus(input.status, 'Scene status')
  if (input.keyRating !== undefined) next.keyRating = requireSceneKeyRating(input.keyRating)
  if (input.folder !== undefined) next.folder = optionalString(input.folder, 'Scene folder') ?? ''
  if (input.category !== undefined) next.category = optionalString(input.category, 'Scene category') ?? ''
  if (input.estimatedDuration !== undefined) next.estimatedDuration = requireFiniteNumber(input.estimatedDuration, 'Estimated duration')
  if (input.actualDuration !== undefined) next.actualDuration = requireFiniteNumber(input.actualDuration, 'Actual duration')
  if (input.location !== undefined) next.location = optionalString(input.location, 'Scene location') ?? ''
  if (input.characters !== undefined) next.characters = requireStringArray(input.characters, 'Scene characters')
  if (input.function !== undefined) next.function = optionalString(input.function, 'Scene function') ?? ''
  if (input.sourceReference !== undefined) next.sourceReference = optionalString(input.sourceReference, 'Scene source reference') ?? ''
  if (input.tagIds !== undefined) next.tagIds = requireStringArray(input.tagIds, 'Scene tag ids')

  return next
}

export function parseSceneBeatUpdateInput(value: unknown): SceneBeatUpdateInput {
  const input = requireObject(value, 'Scene beat update')
  const next: SceneBeatUpdateInput = {
    id: requireString(input.id, 'Beat id'),
  }

  if (input.sortOrder !== undefined) next.sortOrder = requireFiniteNumber(input.sortOrder, 'Beat sort order')
  if (input.text !== undefined) next.text = optionalString(input.text, 'Beat text') ?? ''
  return next
}

export function parseBoardUpdateInput(value: unknown): BoardUpdateInput {
  const input = requireObject(value, 'Board update')
  const next: BoardUpdateInput = {
    id: requireString(input.id, 'Board id'),
  }

  if (input.name !== undefined) next.name = optionalString(input.name, 'Board name') ?? ''
  if (input.description !== undefined) next.description = optionalString(input.description, 'Board description') ?? ''
  if (input.color !== undefined) next.color = requireSceneColor(input.color, 'Board color')
  if (input.folder !== undefined) next.folder = optionalString(input.folder, 'Board folder') ?? ''
  return next
}

export function parseBoardItemUpdateInput(value: unknown): BoardItemUpdateInput {
  const input = requireObject(value, 'Board item update')
  const next: BoardItemUpdateInput = {
    id: requireString(input.id, 'Board item id'),
  }

  if (input.kind !== undefined) next.kind = requireBoardTextKind(input.kind, 'Board item kind')
  if (input.title !== undefined) next.title = optionalString(input.title, 'Board item title') ?? ''
  if (input.body !== undefined) next.body = optionalString(input.body, 'Board item body') ?? ''
  if (input.color !== undefined) next.color = requireSceneColor(input.color, 'Board item color')
  if (input.boardX !== undefined) next.boardX = requireFiniteNumber(input.boardX, 'Board X')
  if (input.boardY !== undefined) next.boardY = requireFiniteNumber(input.boardY, 'Board Y')
  if (input.boardW !== undefined) next.boardW = requireFiniteNumber(input.boardW, 'Board width')
  if (input.boardH !== undefined) next.boardH = requireFiniteNumber(input.boardH, 'Board height')
  return next
}

export function parseArchiveFolderUpdateInput(value: unknown): ArchiveFolderUpdateInput {
  const input = requireObject(value, 'Archive folder update')
  const next: ArchiveFolderUpdateInput = {
    id: requireString(input.id, 'Archive folder id'),
  }

  if (input.name !== undefined) next.name = optionalString(input.name, 'Archive folder name') ?? ''
  if (input.parentId !== undefined) next.parentId = nullableString(input.parentId, 'Archive parent folder id') ?? null
  if (input.color !== undefined) next.color = requireSceneColor(input.color, 'Archive folder color')
  return next
}

export function parseArchiveItemUpdateInput(value: unknown): ArchiveItemUpdateInput {
  const input = requireObject(value, 'Archive item update')
  const next: ArchiveItemUpdateInput = {
    id: requireString(input.id, 'Archive item id'),
  }

  if (input.name !== undefined) next.name = optionalString(input.name, 'Archive item name') ?? ''
  if (input.folderId !== undefined) next.folderId = nullableString(input.folderId, 'Archive folder id') ?? null
  return next
}

export function parseProjectSettingsUpdateInput(value: unknown): ProjectSettingsUpdateInput {
  const input = requireObject(value, 'Project settings update')
  const next: ProjectSettingsUpdateInput = {}

  if (input.title !== undefined) next.title = optionalString(input.title, 'Project title') ?? ''
  if (input.genre !== undefined) next.genre = optionalString(input.genre, 'Project genre') ?? ''
  if (input.format !== undefined) next.format = optionalString(input.format, 'Project format') ?? ''
  if (input.targetRuntimeMinutes !== undefined) next.targetRuntimeMinutes = requireFiniteNumber(input.targetRuntimeMinutes, 'Target runtime')
  if (input.logline !== undefined) next.logline = optionalString(input.logline, 'Project logline') ?? ''
  if (input.defaultBoardView !== undefined) next.defaultBoardView = requireBoardViewMode(input.defaultBoardView, 'Default board view')
  if (input.enabledBlockKinds !== undefined) next.enabledBlockKinds = requireBoardTextKindArray(input.enabledBlockKinds, 'Enabled block kinds')
  if (input.blockKindOrder !== undefined) next.blockKindOrder = requireBoardTextKindArray(input.blockKindOrder, 'Block kind order')

  return next
}

export function parseAppSettingsUpdateInput(value: unknown): AppSettingsUpdateInput {
  const input = requireObject(value, 'App settings update')
  const next: AppSettingsUpdateInput = {}

  if (input.provider !== undefined) next.provider = requireEnum(input.provider, aiProviders, 'AI provider')
  if (input.openAiModel !== undefined) next.openAiModel = optionalString(input.openAiModel, 'OpenAI model') ?? ''
  if (input.geminiModel !== undefined) next.geminiModel = optionalString(input.geminiModel, 'Gemini model') ?? ''
  if (input.systemPrompt !== undefined) next.systemPrompt = optionalString(input.systemPrompt, 'System prompt') ?? ''
  if (input.extraInstructions !== undefined) next.extraInstructions = optionalString(input.extraInstructions, 'Extra instructions') ?? ''
  if (input.responseStyle !== undefined) next.responseStyle = requireEnum(input.responseStyle, responseStyles, 'Response style')
  if (input.openAiApiKey !== undefined) next.openAiApiKey = optionalString(input.openAiApiKey, 'OpenAI API key') ?? ''
  if (input.geminiApiKey !== undefined) next.geminiApiKey = optionalString(input.geminiApiKey, 'Gemini API key') ?? ''
  if (input.clearOpenAiApiKey !== undefined) next.clearOpenAiApiKey = requireBoolean(input.clearOpenAiApiKey, 'Clear OpenAI API key')
  if (input.clearGeminiApiKey !== undefined) next.clearGeminiApiKey = requireBoolean(input.clearGeminiApiKey, 'Clear Gemini API key')
  if (input.restoreLastProject !== undefined) next.restoreLastProject = requireBoolean(input.restoreLastProject, 'Restore last project')
  if (input.restoreLastLayout !== undefined) next.restoreLastLayout = requireBoolean(input.restoreLastLayout, 'Restore last layout')
  if (input.defaultBoardView !== undefined) next.defaultBoardView = requireBoardViewMode(input.defaultBoardView, 'Default board view')
  if (input.defaultSceneDensity !== undefined) next.defaultSceneDensity = requireSceneDensity(input.defaultSceneDensity, 'Default scene density')
  if (input.defaultDetachedWorkspace !== undefined) {
    next.defaultDetachedWorkspace = requireWindowWorkspace(input.defaultDetachedWorkspace, 'Default detached workspace')
  }
  if (input.lastProjectPath !== undefined) next.lastProjectPath = nullableString(input.lastProjectPath, 'Last project path') ?? null
  if (input.lastLayoutByProject !== undefined) next.lastLayoutByProject = requireStringMap(input.lastLayoutByProject, 'Last layout map')
  if (input.savedLayouts !== undefined) next.savedLayouts = requireSavedLayouts(input.savedLayouts)

  return next
}

export function parseConsultantChatInput(value: unknown): ConsultantChatInput {
  const input = requireObject(value, 'Consultant chat input')
  if (!Array.isArray(input.messages)) {
    throw new Error('Consultant messages must be an array')
  }

  return {
    messages: input.messages.map((message, index) => {
      const next = requireObject(message, `Consultant message ${index + 1}`)
      const role = next.role
      const content = next.content
      if (role !== 'system' && role !== 'user' && role !== 'assistant') {
        throw new Error(`Consultant message ${index + 1} has an invalid role`)
      }
      if (typeof content !== 'string') {
        throw new Error(`Consultant message ${index + 1} must have string content`)
      }

      return { role, content }
    }),
    activeBoardId: input.activeBoardId === undefined ? undefined : nullableString(input.activeBoardId, 'Active board id') ?? null,
    contextMode:
      input.contextMode === undefined
        ? undefined
        : requireEnum(input.contextMode, new Set(['none', 'active-board'] as const), 'Consultant context mode'),
  }
}

export function parseWindowWorkspace(value: unknown) {
  return requireWindowWorkspace(value, 'Window workspace')
}

export function parseWindowContextUpdate(
  value: unknown,
): Partial<Pick<WindowContext, 'boardId' | 'viewMode' | 'sceneDensity'>> {
  const input = requireObject(value, 'Window context update')
  const next: Partial<Pick<WindowContext, 'boardId' | 'viewMode' | 'sceneDensity'>> = {}

  if (input.boardId !== undefined) next.boardId = nullableString(input.boardId, 'Window board id') ?? null
  if (input.viewMode !== undefined) next.viewMode = requireBoardViewMode(input.viewMode, 'Window board view')
  if (input.sceneDensity !== undefined) next.sceneDensity = requireSceneDensity(input.sceneDensity, 'Scene density')
  return next
}

export function parseBlockTemplateInput(value: unknown) {
  const input = requireObject(value, 'Block template input')
  return {
    kind: requireBoardTextKind(input.kind, 'Block template kind'),
    name: requireString(input.name, 'Block template name'),
    title: typeof input.title === 'string' ? input.title : '',
    body: typeof input.body === 'string' ? input.body : '',
  } satisfies { kind: Exclude<BoardItemKind, 'scene'>; name: string; title: string; body: string }
}

export function parseTagUpsertInput(value: unknown) {
  const input = requireObject(value, 'Tag input')
  return {
    id: input.id === undefined ? undefined : optionalString(input.id, 'Tag id'),
    name: requireString(input.name, 'Tag name'),
    type: input.type === undefined ? undefined : requireEnum(input.type, tagTypes, 'Tag type'),
  }
}

export function parseBoardTextKind(value: unknown) {
  return requireBoardTextKind(value, 'Board block kind')
}

export function parseFolderUpdateInput(value: unknown) {
  const input = requireObject(value, 'Folder update')
  return {
    name: input.name === undefined ? undefined : optionalString(input.name, 'Folder name'),
    color: input.color === undefined ? undefined : requireSceneColor(input.color, 'Folder color'),
    parentPath:
      input.parentPath === undefined ? undefined : nullableString(input.parentPath, 'Parent folder path') ?? null,
  }
}

export function parseBoardPosition(value: unknown) {
  if (value === undefined || value === null) {
    return null
  }

  const input = requireObject(value, 'Board position')
  return {
    x: requireFiniteNumber(input.x, 'Board position X'),
    y: requireFiniteNumber(input.y, 'Board position Y'),
  }
}

function requireObject(value: unknown, label: string): AnyRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }

  return value as AnyRecord
}

function requireFiniteNumber(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`)
  }

  return value
}

function requireBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean`)
  }

  return value
}

function requireSceneColor(value: unknown, label: string) {
  return requireEnum(value, sceneColors, label)
}

function requireSceneStatus(value: unknown, label: string) {
  return requireEnum(value, sceneStatuses, label)
}

function requireBoardTextKind(value: unknown, label: string) {
  return requireEnum(value, boardTextKinds, label)
}

function requireBoardViewMode(value: unknown, label: string) {
  return requireEnum(value, boardViews, label)
}

function requireSceneDensity(value: unknown, label: string) {
  return requireEnum(value, sceneDensities, label)
}

function requireWindowWorkspace(value: unknown, label: string) {
  return requireEnum(value, windowWorkspaces, label)
}

function requireBoardTextKindArray(value: unknown, label: string) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`)
  }

  return value.map((entry) => requireBoardTextKind(entry, label))
}

function requireStringMap(value: unknown, label: string) {
  const input = requireObject(value, label)
  const result: Record<string, string> = {}
  Object.entries(input).forEach(([key, entryValue]) => {
    if (typeof entryValue !== 'string') {
      throw new Error(`${label} must only contain string values`)
    }
    result[key] = entryValue
  })
  return result
}

function requireSavedLayouts(value: unknown): SavedWindowLayout[] {
  if (!Array.isArray(value)) {
    throw new Error('Saved layouts must be an array')
  }

  return value.map((layout, index) => {
    const input = requireObject(layout, `Saved layout ${index + 1}`)
    const windowsValue = input.windows
    if (!Array.isArray(windowsValue)) {
      throw new Error(`Saved layout ${index + 1} must include windows`)
    }

    return {
      id: requireString(input.id, `Saved layout ${index + 1} id`),
      name: requireString(input.name, `Saved layout ${index + 1} name`),
      createdAt: requireString(input.createdAt, `Saved layout ${index + 1} createdAt`),
      updatedAt: requireString(input.updatedAt, `Saved layout ${index + 1} updatedAt`),
      windows: windowsValue.map((windowState, windowIndex) => {
        const record = requireObject(windowState, `Saved layout window ${windowIndex + 1}`)
        const bounds = requireObject(record.bounds, `Saved layout window ${windowIndex + 1} bounds`)
        return {
          id: requireString(record.id, `Saved layout window ${windowIndex + 1} id`),
          workspace: requireWindowWorkspace(record.workspace, `Saved layout window ${windowIndex + 1} workspace`),
          boardId: record.boardId === null ? null : optionalString(record.boardId, `Saved layout window ${windowIndex + 1} board id`) ?? null,
          viewMode: requireBoardViewMode(record.viewMode, `Saved layout window ${windowIndex + 1} view mode`),
          sceneDensity: requireSceneDensity(record.sceneDensity, `Saved layout window ${windowIndex + 1} scene density`),
          bounds: {
            x: requireFiniteNumber(bounds.x, `Saved layout window ${windowIndex + 1} bounds.x`),
            y: requireFiniteNumber(bounds.y, `Saved layout window ${windowIndex + 1} bounds.y`),
            width: requireFiniteNumber(bounds.width, `Saved layout window ${windowIndex + 1} bounds.width`),
            height: requireFiniteNumber(bounds.height, `Saved layout window ${windowIndex + 1} bounds.height`),
          },
          displayId:
            record.displayId === null || record.displayId === undefined
              ? null
              : requireFiniteNumber(record.displayId, `Saved layout window ${windowIndex + 1} display id`),
        }
      }),
    }
  })
}

function requireSceneKeyRating(value: unknown) {
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }
  if (value === null) {
    return 0
  }

  return requireFiniteNumber(value, 'Scene key rating')
}

function requireEnum<T extends string>(value: unknown, allowed: Set<T>, label: string): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new Error(`${label} is invalid`)
  }

  return value as T
}
