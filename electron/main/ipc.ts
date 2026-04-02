import type { AppSettingsUpdateInput, ConsultantChatInput, WindowWorkspace } from '@/types/ai'
import type { BoardItemKind, BoardItemUpdateInput, BoardTextItemKind, BoardUpdateInput } from '@/types/board'
import type { BoardScriptExportFormat } from '@/types/project'
import type { SceneColor, SceneUpdateInput } from '@/types/scene'
import type { ArchiveFolderUpdateInput, ArchiveItemUpdateInput } from '@/types/archive'
import type { TagType } from '@/types/tag'

import { ipcMain } from 'electron'

import { AIConsultantService } from './ai-consultant-service'
import { AppSettingsService } from './app-settings-service'
import {
  nullableString,
  optionalString,
  parseAppSettingsUpdateInput,
  parseTranscriptionDownloadInput,
  parseTranscriptionStartInput,
  parseArchiveFolderUpdateInput,
  parseArchiveItemUpdateInput,
  parseBlockTemplateInput,
  parseBoardTextKind,
  parseBoardItemUpdateInput,
  parseBoardPosition,
  parseBoardUpdateInput,
  parseConsultantChatInput,
  parseFolderUpdateInput,
  parseProjectSettingsUpdateInput,
  parseSceneBeatUpdateInput,
  parseSceneUpdateInput,
  parseTagUpsertInput,
  parseGlobalUiStatePatch,
  parseNotebookDocument,
  parseWindowContextUpdate,
  parseWindowDragSession,
  parseWindowWorkspace,
  requireString,
  requireStringArray,
  requireTranscriptionItemUpdateInput,
} from './ipc-validators'
import { ProjectService } from './project-service'
import { TranscriptionService } from './transcription-service'
import { WindowManager } from './window-manager'

