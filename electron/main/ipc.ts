import type { BoardScriptExportFormat } from '@/types/project'
import type { ArchiveFolderUpdateInput, ArchiveItemUpdateInput } from '@/types/archive'
import type { AppSettingsUpdateInput, ConsultantChatInput } from '@/types/ai'
import type { BoardItemKind, BoardItemUpdateInput, BoardTextItemKind, BoardUpdateInput } from '@/types/board'
import type { SceneColor, SceneUpdateInput } from '@/types/scene'
import type { TagType } from '@/types/tag'

import { ipcMain } from 'electron'

import { AIConsultantService } from './ai-consultant-service'
import { AppSettingsService } from './app-settings-service'
import { ProjectService } from './project-service'

export function registerIpc(
  projectService: ProjectService,
  settingsService: AppSettingsService,
  consultantService: AIConsultantService,
) {
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
  ipcMain.handle('project:exportBoardScript', (_, boardId: string, requestedPath?: string | null, format?: BoardScriptExportFormat) =>
    projectService.exportBoardScript(boardId, requestedPath, format),
  )
  ipcMain.handle('project:importJson', (_, requestedPath?: string | null) =>
    projectService.importJson(requestedPath),
  )
  ipcMain.handle('project:getMeta', () => projectService.getMeta())
  ipcMain.handle('notebook:get', () => projectService.getNotebook())
  ipcMain.handle('notebook:update', (_, content: string) => projectService.updateNotebook(content))
  ipcMain.handle('archive:folders:list', () => projectService.listArchiveFolders())
  ipcMain.handle('archive:folders:create', (_, name: string, parentId?: string | null) => projectService.createArchiveFolder(name, parentId))
  ipcMain.handle('archive:folders:rename', (_, folderId: string, name: string) =>
    projectService.renameArchiveFolder(folderId, name),
  )
  ipcMain.handle('archive:folders:update', (_, input: ArchiveFolderUpdateInput) =>
    projectService.updateArchiveFolder(input),
  )
  ipcMain.handle('archive:folders:delete', (_, folderId: string) =>
    projectService.deleteArchiveFolder(folderId),
  )
  ipcMain.handle('archive:items:list', () => projectService.listArchiveItems())
  ipcMain.handle('archive:items:add', (_, filePaths?: string[] | null, folderId?: string | null) =>
    projectService.importArchiveFiles(filePaths, folderId),
  )
  ipcMain.handle('archive:items:update', (_, input: ArchiveItemUpdateInput) =>
    projectService.updateArchiveItem(input),
  )
  ipcMain.handle('archive:items:delete', (_, itemId: string) => projectService.deleteArchiveItem(itemId))
  ipcMain.handle('archive:items:open', (_, itemId: string) => projectService.openArchiveItem(itemId))
  ipcMain.handle('archive:items:reveal', (_, itemId: string) => projectService.revealArchiveItem(itemId))

  ipcMain.handle('scenes:list', () => projectService.listScenes())
  ipcMain.handle('scenes:create', () => projectService.createScene())
  ipcMain.handle('scenes:update', (_, input: SceneUpdateInput) => projectService.updateScene(input))
  ipcMain.handle('scenes:delete', (_, id: string) => projectService.deleteScene(id))
  ipcMain.handle('scenes:reorder', (_, sceneIds: string[]) => projectService.reorderScenes(sceneIds))
  ipcMain.handle('sceneFolders:list', () => projectService.listSceneFolders())
  ipcMain.handle('sceneFolders:create', (_, name: string, parentPath?: string | null) => projectService.createSceneFolder(name, parentPath))
  ipcMain.handle('sceneFolders:update', (_, currentPath: string, input: { name?: string; color?: SceneColor; parentPath?: string | null }) =>
    projectService.updateSceneFolder(currentPath, input),
  )
  ipcMain.handle('sceneFolders:delete', (_, currentPath: string) => projectService.deleteSceneFolder(currentPath))

  ipcMain.handle('boards:list', () => projectService.listBoards())
  ipcMain.handle('boards:create', (_, name: string, folder?: string | null) =>
    projectService.createBoard(name, folder),
  )
  ipcMain.handle('boards:delete', (_, boardId: string) =>
    projectService.deleteBoard(boardId),
  )
  ipcMain.handle('boards:createClone', (_, sourceBoardId: string, name?: string) =>
    projectService.createBoardClone(sourceBoardId, name),
  )
  ipcMain.handle('boards:updateBoard', (_, input: BoardUpdateInput) =>
    projectService.updateBoard(input),
  )
  ipcMain.handle('boards:reorderBoards', (_, boardIds: string[]) =>
    projectService.reorderBoards(boardIds),
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
  ipcMain.handle('boardFolders:list', () => projectService.listBoardFolders())
  ipcMain.handle('boardFolders:create', (_, name: string, parentPath?: string | null) => projectService.createBoardFolder(name, parentPath))
  ipcMain.handle('boardFolders:rename', (_, oldPath: string, newName: string) =>
    projectService.renameBoardFolder(oldPath, newName),
  )
  ipcMain.handle('boardFolders:update', (_, currentPath: string, input: { name?: string; color?: SceneColor; parentPath?: string | null }) =>
    projectService.updateBoardFolder(currentPath, input),
  )
  ipcMain.handle('boardFolders:delete', (_, currentPath: string) =>
    projectService.deleteBoardFolder(currentPath),
  )
  ipcMain.handle('blockTemplates:list', () => projectService.listBlockTemplates())
  ipcMain.handle('blockTemplates:create', (_, input: { kind: Exclude<BoardItemKind, 'scene'>; name: string; title: string; body: string }) =>
    projectService.createBlockTemplate(input),
  )
  ipcMain.handle('blockTemplates:delete', (_, id: string) => projectService.deleteBlockTemplate(id))
  ipcMain.handle('settings:get', () => settingsService.getSettings())
  ipcMain.handle('settings:update', (_, input: AppSettingsUpdateInput) => settingsService.updateSettings(input))
  ipcMain.handle('consultant:chat', (_, input: ConsultantChatInput) => consultantService.chat(input))
  ipcMain.handle('tags:upsert', (_, input: { id?: string; name: string; type?: TagType }) =>
    projectService.upsertTag(input),
  )
  ipcMain.handle('tags:delete', (_, id: string) => projectService.deleteTag(id))
}
