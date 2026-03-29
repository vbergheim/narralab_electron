import type { BoardScriptExportFormat } from '@/types/project'
import type { ArchiveFolderUpdateInput, ArchiveItemUpdateInput } from '@/types/archive'
import type { AppSettingsUpdateInput, ConsultantChatInput, WindowWorkspace } from '@/types/ai'
import type { BoardItemKind, BoardItemUpdateInput, BoardTextItemKind, BoardUpdateInput } from '@/types/board'
import type { SceneColor, SceneUpdateInput } from '@/types/scene'
import type { TagType } from '@/types/tag'

import { ipcMain } from 'electron'

import { AIConsultantService } from './ai-consultant-service'
import { AppSettingsService } from './app-settings-service'
import { ProjectService } from './project-service'
import { WindowManager } from './window-manager'

export function registerIpc(
  projectService: ProjectService,
  settingsService: AppSettingsService,
  consultantService: AIConsultantService,
  windowManager: WindowManager,
) {
  ipcMain.handle('project:create', async (_, requestedPath?: string | null) => {
    const result = await projectService.createProject(requestedPath)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('project:open', async (_, requestedPath?: string | null) => {
    const result = await projectService.openProject(requestedPath)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('project:saveAs', async (_, requestedPath?: string | null) => {
    const result = await projectService.saveProjectAs(requestedPath)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('project:exportJson', (_, requestedPath?: string | null) =>
    projectService.exportJson(requestedPath),
  )
  ipcMain.handle('project:exportBoardScript', (_, boardId: string, requestedPath?: string | null, format?: BoardScriptExportFormat) =>
    projectService.exportBoardScript(boardId, requestedPath, format),
  )
  ipcMain.handle('project:importJson', async (_, requestedPath?: string | null) => {
    const result = await projectService.importJson(requestedPath)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('project:getMeta', () => projectService.getMeta())
  ipcMain.handle('project:getSettings', () => projectService.getProjectSettings())
  ipcMain.handle('project:updateSettings', (_, input) => {
    const result = projectService.updateProjectSettings(input)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('notebook:get', () => projectService.getNotebook())
  ipcMain.handle('notebook:update', (_, content: string) => {
    const result = projectService.updateNotebook(content)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('archive:folders:list', () => projectService.listArchiveFolders())
  ipcMain.handle('archive:folders:create', (_, name: string, parentId?: string | null) => {
    const result = projectService.createArchiveFolder(name, parentId)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('archive:folders:rename', (_, folderId: string, name: string) => {
    const result = projectService.renameArchiveFolder(folderId, name)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('archive:folders:update', (_, input: ArchiveFolderUpdateInput) => {
    const result = projectService.updateArchiveFolder(input)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('archive:folders:delete', (_, folderId: string) => {
    const result = projectService.deleteArchiveFolder(folderId)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('archive:items:list', () => projectService.listArchiveItems())
  ipcMain.handle('archive:items:add', async (_, filePaths?: string[] | null, folderId?: string | null) => {
    const result = await projectService.importArchiveFiles(filePaths, folderId)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('archive:items:update', (_, input: ArchiveItemUpdateInput) => {
    const result = projectService.updateArchiveItem(input)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('archive:items:delete', (_, itemId: string) => {
    projectService.deleteArchiveItem(itemId)
    windowManager.notifyProjectChanged()
  })
  ipcMain.handle('archive:items:open', (_, itemId: string) => projectService.openArchiveItem(itemId))
  ipcMain.handle('archive:items:reveal', (_, itemId: string) => projectService.revealArchiveItem(itemId))

  ipcMain.handle('scenes:list', () => projectService.listScenes())
  ipcMain.handle('scenes:create', () => {
    const result = projectService.createScene()
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('scenes:update', (_, input: SceneUpdateInput) => {
    const result = projectService.updateScene(input)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('scenes:delete', (_, id: string) => {
    projectService.deleteScene(id)
    windowManager.notifyProjectChanged()
  })
  ipcMain.handle('scenes:reorder', (_, sceneIds: string[]) => {
    const result = projectService.reorderScenes(sceneIds)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('sceneBeats:create', (_, sceneId: string, afterBeatId?: string | null) => {
    const result = projectService.createSceneBeat(sceneId, afterBeatId)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('sceneBeats:update', (_, input) => {
    const result = projectService.updateSceneBeat(input)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('sceneBeats:delete', (_, id: string) => {
    projectService.deleteSceneBeat(id)
    windowManager.notifyProjectChanged()
  })
  ipcMain.handle('sceneBeats:reorder', (_, sceneId: string, beatIds: string[]) => {
    const result = projectService.reorderSceneBeats(sceneId, beatIds)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('sceneFolders:list', () => projectService.listSceneFolders())
  ipcMain.handle('sceneFolders:create', (_, name: string, parentPath?: string | null) => {
    const result = projectService.createSceneFolder(name, parentPath)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('sceneFolders:update', (_, currentPath: string, input: { name?: string; color?: SceneColor; parentPath?: string | null }) => {
    const result = projectService.updateSceneFolder(currentPath, input)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('sceneFolders:delete', (_, currentPath: string) => {
    const result = projectService.deleteSceneFolder(currentPath)
    windowManager.notifyProjectChanged()
    return result
  })

  ipcMain.handle('boards:list', () => projectService.listBoards())
  ipcMain.handle('boards:create', (_, name: string, folder?: string | null) => {
    const result = projectService.createBoard(name, folder)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:delete', (_, boardId: string) => {
    const result = projectService.deleteBoard(boardId)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:createClone', (_, sourceBoardId: string, name?: string) => {
    const result = projectService.createBoardClone(sourceBoardId, name)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:updateBoard', (_, input: BoardUpdateInput) => {
    const result = projectService.updateBoard(input)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:reorderBoards', (_, boardIds: string[]) => {
    const result = projectService.reorderBoards(boardIds)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:addScene', (_, boardId: string, sceneId: string, afterItemId?: string | null, boardPosition?: { x: number; y: number } | null) => {
    const result = projectService.addSceneToBoard(boardId, sceneId, afterItemId, boardPosition)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:addBlock', (_, boardId: string, kind: BoardTextItemKind, afterItemId?: string | null) => {
    const result = projectService.addBlockToBoard(boardId, kind, afterItemId)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:duplicateItem', (_, itemId: string) => {
    const result = projectService.duplicateBoardItem(itemId)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:removeItem', (_, itemId: string) => {
    projectService.removeBoardItem(itemId)
    windowManager.notifyProjectChanged()
  })
  ipcMain.handle('boards:reorder', (_, boardId: string, itemIds: string[]) => {
    const result = projectService.reorderBoard(boardId, itemIds)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:updateItem', (_, input: BoardItemUpdateInput) => {
    const result = projectService.updateBoardItem(input)
    windowManager.notifyProjectChanged()
    return result
  })

  ipcMain.handle('tags:list', () => projectService.listTags())
  ipcMain.handle('boardFolders:list', () => projectService.listBoardFolders())
  ipcMain.handle('boardFolders:create', (_, name: string, parentPath?: string | null) => {
    const result = projectService.createBoardFolder(name, parentPath)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boardFolders:rename', (_, oldPath: string, newName: string) => {
    const result = projectService.renameBoardFolder(oldPath, newName)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boardFolders:update', (_, currentPath: string, input: { name?: string; color?: SceneColor; parentPath?: string | null }) => {
    const result = projectService.updateBoardFolder(currentPath, input)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boardFolders:delete', (_, currentPath: string) => {
    const result = projectService.deleteBoardFolder(currentPath)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('blockTemplates:list', () => projectService.listBlockTemplates())
  ipcMain.handle('blockTemplates:create', (_, input: { kind: Exclude<BoardItemKind, 'scene'>; name: string; title: string; body: string }) => {
    const result = projectService.createBlockTemplate(input)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('blockTemplates:delete', (_, id: string) => {
    const result = projectService.deleteBlockTemplate(id)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('settings:get', () => settingsService.getSettings())
  ipcMain.handle('settings:update', (_, input: AppSettingsUpdateInput) => settingsService.updateSettings(input))
  ipcMain.handle('windows:getContext', (event) => windowManager.getContext(event.sender.id))
  ipcMain.handle('windows:openWorkspace', (_, workspace: WindowWorkspace, options) =>
    windowManager.openWorkspace(workspace, options),
  )
  ipcMain.handle('windows:updateContext', (event, input) =>
    windowManager.updateContext(event.sender.id, input),
  )
  ipcMain.handle('windows:getDragSession', () => windowManager.getDragSession())
  ipcMain.handle('windows:setDragSession', (_, session) => windowManager.updateDragSession(session))
  ipcMain.handle('windows:getGlobalUiState', () => windowManager.getGlobalUiState())
  ipcMain.handle('windows:updateGlobalUiState', (_, input) => windowManager.updateGlobalUiState(input))
  ipcMain.handle('windows:listLayouts', () => windowManager.listLayouts())
  ipcMain.handle('windows:saveLayout', (_, name: string) => windowManager.saveLayout(name))
  ipcMain.handle('windows:applyLayout', (_, layoutId: string) => windowManager.applyLayout(layoutId))
  ipcMain.handle('windows:deleteLayout', (_, layoutId: string) => windowManager.deleteLayout(layoutId))
  ipcMain.handle('consultant:chat', (_, input: ConsultantChatInput) => consultantService.chat(input))
  ipcMain.handle('tags:upsert', (_, input: { id?: string; name: string; type?: TagType }) =>
    projectService.upsertTag(input),
  )
  ipcMain.handle('tags:delete', (_, id: string) => projectService.deleteTag(id))
}
