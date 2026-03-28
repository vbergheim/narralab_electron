import { create } from 'zustand'

import { defaultBoardCloneName } from '@/lib/constants'
import type { Board, BoardItem, BoardTextItem, BoardTextItemKind } from '@/types/board'
import type { NotebookDocument, ProjectMeta } from '@/types/project'
import type { Scene, SceneUpdateInput } from '@/types/scene'
import type { Tag, TagType } from '@/types/tag'

type WorkspaceMode = 'outline' | 'bank' | 'notebook'

type SceneDraftInput = Omit<Scene, 'tagIds' | 'createdAt' | 'updatedAt'> & {
  tagNames: string[]
}

type BoardItemDraftInput = Pick<BoardTextItem, 'id' | 'kind' | 'title' | 'body'>
type SceneBulkUpdateInput = {
  sceneIds: string[]
  category?: string
  status?: Scene['status']
  color?: Scene['color']
}

type AppStore = {
  ready: boolean
  busy: boolean
  error: string | null
  projectMeta: ProjectMeta | null
  notebook: NotebookDocument
  scenes: Scene[]
  boards: Board[]
  tags: Tag[]
  activeBoardId: string | null
  selectedSceneId: string | null
  selectedSceneIds: string[]
  selectedBoardItemId: string | null
  workspaceMode: WorkspaceMode
  initialize(): Promise<void>
  refreshAll(): Promise<void>
  createProject(): Promise<void>
  openProject(): Promise<void>
  saveProjectAs(): Promise<void>
  importJson(): Promise<void>
  exportJson(): Promise<void>
  createScene(): Promise<void>
  deleteScene(sceneId: string): Promise<void>
  persistSceneDraft(input: SceneDraftInput): Promise<void>
  bulkUpdateScenes(input: SceneBulkUpdateInput): Promise<void>
  persistBoardItemDraft(input: BoardItemDraftInput): Promise<void>
  updateNotebookDraft(content: string): void
  persistNotebook(content: string): Promise<void>
  duplicateScene(sceneId: string, options?: { addToBoardAfterItemId?: string | null }): Promise<void>
  selectScene(sceneId: string | null, boardItemId?: string | null): void
  toggleSceneSelection(sceneId: string): void
  setSceneSelection(sceneIds: string[]): void
  clearSceneSelection(): void
  setWorkspaceMode(mode: WorkspaceMode): void
  setActiveBoard(boardId: string): void
  renameBoard(boardId: string, name: string): Promise<void>
  cloneBoard(boardId: string): Promise<void>
  addSceneToActiveBoard(sceneId: string, afterItemId?: string | null): Promise<void>
  addBlockToActiveBoard(kind: BoardTextItemKind, afterItemId?: string | null): Promise<void>
  duplicateBoardItem(itemId: string): Promise<void>
  removeBoardItem(itemId: string): Promise<void>
  reorderActiveBoard(itemIds: string[]): Promise<void>
  cloneActiveBoard(): Promise<void>
  dismissError(): void
}

