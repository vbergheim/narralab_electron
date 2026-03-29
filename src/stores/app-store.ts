import { create } from 'zustand'

import type { ArchiveFolder, ArchiveItem } from '@/types/archive'
import { defaultBoardCloneName } from '@/lib/constants'
import type {
  AppSettings,
  AppSettingsUpdateInput,
  ConsultantContextMode,
  ConsultantMessage,
} from '@/types/ai'
import type { AddSceneToBoardResult, BlockTemplate, Board, BoardDropPosition, BoardFolder, BoardItem, BoardTextItem, BoardTextItemKind, BoardUpdateInput } from '@/types/board'
import type {
  BoardScriptExportFormat,
  GlobalUiState,
  NotebookDocument,
  ProjectMeta,
  ProjectSettings,
  ProjectSettingsUpdateInput,
  ShootLogImportResult,
} from '@/types/project'
import type { Scene, SceneBeat, SceneBeatUpdateInput, SceneFolder, SceneUpdateInput } from '@/types/scene'
import type { Tag, TagType } from '@/types/tag'

type WorkspaceMode = 'outline' | 'bank' | 'notebook' | 'archive' | 'consultant' | 'settings'

type SceneDraftInput = Omit<Scene, 'tagIds' | 'createdAt' | 'updatedAt' | 'beats'> & {
  tagNames: string[]
}

type BoardItemDraftInput = {
  id: string
  kind?: BoardTextItem['kind']
  title?: string
  body?: string
  boardX?: number
  boardY?: number
  boardW?: number
  boardH?: number
}
type SceneBulkUpdateInput = {
  sceneIds: string[]
  category?: string
  status?: Scene['status']
  color?: Scene['color']
}

type AppStore = {
  ready: boolean
  busy: boolean
  consultantBusy: boolean
  error: string | null
  projectMeta: ProjectMeta | null
  projectSettings: ProjectSettings | null
  appSettings: AppSettings
  notebook: NotebookDocument
  archiveFolders: ArchiveFolder[]
  archiveItems: ArchiveItem[]
  scenes: Scene[]
  sceneFolders: SceneFolder[]
  boards: Board[]
  boardFolders: BoardFolder[]
  blockTemplates: BlockTemplate[]
  tags: Tag[]
  activeBoardId: string | null
  selectedBoardId: string | null
  selectedSceneId: string | null
  selectedSceneIds: string[]
  selectedBoardItemId: string | null
  selectedArchiveFolderId: string | null
  consultantMessages: ConsultantMessage[]
  consultantContextMode: ConsultantContextMode
  workspaceMode: WorkspaceMode
  updateAppSettings(input: AppSettingsUpdateInput): Promise<void>
  updateProjectSettings(input: ProjectSettingsUpdateInput): Promise<void>
  sendConsultantMessage(content: string): Promise<void>
  setConsultantContextMode(mode: ConsultantContextMode): void
  clearConsultantConversation(): void
  initialize(): Promise<void>
  refreshAll(): Promise<void>
  createArchiveFolder(name: string, parentId?: string | null): Promise<void>
  renameArchiveFolder(folderId: string, name: string): Promise<void>
  updateArchiveFolder(folderId: string, input: { name?: string; color?: ArchiveFolder['color'] }): Promise<void>
  deleteArchiveFolder(folderId: string): Promise<void>
  addArchiveFiles(filePaths?: string[] | null, folderId?: string | null): Promise<void>
  moveArchiveItem(itemId: string, folderId: string | null): Promise<void>
  deleteArchiveItem(itemId: string): Promise<void>
  openArchiveItem(itemId: string): Promise<void>
  revealArchiveItem(itemId: string): Promise<void>
  setSelectedArchiveFolder(folderId: string | null): void
  createProject(): Promise<void>
  openProject(): Promise<void>
  saveProjectAs(): Promise<void>
  importJson(): Promise<void>
  importShootLog(): Promise<void>
  exportJson(): Promise<void>
  exportActiveBoardScript(format: BoardScriptExportFormat): Promise<void>
  createScene(): Promise<void>
  createSceneBeat(sceneId: string, afterBeatId?: string | null): Promise<void>
  updateSceneBeat(input: SceneBeatUpdateInput): Promise<void>
  deleteSceneBeat(id: string): Promise<void>
  reorderSceneBeats(sceneId: string, beatIds: string[]): Promise<void>
  createSceneFolder(name: string, parentPath?: string | null): Promise<void>
  updateSceneFolder(currentPath: string, input: { name?: string; color?: SceneFolder['color']; parentPath?: string | null }): Promise<void>
  deleteSceneFolder(currentPath: string): Promise<void>
  moveScenesToFolder(sceneIds: string[], folder: string): Promise<void>
  reorderScenes(sceneIds: string[]): Promise<void>
  createBoard(name?: string, folder?: string | null): Promise<void>
  createBoardFolder(name: string, parentPath?: string | null): Promise<void>
  renameBoardFolder(oldPath: string, newName: string): Promise<void>
  updateBoardFolder(currentPath: string, input: { name?: string; color?: BoardFolder['color']; parentPath?: string | null }): Promise<void>
  deleteBoardFolder(currentPath: string): Promise<void>
  deleteBoard(boardId: string): Promise<void>
  deleteScene(sceneId: string): Promise<void>
  deleteScenes(sceneIds: string[]): Promise<void>
  persistSceneDraft(input: SceneDraftInput): Promise<void>
  bulkUpdateScenes(input: SceneBulkUpdateInput): Promise<void>
  persistBoardItemDraft(input: BoardItemDraftInput): Promise<void>
  updateNotebookDraft(content: string): void
  persistNotebook(content: string): Promise<void>
  duplicateScene(sceneId: string, options?: { addToBoardAfterItemId?: string | null }): Promise<void>
  openBoardInspector(boardId: string): void
  selectScene(sceneId: string | null, boardItemId?: string | null): void
  toggleSceneSelection(sceneId: string): void
  setSceneSelection(sceneIds: string[]): void
  clearSceneSelection(): void
  setWorkspaceMode(mode: WorkspaceMode): void
  setActiveBoard(boardId: string): void
  applyGlobalUiState(input: Partial<GlobalUiState>): void
  updateBoardDraft(input: BoardUpdateInput): Promise<void>
  reorderBoards(boardIds: string[]): Promise<void>
  cloneBoard(boardId: string): Promise<void>
  moveBoard(boardId: string, folder: string, beforeBoardId?: string | null): Promise<void>
  addSceneToBoard(boardId: string, sceneId: string, afterItemId?: string | null, boardPosition?: BoardDropPosition | null): Promise<AddSceneToBoardResult | null>
  addSceneToActiveBoard(sceneId: string, afterItemId?: string | null, boardPosition?: BoardDropPosition | null): Promise<AddSceneToBoardResult | null>
  addBlockToActiveBoard(kind: BoardTextItemKind, afterItemId?: string | null): Promise<void>
  addBlockTemplateToActiveBoard(templateId: string, afterItemId?: string | null): Promise<void>
  saveBlockTemplate(input: { kind: BoardTextItemKind; name: string; title: string; body: string }): Promise<void>
  deleteBlockTemplate(templateId: string): Promise<void>
  copyBlockToBoard(itemId: string, boardId: string): Promise<void>
  duplicateBoardItem(itemId: string): Promise<void>
  removeBoardItem(itemId: string): Promise<void>
  reorderActiveBoard(itemIds: string[]): Promise<void>
  cloneActiveBoard(): Promise<void>
  dismissError(): void
}

