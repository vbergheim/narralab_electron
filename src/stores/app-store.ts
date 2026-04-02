import { create } from 'zustand'

import { defaultBoardCloneName } from '@/lib/constants'
import { createArchiveActions } from '@/stores/app-store-archive-actions'
import { createConsultantActions } from '@/stores/app-store-consultant-actions'
import { createProjectActions } from '@/stores/app-store-project-actions'
import type { AppStore } from '@/stores/app-store-contract'
import { buildBoardOrderAfterMove, inferTagType, runProjectAction, sortBeats, toMessage } from '@/stores/app-store-utils'
import type { AddSceneToBoardResult, BoardItem } from '@/types/board'
import { emptyNotebookDocument } from '@/lib/notebook-document'
import type { SceneUpdateInput } from '@/types/scene'

export const useAppStore = create<AppStore>((set, get) => ({
  ready: false,
  busy: false,
  pendingProjectActionCount: 0,
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
      allowPlaintextSecrets: false,
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
      timestampInterval: 'segment',
    },
  },
  notebook: emptyNotebookDocument(),
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
  ...createArchiveActions(set),
  ...createConsultantActions(set, get),
  ...createProjectActions(set, get),

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
      void window.narralab.windows.updateGlobalUiState({ activeBoardId: board.id })
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
      void window.narralab.windows.updateGlobalUiState({ activeBoardId: nextActiveBoardId })
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
        quoteMoment: input.quoteMoment,
        quality: input.quality,
        sourcePaths: input.sourcePaths,
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

  updateNotebookDraft(notebook) {
    set({ notebook })
  },

  async persistNotebook(notebook) {
    try {
      const next = await window.narralab.notebook.update(notebook)
      set({ notebook: next })
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
        quoteMoment: source.quoteMoment,
        quality: source.quality,
        sourcePaths: source.sourcePaths,
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
    void window.narralab.windows.updateGlobalUiState({ activeBoardId: boardId })
  },

  selectScene(sceneId, boardItemId = null) {
    set({
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
  },

  setSceneSelection(sceneIds) {
    set({
      selectedBoardId: null,
      selectedSceneIds: sceneIds,
      selectedSceneId: sceneIds[0] ?? null,
      selectedBoardItemId: null,
    })
  },

  clearSceneSelection() {
    set({
      selectedBoardId: null,
      selectedSceneIds: [],
      selectedSceneId: null,
    })
  },

  setWorkspaceMode(workspaceMode) {
    set({ workspaceMode })
  },

  setActiveBoard(activeBoardId) {
    set({ activeBoardId, selectedBoardId: null })
    void window.narralab.windows.updateGlobalUiState({ activeBoardId })
  },

  applyGlobalUiState(input) {
    set((state) => ({
      activeBoardId: input.activeBoardId ?? state.activeBoardId,
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
      void window.narralab.windows.updateGlobalUiState({ activeBoardId: board.id })
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

  async addBlockToBoard(boardId, kind, afterItemId = null) {
    await runProjectAction(set, async () => {
      const item = await window.narralab.boards.addBlock(boardId, kind, afterItemId)
      set((state) => ({
        boards: state.boards.map((board) =>
          board.id === boardId
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

  async addBlockToActiveBoard(kind, afterItemId = null) {
    const activeBoardId = get().activeBoardId
    if (!activeBoardId) return

    await get().addBlockToBoard(activeBoardId, kind, afterItemId)
  },

  async addBlockTemplateToBoard(boardId, templateId, afterItemId = null) {
    await runProjectAction(set, async () => {
      const template = get().blockTemplates.find((entry) => entry.id === templateId)
      if (!template) {
        throw new Error('Template not found')
      }

      const created = await window.narralab.boards.addBlock(boardId, template.kind, afterItemId)
      const item = await window.narralab.boards.updateItem({
        id: created.id,
        kind: template.kind,
        title: template.title,
        body: template.body,
      })

      set((state) => ({
        boards: state.boards.map((board) =>
          board.id === boardId
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

  async addBlockTemplateToActiveBoard(templateId, afterItemId = null) {
    const activeBoardId = get().activeBoardId
    if (!activeBoardId) return

    await get().addBlockTemplateToBoard(activeBoardId, templateId, afterItemId)
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

  async reorderBoard(boardId, itemIds) {
    await runProjectAction(set, async () => {
      const items = await window.narralab.boards.reorder(boardId, itemIds)
      set((state) => ({
        boards: state.boards.map((board) =>
          board.id === boardId
            ? {
                ...board,
                items,
              }
            : board,
        ),
      }))
    })
  },

  async reorderActiveBoard(itemIds) {
    const activeBoardId = get().activeBoardId
    if (!activeBoardId) return

    await get().reorderBoard(activeBoardId, itemIds)
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