export const useAppStore = create<AppStore>((set, get) => ({
  ready: false,
  busy: false,
  error: null,
  projectMeta: null,
  notebook: { content: '', updatedAt: null },
  scenes: [],
  boards: [],
  tags: [],
  activeBoardId: null,
  selectedSceneId: null,
  selectedSceneIds: [],
  selectedBoardItemId: null,
  workspaceMode: 'outline',

  async initialize() {
    try {
      const meta = await window.docudoc.project.getMeta()
      set({ ready: true, projectMeta: meta })
      if (meta) {
        await get().refreshAll()
      }
    } catch (error) {
      set({ ready: true, error: toMessage(error) })
    }
  },

  async refreshAll() {
    const meta = await window.docudoc.project.getMeta()
    if (!meta) {
      set({
        projectMeta: null,
        notebook: { content: '', updatedAt: null },
        scenes: [],
        boards: [],
        tags: [],
        activeBoardId: null,
      })
      return
    }

    const [notebook, scenes, boards, tags] = await Promise.all([
      window.docudoc.notebook.get(),
      window.docudoc.scenes.list(),
      window.docudoc.boards.list(),
      window.docudoc.tags.list(),
    ])

    set((state) => ({
      projectMeta: meta,
      notebook,
      scenes,
      boards,
      tags,
      activeBoardId:
        state.activeBoardId && boards.some((board) => board.id === state.activeBoardId)
          ? state.activeBoardId
          : boards[0]?.id ?? null,
    }))
  },

  async createProject() {
    await runProjectAction(set, async () => {
      const meta = await window.docudoc.project.create()
      if (meta) await get().refreshAll()
    })
  },

  async openProject() {
    await runProjectAction(set, async () => {
      const meta = await window.docudoc.project.open()
      if (meta) await get().refreshAll()
    })
  },

  async saveProjectAs() {
    await runProjectAction(set, async () => {
      const meta = await window.docudoc.project.saveAs()
      if (meta) await get().refreshAll()
    })
  },

  async importJson() {
    await runProjectAction(set, async () => {
      const meta = await window.docudoc.project.importJson()
      if (meta) await get().refreshAll()
    })
  },

  async exportJson() {
    await runProjectAction(set, async () => {
      await window.docudoc.project.exportJson()
    })
  },

  async createScene() {
    await runProjectAction(set, async () => {
      const scene = await window.docudoc.scenes.create()
      set((state) => ({
        scenes: [scene, ...state.scenes],
        selectedSceneId: scene.id,
        selectedSceneIds: [scene.id],
        selectedBoardItemId: null,
      }))
    })
  },

  async deleteScene(sceneId) {
    await runProjectAction(set, async () => {
      await window.docudoc.scenes.delete(sceneId)
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

  async persistSceneDraft(input) {
    await runProjectAction(set, async () => {
      const tags = get().tags
      const tagIds: string[] = []

      for (const rawName of input.tagNames) {
        const name = rawName.trim()
        if (!name) continue
        const existing = tags.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
        const tag = existing ?? (await window.docudoc.tags.upsert({ name, type: inferTagType(name) }))
        if (!existing) {
          set((state) => ({ tags: [...state.tags, tag].sort((a, b) => a.name.localeCompare(b.name)) }))
        }
        tagIds.push(tag.id)
      }

      const updated = await window.docudoc.scenes.update({
        id: input.id,
        title: input.title,
        synopsis: input.synopsis,
        notes: input.notes,
        color: input.color,
        status: input.status,
        isKeyScene: input.isKeyScene,
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
          window.docudoc.scenes.update({
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
      const updated = await window.docudoc.boards.updateItem(input)

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
      const notebook = await window.docudoc.notebook.update(content)
      set({ notebook })
    } catch (error) {
      set({ error: toMessage(error) })
    }
  },

  async duplicateScene(sceneId, options) {
    const source = get().scenes.find((scene) => scene.id === sceneId)
    if (!source) return

    await runProjectAction(set, async () => {
      const created = await window.docudoc.scenes.create()
      const duplicated = await window.docudoc.scenes.update({
        id: created.id,
        title: source.title ? `${source.title} Copy` : 'Untitled Scene Copy',
        synopsis: source.synopsis,
        notes: source.notes,
        color: source.color,
        status: source.status,
        isKeyScene: source.isKeyScene,
        category: source.category,
        estimatedDuration: source.estimatedDuration,
        actualDuration: source.actualDuration,
        location: source.location,
        characters: source.characters,
        function: source.function,
        sourceReference: source.sourceReference,
        tagIds: source.tagIds,
      } satisfies SceneUpdateInput)

      set((state) => ({
        scenes: [duplicated, ...state.scenes],
        selectedSceneId: duplicated.id,
        selectedSceneIds: [duplicated.id],
        selectedBoardItemId: null,
      }))

      if (options?.addToBoardAfterItemId !== undefined) {
        await get().addSceneToActiveBoard(duplicated.id, options.addToBoardAfterItemId ?? null)
      }
    })
  },

  selectScene(sceneId, boardItemId = null) {
    set({
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
        selectedSceneIds,
        selectedSceneId: selectedSceneIds[0] ?? null,
        selectedBoardItemId: null,
      }
    })
  },

  setSceneSelection(sceneIds) {
    set({
      selectedSceneIds: sceneIds,
      selectedSceneId: sceneIds[0] ?? null,
      selectedBoardItemId: null,
    })
  },

  clearSceneSelection() {
    set({
      selectedSceneIds: [],
      selectedSceneId: null,
    })
  },

  setWorkspaceMode(workspaceMode) {
    set({ workspaceMode })
  },

  setActiveBoard(activeBoardId) {
    set({ activeBoardId })
  },

  async renameBoard(boardId, name) {
    await runProjectAction(set, async () => {
      const board = await window.docudoc.boards.updateBoard(boardId, name)
      set((state) => ({
        boards: state.boards.map((entry) => (entry.id === board.id ? board : entry)),
      }))
    })
  },

  async cloneBoard(boardId) {
    await runProjectAction(set, async () => {
      const board = await window.docudoc.boards.createClone(boardId, defaultBoardCloneName)
      set((state) => ({
        boards: [...state.boards, board],
        activeBoardId: board.id,
      }))
    })
  },

  async addSceneToActiveBoard(sceneId, afterItemId = null) {
    const activeBoardId = get().activeBoardId
    if (!activeBoardId) return

    await runProjectAction(set, async () => {
      const result = await window.docudoc.boards.addScene(activeBoardId, sceneId, afterItemId)
      set((state) => ({
        boards: state.boards.map((board) =>
          board.id === activeBoardId && !result.existed
            ? {
                ...board,
                items: [...board.items, result.item]
                  .sort((left, right) => left.position - right.position)
                  .map((entry, index) => ({ ...entry, position: index }) as BoardItem),
              }
            : board,
        ),
        selectedSceneId: sceneId,
        selectedSceneIds: [sceneId],
        selectedBoardItemId: result.item.id,
      }))
    })
  },

  async addBlockToActiveBoard(kind, afterItemId = null) {
    const activeBoardId = get().activeBoardId
    if (!activeBoardId) return

    await runProjectAction(set, async () => {
      const item = await window.docudoc.boards.addBlock(activeBoardId, kind, afterItemId)
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
        selectedSceneId: null,
        selectedBoardItemId: item.id,
      }))
    })
  },

  async duplicateBoardItem(itemId) {
    await runProjectAction(set, async () => {
      const item = await window.docudoc.boards.duplicateItem(itemId)
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
        selectedSceneId: null,
        selectedBoardItemId: item.id,
      }))
    })
  },

  async removeBoardItem(itemId) {
    await runProjectAction(set, async () => {
      await window.docudoc.boards.removeItem(itemId)
      set((state) => ({
        boards: state.boards.map((board) => ({
          ...board,
          items: board.items
            .filter((item) => item.id !== itemId)
            .map((item, index) => ({ ...item, position: index } as BoardItem)),
        })),
        selectedBoardItemId: state.selectedBoardItemId === itemId ? null : state.selectedBoardItemId,
      }))
    })
  },

  async reorderActiveBoard(itemIds) {
    const activeBoardId = get().activeBoardId
    if (!activeBoardId) return

    await runProjectAction(set, async () => {
      const items = await window.docudoc.boards.reorder(activeBoardId, itemIds)
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