export const useAppStore = create<AppStore>((set, get) => ({
  ready: false,
  busy: false,
  consultantBusy: false,
  error: null,
  projectMeta: null,
  projectSettings: null,
  appSettings: {
    ai: {
      provider: 'openai',
      openAiModel: 'gpt-5-mini',
      geminiModel: 'gemini-2.5-flash',
      systemPrompt:
        'Du er en skarp, erfaren dokumentarkonsulent. Gi konkrete, redaksjonelle forslag til struktur, dramaturgi, scenevalg, voiceover, tematiske linjer og hva som mangler. Vær presis og arbeidsnær, ikke vag.',
      extraInstructions: '',
      responseStyle: 'structured',
      secretStorageMode: 'safe',
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
  },
  notebook: { content: '', updatedAt: null },
  archiveFolders: [],
  archiveItems: [],
  scenes: [],
  sceneFolders: [],
  boards: [],
  boardFolders: [],
  blockTemplates: [],
  tags: [],
  activeBoardId: null,
  selectedBoardId: null,
  selectedSceneId: null,
  selectedSceneIds: [],
  selectedBoardItemId: null,
  selectedArchiveFolderId: null,
  consultantMessages: [],
  consultantContextMode: 'none',
  workspaceMode: 'outline',

  async initialize() {
    try {
      const [meta, appSettings, globalUiState] = await Promise.all([
        window.narralab.project.getMeta(),
        window.narralab.settings.get(),
        window.narralab.windows.getGlobalUiState(),
      ])
      set({ ready: true, projectMeta: meta, appSettings })
      get().applyGlobalUiState(globalUiState)
      if (meta) {
        await get().refreshAll()
      }
    } catch (error) {
      set({ ready: true, error: toMessage(error) })
    }
  },

  async refreshAll() {
    const meta = await window.narralab.project.getMeta()
    if (!meta) {
      set({
        projectMeta: null,
        projectSettings: null,
        notebook: { content: '', updatedAt: null },
        archiveFolders: [],
        archiveItems: [],
        scenes: [],
        sceneFolders: [],
        boards: [],
        boardFolders: [],
        blockTemplates: [],
        tags: [],
        activeBoardId: null,
      })
      return
    }

    const [projectSettings, notebook, archiveFolders, archiveItems, scenes, sceneFolders, boards, boardFolders, blockTemplates, tags] = await Promise.all([
      window.narralab.project.getSettings(),
      window.narralab.notebook.get(),
      window.narralab.archive.folders.list(),
      window.narralab.archive.items.list(),
      window.narralab.scenes.list(),
      window.narralab.sceneFolders.list(),
      window.narralab.boards.list(),
      window.narralab.boardFolders.list(),
      window.narralab.blockTemplates.list(),
      window.narralab.tags.list(),
    ])

    set((state) => ({
      projectMeta: meta,
      projectSettings,
      notebook,
      archiveFolders,
      archiveItems,
      scenes,
      sceneFolders,
      boards,
      boardFolders,
      blockTemplates,
      tags,
      consultantMessages: state.projectMeta?.path === meta.path ? state.consultantMessages : [],
      activeBoardId:
        state.activeBoardId && boards.some((board) => board.id === state.activeBoardId)
          ? state.activeBoardId
          : boards[0]?.id ?? null,
      selectedBoardId:
        state.selectedBoardId && boards.some((board) => board.id === state.selectedBoardId)
          ? state.selectedBoardId
          : null,
      selectedArchiveFolderId:
        state.selectedArchiveFolderId &&
        archiveFolders.some((folder) => folder.id === state.selectedArchiveFolderId)
          ? state.selectedArchiveFolderId
          : null,
    }))
  },

  async createArchiveFolder(name, parentId = null) {
    await runProjectAction(set, async () => {
      const archiveFolders = await window.narralab.archive.folders.create(name, parentId)
      set({ archiveFolders })
    })
  },

  async renameArchiveFolder(folderId, name) {
    await runProjectAction(set, async () => {
      const archiveFolders = await window.narralab.archive.folders.rename(folderId, name)
      set({ archiveFolders })
    })
  },

  async updateArchiveFolder(folderId, input) {
    await runProjectAction(set, async () => {
      const archiveFolders = await window.narralab.archive.folders.update({ id: folderId, ...input })
      set({ archiveFolders })
    })
  },

  async deleteArchiveFolder(folderId) {
    await runProjectAction(set, async () => {
      const archiveFolders = await window.narralab.archive.folders.delete(folderId)
      const archiveItems = await window.narralab.archive.items.list()
      set((state) => ({
        archiveFolders,
        archiveItems,
        selectedArchiveFolderId: state.selectedArchiveFolderId === folderId ? null : state.selectedArchiveFolderId,
      }))
    })
  },

  async addArchiveFiles(filePaths, folderId = null) {
    await runProjectAction(set, async () => {
      const added = await window.narralab.archive.items.add(filePaths, folderId)
      if (added.length === 0) return
      const archiveItems = await window.narralab.archive.items.list()
      set((state) => ({
        archiveItems,
        selectedArchiveFolderId: folderId ?? state.selectedArchiveFolderId,
      }))
    })
  },

  async moveArchiveItem(itemId, folderId) {
    await runProjectAction(set, async () => {
      await window.narralab.archive.items.update({ id: itemId, folderId })
      const archiveItems = await window.narralab.archive.items.list()
      set({ archiveItems })
    })
  },

  async deleteArchiveItem(itemId) {
    await runProjectAction(set, async () => {
      await window.narralab.archive.items.delete(itemId)
      set((state) => ({
        archiveItems: state.archiveItems.filter((item) => item.id !== itemId),
      }))
    })
  },

  async openArchiveItem(itemId) {
    try {
      await window.narralab.archive.items.open(itemId)
    } catch (error) {
      set({ error: toMessage(error) })
    }
  },

  async revealArchiveItem(itemId) {
    try {
      await window.narralab.archive.items.reveal(itemId)
    } catch (error) {
      set({ error: toMessage(error) })
    }
  },

  setSelectedArchiveFolder(folderId) {
    set({ selectedArchiveFolderId: folderId })
    void window.narralab.windows.updateGlobalUiState({ selectedArchiveFolderId: folderId })
  },

  async createProject() {
    await runProjectAction(set, async () => {
      const meta = await window.narralab.project.create()
      if (meta) {
        await get().refreshAll()
        set({ consultantMessages: [] })
      }
    })
  },

  async openProject() {
    await runProjectAction(set, async () => {
      const meta = await window.narralab.project.open()
      if (meta) {
        await get().refreshAll()
        set({ consultantMessages: [] })
      }
    })
  },

  async saveProjectAs() {
    await runProjectAction(set, async () => {
      const meta = await window.narralab.project.saveAs()
      if (meta) await get().refreshAll()
    })
  },

  async importJson() {
    await runProjectAction(set, async () => {
      const meta = await window.narralab.project.importJson()
      if (meta) {
        await get().refreshAll()
        set({ consultantMessages: [] })
      }
    })
  },

  async importShootLog() {
    await runProjectAction(set, async () => {
      const result = await window.narralab.project.importShootLog()
      if (!result) return

      if (result.errors.length > 0) {
        throw new Error(formatShootLogImportErrors(result))
      }

      if (result.addedSceneCount > 0 || result.addedBeatCount > 0) {
        await get().refreshAll()
      }
    })
  },

  async updateAppSettings(input) {
    await runProjectAction(set, async () => {
      const appSettings = await window.narralab.settings.update(input)
      set({ appSettings })
    })
  },

  async updateProjectSettings(input) {
    await runProjectAction(set, async () => {
      const projectSettings = await window.narralab.project.updateSettings(input)
      set({ projectSettings })
    })
  },

  async sendConsultantMessage(content) {
    const message = content.trim()
    if (!message) return

    const optimisticUserMessage: ConsultantMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    }

    set((state) => ({
      consultantBusy: true,
      consultantMessages: [...state.consultantMessages, optimisticUserMessage],
    }))

    try {
      const conversation = [...get().consultantMessages].slice(-8)
      const result = await window.narralab.consultant.chat({
        activeBoardId: get().activeBoardId,
        contextMode: get().consultantContextMode,
        messages: conversation.map((entry) => ({
          role: entry.role,
          content: entry.content,
        })),
      })

      const reply: ConsultantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.message,
        createdAt: new Date().toISOString(),
      }

      set((state) => ({
        consultantBusy: false,
        consultantMessages: [...state.consultantMessages, reply],
      }))
    } catch (error) {
      const reply: ConsultantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: toMessage(error),
        createdAt: new Date().toISOString(),
        error: true,
      }

      set((state) => ({
        consultantBusy: false,
        error: toMessage(error),
        consultantMessages: [...state.consultantMessages, reply],
      }))
    }
  },

  setConsultantContextMode(mode) {
    set({ consultantContextMode: mode })
  },

  clearConsultantConversation() {
    set({ consultantMessages: [] })
  },

  async exportJson() {
    await runProjectAction(set, async () => {
      await window.narralab.project.exportJson()
    })
  },

  async exportActiveBoardScript(format) {
    await runProjectAction(set, async () => {
      const activeBoardId = get().activeBoardId
      if (!activeBoardId) {
        throw new Error('Select a board before exporting a script')
      }
      await window.narralab.project.exportBoardScript(activeBoardId, null, format)
    })
  },

  async createScene() {
    await runProjectAction(set, async () => {
      const scene = await window.narralab.scenes.create()
      set((state) => ({
        scenes: [scene, ...state.scenes],
        selectedSceneId: scene.id,
        selectedSceneIds: [scene.id],
        selectedBoardItemId: null,
      }))
    })
  },

  async createSceneBeat(sceneId, afterBeatId = null) {
    await runProjectAction(set, async () => {
      const beat = await window.narralab.sceneBeats.create(sceneId, afterBeatId)
      set((state) => ({
        scenes: state.scenes.map((scene) =>
          scene.id === sceneId
            ? {
                ...scene,
                beats: sortBeats([...(scene.beats ?? []), beat]),
              }
            : scene,
        ),
      }))
    })
  },

  async updateSceneBeat(input) {
    await runProjectAction(set, async () => {
      const beat = await window.narralab.sceneBeats.update(input)
      set((state) => ({
        scenes: state.scenes.map((scene) =>
          scene.id === beat.sceneId
            ? {
                ...scene,
                beats: sortBeats((scene.beats ?? []).map((entry) => (entry.id === beat.id ? beat : entry))),
              }
            : scene,
        ),
      }))
    })
  },

  async deleteSceneBeat(id) {
    await runProjectAction(set, async () => {
      await window.narralab.sceneBeats.delete(id)
      set((state) => ({
        scenes: state.scenes.map((scene) => ({
          ...scene,
          beats: (scene.beats ?? []).filter((beat) => beat.id !== id),
        })),
      }))
    })
  },

  async reorderSceneBeats(sceneId, beatIds) {
    await runProjectAction(set, async () => {
      const beats = await window.narralab.sceneBeats.reorder(sceneId, beatIds)
      set((state) => ({
        scenes: state.scenes.map((scene) =>
          scene.id === sceneId
            ? {
                ...scene,
                beats,
              }
            : scene,
        ),
      }))
    })
  },

  async createSceneFolder(name, parentPath = null) {
    await runProjectAction(set, async () => {
      const sceneFolders = await window.narralab.sceneFolders.create(name, parentPath)
      set({ sceneFolders })
    })
  },

  async updateSceneFolder(currentPath, input) {
    await runProjectAction(set, async () => {
      const sceneFolders = await window.narralab.sceneFolders.update(currentPath, input)
      const scenes =
        input.name !== undefined || input.parentPath !== undefined
          ? await window.narralab.scenes.list()
          : get().scenes
      set({ sceneFolders, scenes })
    })
  },

  async deleteSceneFolder(currentPath) {
    await runProjectAction(set, async () => {
      const [sceneFolders, scenes] = await Promise.all([
        window.narralab.sceneFolders.delete(currentPath),
        window.narralab.scenes.list(),
      ])
      set({ sceneFolders, scenes })
    })
  },

  async moveScenesToFolder(sceneIds, folder) {
    await runProjectAction(set, async () => {
      const uniqueSceneIds = [...new Set(sceneIds.filter(Boolean))]
      if (uniqueSceneIds.length === 0) return

      const updatedScenes = await Promise.all(
        uniqueSceneIds.map((sceneId) =>
          window.narralab.scenes.update({ id: sceneId, folder } satisfies SceneUpdateInput),
        ),
      )
      const updatesById = new Map(updatedScenes.map((scene) => [scene.id, scene]))
      set((state) => ({
        scenes: state.scenes.map((scene) => updatesById.get(scene.id) ?? scene),
      }))
    })
  },

  async reorderScenes(sceneIds) {
    await runProjectAction(set, async () => {
      const scenes = await window.narralab.scenes.reorder(sceneIds)
      set({ scenes })
    })
  },

  async createBoard(name, folder = null) {
    await runProjectAction(set, async () => {
      const board = await window.narralab.boards.create(name?.trim() || 'New Board', folder)
      const boardFolders = await window.narralab.boardFolders.list()
      set((state) => ({
        boards: [...state.boards, board],
        boardFolders,
        activeBoardId: board.id,
        selectedBoardId: board.id,
        selectedSceneId: null,
        selectedSceneIds: [],
        selectedBoardItemId: null,
      }))
      void window.narralab.windows.updateGlobalUiState({
        activeBoardId: board.id,
        selectedBoardId: board.id,
        selectedSceneId: null,
        selectedSceneIds: [],
        selectedBoardItemId: null,
      })
    })
  },

  async createBoardFolder(name, parentPath = null) {
    await runProjectAction(set, async () => {
      const boardFolders = await window.narralab.boardFolders.create(name, parentPath)
      set({ boardFolders })
    })
  },

  async renameBoardFolder(oldPath, newName) {
    await runProjectAction(set, async () => {
      const boardFolders = await window.narralab.boardFolders.rename(oldPath, newName)
      const boards = await window.narralab.boards.list()
      set({ boardFolders, boards })
    })
  },

  async updateBoardFolder(currentPath, input) {
    await runProjectAction(set, async () => {
      const boardFolders = await window.narralab.boardFolders.update(currentPath, input)
      const boards =
        input.name !== undefined || input.parentPath !== undefined
          ? await window.narralab.boards.list()
          : get().boards
      set({ boardFolders, boards })
    })
  },

  async deleteBoardFolder(currentPath) {
    await runProjectAction(set, async () => {
      const [boardFolders, boards] = await Promise.all([
        window.narralab.boardFolders.delete(currentPath),
        window.narralab.boards.list(),
      ])
      set({ boardFolders, boards })
    })
  },

  async deleteBoard(boardId) {
    await runProjectAction(set, async () => {
      const boards = await window.narralab.boards.delete(boardId)
      const boardFolders = await window.narralab.boardFolders.list()
      const nextActiveBoardId =
        get().activeBoardId === boardId
          ? boards[0]?.id ?? null
          : get().activeBoardId && boards.some((board) => board.id === get().activeBoardId)
            ? get().activeBoardId
            : boards[0]?.id ?? null
      set((state) => ({
        boards,
        boardFolders,
        activeBoardId: nextActiveBoardId,
        selectedBoardId: state.selectedBoardId === boardId ? null : state.selectedBoardId,
      }))
      void window.narralab.windows.updateGlobalUiState({
        activeBoardId: nextActiveBoardId,
        selectedBoardId: get().selectedBoardId === boardId ? null : get().selectedBoardId,
      })
    })
  },

  async deleteScene(sceneId) {
    await runProjectAction(set, async () => {
      await window.narralab.scenes.delete(sceneId)
      set((state) => ({
        scenes: state.scenes.filter((scene) => scene.id !== sceneId),
        boards: state.boards.map((board) => ({
          ...board,
          items: board.items.filter((item) => !(item.kind === 'scene' && item.sceneId === sceneId)),
        })),
        selectedSceneIds: state.selectedSceneIds.filter((id) => id !== sceneId),
        selectedSceneId: state.selectedSceneId === sceneId ? null : state.selectedSceneId,
        selectedBoardItemId: state.selectedSceneId === sceneId ? null : state.selectedBoardItemId,
      }))
    })
  },

  async deleteScenes(sceneIds) {
    await runProjectAction(set, async () => {
      const uniqueSceneIds = [...new Set(sceneIds.filter(Boolean))]
      if (uniqueSceneIds.length === 0) return

      await Promise.all(uniqueSceneIds.map((sceneId) => window.narralab.scenes.delete(sceneId)))
      const deletedSceneIdSet = new Set(uniqueSceneIds)

      set((state) => ({
        scenes: state.scenes.filter((scene) => !deletedSceneIdSet.has(scene.id)),
        boards: state.boards.map((board) => ({
          ...board,
          items: board.items.filter((item) => !(item.kind === 'scene' && deletedSceneIdSet.has(item.sceneId))),
        })),
        selectedSceneIds: state.selectedSceneIds.filter((id) => !deletedSceneIdSet.has(id)),
        selectedSceneId:
          state.selectedSceneId && deletedSceneIdSet.has(state.selectedSceneId) ? null : state.selectedSceneId,
        selectedBoardItemId:
          state.selectedBoardItemId &&
          state.boards.some((board) =>
            board.items.some(
              (item) => item.id === state.selectedBoardItemId && item.kind === 'scene' && deletedSceneIdSet.has(item.sceneId),
            ),
          )
            ? null
            : state.selectedBoardItemId,
      }))
    })
  },

  async persistSceneDraft(input) {
    await runProjectAction(set, async () => {
      const tags = get().tags
      const tagIds: string[] = []

      for (const rawName of input.tagNames) {
        const name = rawName.trim()
        if (!name) continue
        const existing = tags.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
        const tag = existing ?? (await window.narralab.tags.upsert({ name, type: inferTagType(name) }))
        if (!existing) {
          set((state) => ({ tags: [...state.tags, tag].sort((a, b) => a.name.localeCompare(b.name)) }))
        }
        tagIds.push(tag.id)
      }

      const updated = await window.narralab.scenes.update({
        id: input.id,
        title: input.title,
        synopsis: input.synopsis,
        notes: input.notes,
        color: input.color,
        status: input.status,
        keyRating: input.keyRating,
        category: input.category,
        estimatedDuration: input.estimatedDuration,
        actualDuration: input.actualDuration,
        location: input.location,
        characters: input.characters,
        function: input.function,
        sourceReference: input.sourceReference,
        tagIds,
      } satisfies SceneUpdateInput)

      set((state) => ({
        scenes: state.scenes.map((scene) => (scene.id === updated.id ? updated : scene)),
      }))
    })
  },

  async bulkUpdateScenes(input) {
    await runProjectAction(set, async () => {
      const currentScenes = get().scenes.filter((scene) => input.sceneIds.includes(scene.id))

      const updates = await Promise.all(
        currentScenes.map((scene) =>
          window.narralab.scenes.update({
            id: scene.id,
            category: input.category ?? scene.category,
            status: input.status ?? scene.status,
            color: input.color ?? scene.color,
          } satisfies SceneUpdateInput),
        ),
      )

      set((state) => ({
        scenes: state.scenes.map((scene) => updates.find((entry) => entry.id === scene.id) ?? scene),
      }))
    })
  },

  async persistBoardItemDraft(input) {
    await runProjectAction(set, async () => {
      const updated = await window.narralab.boards.updateItem(input)

      set((state) => ({
        boards: state.boards.map((board) => ({
          ...board,
          items: board.items.map((item) => (item.id === updated.id ? updated : item)),
        })),
      }))
    })
  },

  updateNotebookDraft(content) {
    set((state) => ({
      notebook: {
        ...state.notebook,
        content,
      },
    }))
  },

  async persistNotebook(content) {
    try {
      const notebook = await window.narralab.notebook.update(content)
      set({ notebook })
    } catch (error) {
      set({ error: toMessage(error) })
    }
  },

  async duplicateScene(sceneId, options) {
    const source = get().scenes.find((scene) => scene.id === sceneId)
    if (!source) return

    await runProjectAction(set, async () => {
      const created = await window.narralab.scenes.create()
      const duplicated = await window.narralab.scenes.update({
        id: created.id,
        title: source.title ? `${source.title} Copy` : 'Untitled Scene Copy',
        synopsis: source.synopsis,
        notes: source.notes,
        color: source.color,
        status: source.status,
        keyRating: source.keyRating,
        category: source.category,
        estimatedDuration: source.estimatedDuration,
        actualDuration: source.actualDuration,
        location: source.location,
        characters: source.characters,
        function: source.function,
        sourceReference: source.sourceReference,
        tagIds: source.tagIds,
      } satisfies SceneUpdateInput)

      let duplicatedWithBeats = duplicated
      for (const sourceBeat of source.beats) {
        const createdBeat = await window.narralab.sceneBeats.create(duplicated.id, duplicatedWithBeats.beats.at(-1)?.id ?? null)
        const updatedBeat = await window.narralab.sceneBeats.update({
          id: createdBeat.id,
          text: sourceBeat.text,
        })
        duplicatedWithBeats = {
          ...duplicatedWithBeats,
          beats: [...duplicatedWithBeats.beats, updatedBeat],
        }
      }

      set((state) => ({
        scenes: [duplicatedWithBeats, ...state.scenes],
        selectedBoardId: null,
        selectedSceneId: duplicatedWithBeats.id,
        selectedSceneIds: [duplicatedWithBeats.id],
        selectedBoardItemId: null,
      }))

      if (options?.addToBoardAfterItemId !== undefined) {
        await get().addSceneToActiveBoard(duplicatedWithBeats.id, options.addToBoardAfterItemId ?? null)
      }
    })
  },

  openBoardInspector(boardId) {
    set({
      activeBoardId: boardId,
      selectedBoardId: boardId,
      selectedSceneId: null,
      selectedSceneIds: [],
      selectedBoardItemId: null,
    })
    void window.narralab.windows.updateGlobalUiState({
      activeBoardId: boardId,
      selectedBoardId: boardId,
      selectedSceneId: null,
      selectedSceneIds: [],
      selectedBoardItemId: null,
    })
  },

  selectScene(sceneId, boardItemId = null) {
    set({
      selectedBoardId: null,
      selectedSceneId: sceneId,
      selectedSceneIds: sceneId ? [sceneId] : [],
      selectedBoardItemId: boardItemId,
    })
    void window.narralab.windows.updateGlobalUiState({
      selectedBoardId: null,
      selectedSceneId: sceneId,
      selectedSceneIds: sceneId ? [sceneId] : [],
      selectedBoardItemId: boardItemId,
    })
  },

  toggleSceneSelection(sceneId) {
    set((state) => {
      const exists = state.selectedSceneIds.includes(sceneId)
      const selectedSceneIds = exists
        ? state.selectedSceneIds.filter((id) => id !== sceneId)
        : [...state.selectedSceneIds, sceneId]

      return {
        selectedBoardId: null,
        selectedSceneIds,
        selectedSceneId: selectedSceneIds[0] ?? null,
        selectedBoardItemId: null,
      }
    })
    const state = get()
    void window.narralab.windows.updateGlobalUiState({
      selectedBoardId: null,
      selectedSceneId: state.selectedSceneId,
      selectedSceneIds: state.selectedSceneIds,
      selectedBoardItemId: null,
    })
  },

  setSceneSelection(sceneIds) {
    set({
      selectedBoardId: null,
      selectedSceneIds: sceneIds,
      selectedSceneId: sceneIds[0] ?? null,
      selectedBoardItemId: null,
    })
    void window.narralab.windows.updateGlobalUiState({
      selectedBoardId: null,
      selectedSceneId: sceneIds[0] ?? null,
      selectedSceneIds: sceneIds,
      selectedBoardItemId: null,
    })
  },

  clearSceneSelection() {
    set({
      selectedBoardId: null,
      selectedSceneIds: [],
      selectedSceneId: null,
    })
    void window.narralab.windows.updateGlobalUiState({
      selectedBoardId: null,
      selectedSceneIds: [],
      selectedSceneId: null,
      selectedBoardItemId: null,
    })
  },

  setWorkspaceMode(workspaceMode) {
    set({ workspaceMode })
  },

  setActiveBoard(activeBoardId) {
    set({ activeBoardId, selectedBoardId: null })
    void window.narralab.windows.updateGlobalUiState({
      activeBoardId,
      selectedBoardId: null,
    })
  },

  applyGlobalUiState(input) {
    set((state) => ({
      activeBoardId: input.activeBoardId ?? state.activeBoardId,
      selectedBoardId: input.selectedBoardId ?? state.selectedBoardId,
      selectedSceneId: input.selectedSceneId ?? state.selectedSceneId,
      selectedSceneIds: input.selectedSceneIds ?? state.selectedSceneIds,
      selectedBoardItemId: input.selectedBoardItemId ?? state.selectedBoardItemId,
      selectedArchiveFolderId: input.selectedArchiveFolderId ?? state.selectedArchiveFolderId,
    }))
  },

  async updateBoardDraft(input) {
    await runProjectAction(set, async () => {
      const [board, boardFolders] = await Promise.all([
        window.narralab.boards.updateBoard(input),
        input.folder !== undefined ? window.narralab.boardFolders.list() : Promise.resolve(get().boardFolders),
      ])
      set((state) => ({
        boards: state.boards.map((entry) => (entry.id === board.id ? board : entry)),
        boardFolders,
        activeBoardId: state.activeBoardId === board.id ? board.id : state.activeBoardId,
        selectedBoardId: state.selectedBoardId === board.id ? board.id : state.selectedBoardId,
      }))
    })
  },

  async reorderBoards(boardIds) {
    await runProjectAction(set, async () => {
      const boards = await window.narralab.boards.reorderBoards(boardIds)
      set({ boards })
    })
  },

  async moveBoard(boardId, folder, beforeBoardId = null) {
    await runProjectAction(set, async () => {
      const currentBoards = get().boards
      const currentFolders = get().boardFolders
      const currentBoard = currentBoards.find((board) => board.id === boardId)
      if (!currentBoard) return

      const nextFolder = folder.trim()
      const updatedBoard =
        currentBoard.folder === nextFolder
          ? currentBoard
          : await window.narralab.boards.updateBoard({ id: boardId, folder: nextFolder })

      const boardsAfterMove = currentBoards.map((board) => (board.id === boardId ? updatedBoard : board))
      const orderIds = buildBoardOrderAfterMove(boardsAfterMove, currentFolders, boardId, nextFolder, beforeBoardId)
      const [boards, boardFolders] = await Promise.all([
        window.narralab.boards.reorderBoards(orderIds),
        window.narralab.boardFolders.list(),
      ])

      set({ boards, boardFolders })
    })
  },

  async cloneBoard(boardId) {
    await runProjectAction(set, async () => {
      const board = await window.narralab.boards.createClone(boardId, defaultBoardCloneName)
      set((state) => ({
        boards: [...state.boards, board],
        activeBoardId: board.id,
        selectedBoardId: null,
      }))
    })
  },

  async addSceneToBoard(boardId, sceneId, afterItemId = null, boardPosition = null) {
    const targetBoardId = boardId?.trim()
    if (!targetBoardId) return null

    let result: AddSceneToBoardResult | null = null

    await runProjectAction(set, async () => {
      result = await window.narralab.boards.addScene(targetBoardId, sceneId, afterItemId, boardPosition)
      set((state) => ({
        boards: state.boards.map((board) =>
          board.id === targetBoardId && result
            ? {
                ...board,
                items: result.existed
                  ? board.items
                  : [...board.items, result.item]
                      .sort((left, right) => left.position - right.position)
                      .map((entry, index) => ({ ...entry, position: index }) as BoardItem),
              }
            : board,
        ),
        selectedBoardId: null,
        selectedSceneId: sceneId,
        selectedSceneIds: [sceneId],
        selectedBoardItemId: result?.item.id ?? null,
      }))
    })

    return result
  },

  async addSceneToActiveBoard(sceneId, afterItemId = null, boardPosition = null) {
    const activeBoardId = get().activeBoardId
    if (!activeBoardId) return null
    return get().addSceneToBoard(activeBoardId, sceneId, afterItemId, boardPosition)
  },

  async addBlockToActiveBoard(kind, afterItemId = null) {
    const activeBoardId = get().activeBoardId
    if (!activeBoardId) return

    await runProjectAction(set, async () => {
      const item = await window.narralab.boards.addBlock(activeBoardId, kind, afterItemId)
      set((state) => ({
        boards: state.boards.map((board) =>
          board.id === activeBoardId
            ? {
                ...board,
                items: [...board.items, item]
                  .sort((left, right) => left.position - right.position)
                  .map((entry, index) => ({ ...entry, position: index }) as BoardItem),
              }
            : board,
        ),
        selectedBoardId: null,
        selectedSceneId: null,
        selectedBoardItemId: item.id,
      }))
    })
  },

  async addBlockTemplateToActiveBoard(templateId, afterItemId = null) {
    const activeBoardId = get().activeBoardId
    if (!activeBoardId) return

    await runProjectAction(set, async () => {
      const template = get().blockTemplates.find((entry) => entry.id === templateId)
      if (!template) {
        throw new Error('Template not found')
      }

      const created = await window.narralab.boards.addBlock(activeBoardId, template.kind, afterItemId)
      const item = await window.narralab.boards.updateItem({
        id: created.id,
        kind: template.kind,
        title: template.title,
        body: template.body,
      })

      set((state) => ({
        boards: state.boards.map((board) =>
          board.id === activeBoardId
            ? {
                ...board,
                items: [...board.items.filter((entry) => entry.id !== created.id), item]
                  .sort((left, right) => left.position - right.position)
                  .map((entry, index) => ({ ...entry, position: index }) as BoardItem),
              }
            : board,
        ),
        selectedBoardId: null,
        selectedSceneId: null,
        selectedBoardItemId: item.id,
      }))
    })
  },

  async saveBlockTemplate(input) {
    await runProjectAction(set, async () => {
      const blockTemplates = await window.narralab.blockTemplates.create(input)
      set({ blockTemplates })
    })
  },

  async deleteBlockTemplate(templateId) {
    await runProjectAction(set, async () => {
      const blockTemplates = await window.narralab.blockTemplates.delete(templateId)
      set({ blockTemplates })
    })
  },

  async copyBlockToBoard(itemId, boardId) {
    await runProjectAction(set, async () => {
      const sourceBoard = get().boards.find((board) => board.items.some((item) => item.id === itemId))
      const sourceItem = sourceBoard?.items.find((item) => item.id === itemId)
      if (!sourceItem || sourceItem.kind === 'scene') {
        throw new Error('Only structure blocks can be copied between boards')
      }

      const created = await window.narralab.boards.addBlock(boardId, sourceItem.kind, null)
      const copied = await window.narralab.boards.updateItem({
        id: created.id,
        kind: sourceItem.kind,
        title: sourceItem.title,
        body: sourceItem.body,
      })

      set((state) => ({
        boards: state.boards.map((board) =>
          board.id === boardId
            ? {
                ...board,
                items: [...board.items, copied]
                  .sort((left, right) => left.position - right.position)
                  .map((entry, index) => ({ ...entry, position: index }) as BoardItem),
              }
            : board,
        ),
      }))
    })
  },

  async duplicateBoardItem(itemId) {
    await runProjectAction(set, async () => {
      const item = await window.narralab.boards.duplicateItem(itemId)
      set((state) => ({
        boards: state.boards.map((board) =>
          board.id === item.boardId
            ? {
                ...board,
                items: [...board.items, item]
                  .sort((left, right) => left.position - right.position)
                  .map((entry, index) => ({ ...entry, position: index }) as BoardItem),
              }
            : board,
        ),
        selectedBoardId: null,
        selectedSceneId: null,
        selectedBoardItemId: item.id,
      }))
    })
  },

  async removeBoardItem(itemId) {
    await runProjectAction(set, async () => {
      await window.narralab.boards.removeItem(itemId)
      set((state) => ({
        boards: state.boards.map((board) => ({
          ...board,
          items: board.items
            .filter((item) => item.id !== itemId)
            .map((item, index) => ({ ...item, position: index } as BoardItem)),
        })),
        selectedBoardId: null,
        selectedBoardItemId: state.selectedBoardItemId === itemId ? null : state.selectedBoardItemId,
      }))
    })
  },

  async reorderActiveBoard(itemIds) {
    const activeBoardId = get().activeBoardId
    if (!activeBoardId) return

    await runProjectAction(set, async () => {
      const items = await window.narralab.boards.reorder(activeBoardId, itemIds)
      set((state) => ({
        boards: state.boards.map((board) =>
          board.id === activeBoardId
            ? {
                ...board,
                items,
              }
            : board,
        ),
      }))
    })
  },

  async cloneActiveBoard() {
    const activeBoardId = get().activeBoardId
    if (!activeBoardId) return

    await get().cloneBoard(activeBoardId)
  },

  dismissError() {
    set({ error: null })
  },
}))