export function registerIpc(
  projectService: ProjectService,
  settingsService: AppSettingsService,
  consultantService: AIConsultantService,
  windowManager: WindowManager,
) {
  const transcriptionService = new TranscriptionService(settingsService, projectService)

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
  ipcMain.handle(
    'project:exportBoardScript',
    (_, boardId: string, requestedPath?: string | null, format?: BoardScriptExportFormat) =>
      projectService.exportBoardScript(requireString(boardId, 'Board id'), requestedPath, format),
  )
  ipcMain.handle('project:importJson', async (_, requestedPath?: string | null) => {
    const result = await projectService.importJson(requestedPath)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('project:importShootLog', async (_, requestedPath?: string | null) => {
    const result = await projectService.importShootLog(requestedPath)
    if (result && result.errors.length === 0 && (result.addedSceneCount > 0 || result.addedBeatCount > 0)) {
      windowManager.notifyProjectChanged()
    }
    return result
  })
  ipcMain.handle('project:getMeta', () => projectService.getMeta())
  ipcMain.handle('project:getSettings', () => projectService.getProjectSettings())
  ipcMain.handle('project:updateSettings', (_, input) => {
    const result = projectService.updateProjectSettings(parseProjectSettingsUpdateInput(input))
    windowManager.notifyProjectChanged()
    return result
  })

  ipcMain.handle('notebook:get', () => projectService.getNotebook())
  ipcMain.handle('notebook:update', (_, payload: unknown) => {
    const result = projectService.updateNotebook(parseNotebookDocument(payload))
    windowManager.notifyProjectChanged()
    return result
  })

  ipcMain.handle('archive:folders:list', () => projectService.listArchiveFolders())
  ipcMain.handle('archive:folders:create', (_, name: string, parentId?: string | null) => {
    const result = projectService.createArchiveFolder(
      requireString(name, 'Archive folder name'),
      nullableString(parentId, 'Archive parent folder id'),
    )
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('archive:folders:rename', (_, folderId: string, name: string) => {
    const result = projectService.renameArchiveFolder(
      requireString(folderId, 'Archive folder id'),
      requireString(name, 'Archive folder name'),
    )
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('archive:folders:update', (_, input: ArchiveFolderUpdateInput) => {
    const result = projectService.updateArchiveFolder(parseArchiveFolderUpdateInput(input))
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('archive:folders:delete', (_, folderId: string) => {
    const result = projectService.deleteArchiveFolder(requireString(folderId, 'Archive folder id'))
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('archive:items:list', () => projectService.listArchiveItems())
  ipcMain.handle('archive:items:add', async (_, filePaths?: string[] | null, folderId?: string | null) => {
    const result = await projectService.importArchiveFiles(
      filePaths == null ? filePaths : requireStringArray(filePaths, 'Archive file paths'),
      nullableString(folderId, 'Archive folder id'),
    )
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('archive:items:update', (_, input: ArchiveItemUpdateInput) => {
    const result = projectService.updateArchiveItem(parseArchiveItemUpdateInput(input))
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('archive:items:delete', (_, itemId: string) => {
    projectService.deleteArchiveItem(requireString(itemId, 'Archive item id'))
    windowManager.notifyProjectChanged()
  })
  ipcMain.handle('archive:items:open', (_, itemId: string) =>
    projectService.openArchiveItem(requireString(itemId, 'Archive item id')),
  )
  ipcMain.handle('archive:items:reveal', (_, itemId: string) =>
    projectService.revealArchiveItem(requireString(itemId, 'Archive item id')),
  )

  ipcMain.handle('scenes:list', () => projectService.listScenes())
  ipcMain.handle('scenes:create', () => {
    const result = projectService.createScene()
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('scenes:update', (_, input: SceneUpdateInput) => {
    const result = projectService.updateScene(parseSceneUpdateInput(input))
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('scenes:delete', (_, id: string) => {
    projectService.deleteScene(requireString(id, 'Scene id'))
    windowManager.notifyProjectChanged()
  })
  ipcMain.handle('scenes:reorder', (_, sceneIds: string[]) => {
    const result = projectService.reorderScenes(requireStringArray(sceneIds, 'Scene ids'))
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('sceneBeats:create', (_, sceneId: string, afterBeatId?: string | null) => {
    const result = projectService.createSceneBeat(
      requireString(sceneId, 'Scene id'),
      nullableString(afterBeatId, 'After beat id'),
    )
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('sceneBeats:update', (_, input) => {
    const result = projectService.updateSceneBeat(parseSceneBeatUpdateInput(input))
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('sceneBeats:delete', (_, id: string) => {
    projectService.deleteSceneBeat(requireString(id, 'Beat id'))
    windowManager.notifyProjectChanged()
  })
  ipcMain.handle('sceneBeats:reorder', (_, sceneId: string, beatIds: string[]) => {
    const result = projectService.reorderSceneBeats(
      requireString(sceneId, 'Scene id'),
      requireStringArray(beatIds, 'Beat ids'),
    )
    windowManager.notifyProjectChanged()
    return result
  })

  ipcMain.handle('sceneFolders:list', () => projectService.listSceneFolders())
  ipcMain.handle('sceneFolders:create', (_, name: string, parentPath?: string | null) => {
    const result = projectService.createSceneFolder(
      requireString(name, 'Scene folder name'),
      nullableString(parentPath, 'Scene folder parent path'),
    )
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle(
    'sceneFolders:update',
    (_, currentPath: string, input: { name?: string; color?: SceneColor; parentPath?: string | null }) => {
      const result = projectService.updateSceneFolder(
        requireString(currentPath, 'Scene folder path'),
        parseFolderUpdateInput(input),
      )
      windowManager.notifyProjectChanged()
      return result
    },
  )
  ipcMain.handle('sceneFolders:delete', (_, currentPath: string) => {
    const result = projectService.deleteSceneFolder(requireString(currentPath, 'Scene folder path'))
    windowManager.notifyProjectChanged()
    return result
  })

  ipcMain.handle('boards:list', () => projectService.listBoards())
  ipcMain.handle('boards:create', (_, name: string, folder?: string | null) => {
    const result = projectService.createBoard(
      requireString(name, 'Board name'),
      nullableString(folder, 'Board folder'),
    )
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:delete', (_, boardId: string) => {
    const result = projectService.deleteBoard(requireString(boardId, 'Board id'))
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:createClone', (_, sourceBoardId: string, name?: string) => {
    const result = projectService.createBoardClone(
      requireString(sourceBoardId, 'Source board id'),
      optionalString(name, 'Cloned board name'),
    )
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:updateBoard', (_, input: BoardUpdateInput) => {
    const result = projectService.updateBoard(parseBoardUpdateInput(input))
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:reorderBoards', (_, boardIds: string[]) => {
    const result = projectService.reorderBoards(requireStringArray(boardIds, 'Board ids'))
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle(
    'boards:addScene',
    (_, boardId: string, sceneId: string, afterItemId?: string | null, boardPosition?: { x: number; y: number } | null) => {
      const result = projectService.addSceneToBoard(
        requireString(boardId, 'Board id'),
        requireString(sceneId, 'Scene id'),
        nullableString(afterItemId, 'After item id'),
        parseBoardPosition(boardPosition),
      )
      windowManager.notifyProjectChanged()
      return result
    },
  )
  ipcMain.handle('boards:addBlock', (_, boardId: string, kind: BoardTextItemKind, afterItemId?: string | null) => {
    const result = projectService.addBlockToBoard(
      requireString(boardId, 'Board id'),
      parseBoardTextKind(kind),
      nullableString(afterItemId, 'After item id'),
    )
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:duplicateItem', (_, itemId: string) => {
    const result = projectService.duplicateBoardItem(requireString(itemId, 'Board item id'))
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:removeItem', (_, itemId: string) => {
    projectService.removeBoardItem(requireString(itemId, 'Board item id'))
    windowManager.notifyProjectChanged()
  })
  ipcMain.handle('boards:reorder', (_, boardId: string, itemIds: string[]) => {
    const result = projectService.reorderBoard(
      requireString(boardId, 'Board id'),
      requireStringArray(itemIds, 'Board item ids'),
    )
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boards:updateItem', (_, input: BoardItemUpdateInput) => {
    const result = projectService.updateBoardItem(parseBoardItemUpdateInput(input))
    windowManager.notifyProjectChanged()
    return result
  })

  ipcMain.handle('tags:list', () => projectService.listTags())
  ipcMain.handle('boardFolders:list', () => projectService.listBoardFolders())
  ipcMain.handle('boardFolders:create', (_, name: string, parentPath?: string | null) => {
    const result = projectService.createBoardFolder(
      requireString(name, 'Board folder name'),
      nullableString(parentPath, 'Board folder parent path'),
    )
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('boardFolders:rename', (_, oldPath: string, newName: string) => {
    const result = projectService.renameBoardFolder(
      requireString(oldPath, 'Board folder path'),
      requireString(newName, 'Board folder name'),
    )
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle(
    'boardFolders:update',
    (_, currentPath: string, input: { name?: string; color?: SceneColor; parentPath?: string | null }) => {
      const result = projectService.updateBoardFolder(
        requireString(currentPath, 'Board folder path'),
        parseFolderUpdateInput(input),
      )
      windowManager.notifyProjectChanged()
      return result
    },
  )
  ipcMain.handle('boardFolders:delete', (_, currentPath: string) => {
    const result = projectService.deleteBoardFolder(requireString(currentPath, 'Board folder path'))
    windowManager.notifyProjectChanged()
    return result
  })

  ipcMain.handle('blockTemplates:list', () => projectService.listBlockTemplates())
  ipcMain.handle(
    'blockTemplates:create',
    (_, input: { kind: Exclude<BoardItemKind, 'scene'>; name: string; title: string; body: string }) => {
      const result = projectService.createBlockTemplate(parseBlockTemplateInput(input))
      windowManager.notifyProjectChanged()
      return result
    },
  )
  ipcMain.handle('blockTemplates:delete', (_, id: string) => {
    const result = projectService.deleteBlockTemplate(requireString(id, 'Block template id'))
    windowManager.notifyProjectChanged()
    return result
  })

  ipcMain.handle('settings:get', () => settingsService.getSettings())
  ipcMain.handle('settings:update', (_, input: AppSettingsUpdateInput) =>
    settingsService.updateSettings(parseAppSettingsUpdateInput(input)),
  )

  ipcMain.handle('windows:getContext', (event) => windowManager.getContext(event.sender.id))
  ipcMain.handle('windows:listContexts', () => windowManager.listContexts())
  ipcMain.handle('windows:openWorkspace', (_, workspace: WindowWorkspace, options) =>
    windowManager.openWorkspace(parseWindowWorkspace(workspace), parseWindowContextUpdate(options ?? {})),
  )
  ipcMain.handle('windows:updateContext', (event, input) =>
    windowManager.updateContext(event.sender.id, parseWindowContextUpdate(input)),
  )
  ipcMain.handle('windows:refreshProject', () => windowManager.refreshProject())
  ipcMain.handle('windows:getDragSession', () => windowManager.getDragSession())
  ipcMain.handle('windows:consumeDragSession', () => windowManager.consumeDragSession())
  ipcMain.handle('windows:setDragSession', (_, session) =>
    windowManager.updateDragSession(parseWindowDragSession(session)),
  )
  ipcMain.handle('windows:getGlobalUiState', () => windowManager.getGlobalUiState())
  ipcMain.handle('windows:updateGlobalUiState', (_, input) =>
    windowManager.updateGlobalUiState(parseGlobalUiStatePatch(input)),
  )
  ipcMain.handle('windows:listLayouts', () => windowManager.listLayouts())
  ipcMain.handle('windows:saveLayout', (_, name: string) => windowManager.saveLayout(requireString(name, 'Layout name')))
  ipcMain.handle('windows:applyLayout', (_, layoutId: string) => windowManager.applyLayout(requireString(layoutId, 'Layout id')))
  ipcMain.handle('windows:deleteLayout', (_, layoutId: string) => windowManager.deleteLayout(requireString(layoutId, 'Layout id')))

  ipcMain.handle('consultant:chat', (_, input: ConsultantChatInput) =>
    consultantService.chat(parseConsultantChatInput(input)),
  )

  ipcMain.handle('tags:upsert', (_, input: { id?: string; name: string; type?: TagType }) => {
    const result = projectService.upsertTag(parseTagUpsertInput(input))
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('tags:delete', (_, id: string) => {
    projectService.deleteTag(requireString(id, 'Tag id'))
    windowManager.notifyProjectChanged()
  })

  ipcMain.handle('transcription:pickFile', () => transcriptionService.pickMediaFile())
  ipcMain.handle('transcription:getSetup', () => transcriptionService.getSetup())
  ipcMain.handle('transcription:downloadEngine', async (event) => {
    await transcriptionService.downloadEngine(event.sender)
  })
  ipcMain.handle('transcription:downloadFfmpeg', async (event) => {
    await transcriptionService.downloadFfmpeg(event.sender)
  })
  ipcMain.handle('transcription:downloadModel', async (event, input: unknown) => {
    const { modelId } = parseTranscriptionDownloadInput(input)
    await transcriptionService.downloadModel(modelId, event.sender)
  })
  ipcMain.handle('transcription:deleteModel', async (_, input: unknown) => {
    const { modelId } = parseTranscriptionDownloadInput(input)
    await transcriptionService.deleteModel(modelId)
  })
  ipcMain.handle('transcription:start', (event, input: unknown) => {
    try {
      const payload = parseTranscriptionStartInput(input)
      transcriptionService.runJob(payload, event.sender).catch((err) => {
        console.error('Unhandled transcriptionService.runJob error:', err)
      })
      return { ok: true as const }
    } catch (error) {
      console.error('transcription:start failed before runJob:', error)
      throw error
    }
  })
  ipcMain.handle('transcription:cancel', () => {
    transcriptionService.cancel()
    return { ok: true as const }
  })
  ipcMain.handle('transcription:getStatus', () => transcriptionService.getStatus())
  ipcMain.handle('transcription:getDiagnostics', () => transcriptionService.getDiagnostics())
  ipcMain.handle('transcription:appendNotebook', (_, text: unknown) => {
    const value = requireString(text, 'Transcript text')
    if (!projectService.getMeta()) {
      throw new Error('Open a project first')
    }
    const doc = projectService.appendNotebookPlainText(value)
    windowManager.notifyProjectChanged()
    return doc
  })
  ipcMain.handle('transcription:saveAs', (_, text: unknown) =>
    transcriptionService.saveTranscriptAs(requireString(text, 'Transcript text')),
  )
  ipcMain.handle('transcription:saveToArchive', (_, input: { name: string; content: string }) => {
    const name = requireString(input.name, 'Transcript name')
    const content = requireString(input.content, 'Transcript content')
    const result = projectService.saveTranscriptionToArchive(name, content)
    windowManager.notifyProjectChanged()
    return result
  })

  // Transcription Library
  ipcMain.handle('transcription:library:folders:list', () => {
    return projectService.listTranscriptionFolders()
  })
  ipcMain.handle('transcription:library:folders:create', (_, name: string, parentPath?: string | null) => {
    const result = projectService.createTranscriptionFolder(
      requireString(name, 'Transcription folder name'),
      nullableString(parentPath, 'Transcription folder parent path'),
    )
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle(
    'transcription:library:folders:update',
    (_, currentPath: string, input: { name?: string; color?: SceneColor; parentPath?: string | null }) => {
      const result = projectService.updateTranscriptionFolder(
        requireString(currentPath, 'Transcription folder path'),
        parseFolderUpdateInput(input),
      )
      windowManager.notifyProjectChanged()
      return result
    },
  )
  ipcMain.handle('transcription:library:folders:delete', (_, currentPath: string) => {
    const result = projectService.deleteTranscriptionFolder(requireString(currentPath, 'Transcription folder path'))
    windowManager.notifyProjectChanged()
    return result
  })

  ipcMain.handle('transcription:library:items:list', () => {
    return projectService.listTranscriptionItems()
  })
  ipcMain.handle('transcription:library:items:create', (_, input: { name: string; content: string; folder?: string; sourceFilePath?: string | null }) => {
    const payload = {
      name: requireString(input.name, 'Item name'),
      content: requireString(input.content, 'Content'),
      folder: input.folder !== undefined ? optionalString(input.folder, 'Transcription folder path') ?? '' : '',
      sourceFilePath: nullableString(input.sourceFilePath, 'Source file path'),
    }
    const result = projectService.createTranscriptionItem(payload)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('transcription:library:items:update', (_, input: unknown) => {
    const payload = requireTranscriptionItemUpdateInput(input)
    const result = projectService.updateTranscriptionItem(payload)
    windowManager.notifyProjectChanged()
    return result
  })
  ipcMain.handle('transcription:library:items:delete', (_, id: string) => {
    projectService.deleteTranscriptionItem(requireString(id, 'Item id'))
    windowManager.notifyProjectChanged()
  })
}
