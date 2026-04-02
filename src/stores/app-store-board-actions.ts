import { defaultBoardCloneName } from '@/lib/constants'
import type { AppStore, AppStoreGet, AppStoreSet } from '@/stores/app-store-contract'
import { buildBoardOrderAfterMove, runProjectAction } from '@/stores/app-store-utils'
import type { AddSceneToBoardResult, BoardItem } from '@/types/board'

export function createBoardActions(
  set: AppStoreSet,
  get: AppStoreGet,
): Pick<
  AppStore,
  | 'createBoard'
  | 'createBoardFolder'
  | 'renameBoardFolder'
  | 'updateBoardFolder'
  | 'deleteBoardFolder'
  | 'deleteBoard'
  | 'persistBoardItemDraft'
  | 'updateBoardDraft'
  | 'reorderBoards'
  | 'moveBoard'
  | 'cloneBoard'
  | 'addSceneToBoard'
  | 'addSceneToActiveBoard'
  | 'addBlockToBoard'
  | 'addBlockToActiveBoard'
  | 'addBlockTemplateToBoard'
  | 'addBlockTemplateToActiveBoard'
  | 'saveBlockTemplate'
  | 'deleteBlockTemplate'
  | 'copyBlockToBoard'
  | 'duplicateBoardItem'
  | 'removeBoardItem'
  | 'reorderBoard'
  | 'reorderActiveBoard'
  | 'cloneActiveBoard'
> {
  return {
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
                  items: result.existed ? board.items : normalizeBoardItems([...board.items, result.item]),
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
                  items: normalizeBoardItems([...board.items, item]),
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
                  items: normalizeBoardItems([...board.items.filter((entry) => entry.id !== created.id), item]),
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
                  items: normalizeBoardItems([...board.items, copied]),
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
                  items: normalizeBoardItems([...board.items, item]),
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
            items: normalizeBoardItems(board.items.filter((item) => item.id !== itemId)),
          })),
          selectedBoardId: null,
          selectedBoardItemId: state.selectedBoardItemId === itemId ? null : state.selectedBoardItemId,
        }))
      })
    },

    async reorderBoard(boardId, itemIds) {
      await runProjectAction(set, async () => {
        const previousBoard = get().boards.find((board) => board.id === boardId)
        if (!previousBoard) {
          return
        }

        const optimisticItems = buildReorderedBoardItems(previousBoard.items, itemIds)

        set((state) => ({
          boards: state.boards.map((board) =>
            board.id === boardId
              ? {
                  ...board,
                  items: optimisticItems,
                }
              : board,
          ),
        }))

        try {
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
        } catch (error) {
          set((state) => ({
            boards: state.boards.map((board) =>
              board.id === boardId
                ? {
                    ...board,
                    items: previousBoard.items,
                  }
                : board,
            ),
          }))
          throw error
        }
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
  }
}

function normalizeBoardItems(items: BoardItem[]) {
  return [...items]
    .sort((left, right) => left.position - right.position)
    .map((entry, index) => ({ ...entry, position: index }) as BoardItem)
}

function buildReorderedBoardItems(items: BoardItem[], itemIds: string[]) {
  const itemById = new Map(items.map((item) => [item.id, item] as const))
  return itemIds
    .map((itemId, index) => {
      const item = itemById.get(itemId)
      return item ? ({ ...item, position: index } as BoardItem) : null
    })
    .filter((item): item is BoardItem => item !== null)
}