function inferTagType(name: string): TagType {
  if (name.startsWith('@')) return 'character'
  if (name.startsWith('#')) return 'theme'
  if (name.startsWith('/')) return 'location'
  return 'general'
}

function buildBoardOrderAfterMove(
  boards: Board[],
  folders: BoardFolder[],
  boardId: string,
  targetFolder: string,
  beforeBoardId: string | null,
) {
  const movedBoard = boards.find((board) => board.id === boardId)
  if (!movedBoard) {
    return boards.map((board) => board.id)
  }

  const remaining = boards.filter((board) => board.id !== boardId)
  const folderOrder = [''].concat(folders.map((folder) => folder.name))
  const normalizedTargetFolder = targetFolder.trim()

  if (beforeBoardId) {
    const insertIndex = remaining.findIndex((board) => board.id === beforeBoardId)
    if (insertIndex >= 0) {
      const next = [...remaining]
      next.splice(insertIndex, 0, { ...movedBoard, folder: normalizedTargetFolder })
      return next.map((board) => board.id)
    }
  }

  const next = [...remaining]
  const targetFolderIndex = Math.max(0, folderOrder.findIndex((folderName) => folderName === normalizedTargetFolder))
  const lastIndexInTarget = findLastIndex(next, (board) => board.folder === normalizedTargetFolder)

  if (lastIndexInTarget >= 0) {
    next.splice(lastIndexInTarget + 1, 0, { ...movedBoard, folder: normalizedTargetFolder })
    return next.map((board) => board.id)
  }

  const nextFolderIndex = next.findIndex((board) => {
    const boardFolderIndex = Math.max(0, folderOrder.findIndex((folderName) => folderName === board.folder))
    return boardFolderIndex > targetFolderIndex
  })

  if (nextFolderIndex >= 0) {
    next.splice(nextFolderIndex, 0, { ...movedBoard, folder: normalizedTargetFolder })
  } else {
    next.push({ ...movedBoard, folder: normalizedTargetFolder })
  }

  return next.map((board) => board.id)
}

function findLastIndex<T>(items: T[], predicate: (item: T) => boolean) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) {
      return index
    }
  }
  return -1
}

function sortBeats(beats: SceneBeat[]) {
  return [...beats].sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt))
}

async function runProjectAction(
  set: (partial: Partial<AppStore> | ((state: AppStore) => Partial<AppStore>)) => void,
  action: () => Promise<void>,
) {
  set({ busy: true, error: null })

  try {
    await action()
  } catch (error) {
    set({ error: toMessage(error) })
  } finally {
    set({ busy: false })
  }
}

function toMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error'
}

function formatShootLogImportErrors(result: ShootLogImportResult) {
  const details = result.errors
    .slice(0, 6)
    .map((entry) => `${entry.sheet} row ${entry.row}: ${entry.message}`)
    .join('\n')
  const suffix = result.errors.length > 6 ? `\n...and ${result.errors.length - 6} more errors.` : ''

  return `Opptakslogg-import mislyktes.\n${details}${suffix}`
}
