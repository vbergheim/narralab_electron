import type { BoardItemUpdateInput, BoardTextItemKind } from '@/types/board'
import type { SceneUpdateInput } from '@/types/scene'
import type { TagType } from '@/types/tag'

import { ipcMain } from 'electron'

import { ProjectService } from './project-service'

export function registerIpc(projectService: ProjectService) {
  ipcMain.handle('project:create', (_, requestedPath?: string | null) =>
    projectService.createProject(requestedPath),
  )
  ipcMain.handle('project:open', (_, requestedPath?: string | null) =>
    projectService.openProject(requestedPath),
  )
  ipcMain.handle('project:saveAs', (_, requestedPath?: string | null) =>
    projectService.saveProjectAs(requestedPath),
  )
  ipcMain.handle('project:exportJson', (_, requestedPath?: string | null) =>
    projectService.exportJson(requestedPath),
  )
  ipcMain.handle('project:importJson', (_, requestedPath?: string | null) =>
    projectService.importJson(requestedPath),
  )
  ipcMain.handle('project:getMeta', () => projectService.getMeta())
  ipcMain.handle('notebook:get', () => projectService.getNotebook())
  ipcMain.handle('notebook:update', (_, content: string) => projectService.updateNotebook(content))

  ipcMain.handle('scenes:list', () => projectService.listScenes())
  ipcMain.handle('scenes:create', () => projectService.createScene())
  ipcMain.handle('scenes:update', (_, input: SceneUpdateInput) => projectService.updateScene(input))
  ipcMain.handle('scenes:delete', (_, id: string) => projectService.deleteScene(id))

  ipcMain.handle('boards:list', () => projectService.listBoards())
  ipcMain.handle('boards:createClone', (_, sourceBoardId: string, name?: string) =>
    projectService.createBoardClone(sourceBoardId, name),
  )
  ipcMain.handle('boards:updateBoard', (_, boardId: string, name: string) =>
    projectService.updateBoard(boardId, name),
  )
  ipcMain.handle('boards:addScene', (_, boardId: string, sceneId: string, afterItemId?: string | null) =>
    projectService.addSceneToBoard(boardId, sceneId, afterItemId),
  )
  ipcMain.handle('boards:addBlock', (_, boardId: string, kind: BoardTextItemKind, afterItemId?: string | null) =>
    projectService.addBlockToBoard(boardId, kind, afterItemId),
  )
  ipcMain.handle('boards:duplicateItem', (_, itemId: string) => projectService.duplicateBoardItem(itemId))
  ipcMain.handle('boards:removeItem', (_, itemId: string) => projectService.removeBoardItem(itemId))
  ipcMain.handle('boards:reorder', (_, boardId: string, itemIds: string[]) =>
    projectService.reorderBoard(boardId, itemIds),
  )
  ipcMain.handle('boards:updateItem', (_, input: BoardItemUpdateInput) =>
    projectService.updateBoardItem(input),
  )

  ipcMain.handle('tags:list', () => projectService.listTags())
  ipcMain.handle('tags:upsert', (_, input: { id?: string; name: string; type?: TagType }) =>
    projectService.upsertTag(input),
  )
  ipcMain.handle('tags:delete', (_, id: string) => projectService.deleteTag(id))
}
