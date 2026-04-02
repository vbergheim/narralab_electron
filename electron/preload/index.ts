import { contextBridge, ipcRenderer, webUtils } from 'electron'

import type { NarraLabApi } from '@/types/project'

let currentDragSession: NarraLabApi['windows'] extends { getDragSession(): infer T } ? T : null = null

ipcRenderer.on('windows:event', (_event, payload) => {
  if (payload?.type === 'drag-session') {
    currentDragSession = payload.payload
  }
})

const api: NarraLabApi = {
  project: {
    create: (path) => ipcRenderer.invoke('project:create', path),
    open: (path) => ipcRenderer.invoke('project:open', path),
    saveAs: (path) => ipcRenderer.invoke('project:saveAs', path),
    exportJson: (path) => ipcRenderer.invoke('project:exportJson', path),
    exportBoardScript: (boardId, path, format) => ipcRenderer.invoke('project:exportBoardScript', boardId, path, format),
    importJson: (path) => ipcRenderer.invoke('project:importJson', path),
    importShootLog: (path) => ipcRenderer.invoke('project:importShootLog', path),
    getMeta: () => ipcRenderer.invoke('project:getMeta'),
    getSettings: () => ipcRenderer.invoke('project:getSettings'),
    updateSettings: (input) => ipcRenderer.invoke('project:updateSettings', input),
  },
  notebook: {
    get: () => ipcRenderer.invoke('notebook:get'),
    update: (document) => ipcRenderer.invoke('notebook:update', document),
  },
  archive: {
    folders: {
      list: () => ipcRenderer.invoke('archive:folders:list'),
      create: (name, parentId) => ipcRenderer.invoke('archive:folders:create', name, parentId),
      rename: (folderId, name) => ipcRenderer.invoke('archive:folders:rename', folderId, name),
      update: (input) => ipcRenderer.invoke('archive:folders:update', input),
      delete: (folderId) => ipcRenderer.invoke('archive:folders:delete', folderId),
    },
    items: {
      list: () => ipcRenderer.invoke('archive:items:list'),
      add: (filePaths, folderId) => ipcRenderer.invoke('archive:items:add', filePaths, folderId),
      resolveDroppedPaths: (files) =>
        Array.from(files)
          .map((file) => webUtils.getPathForFile(file))
          .filter(Boolean),
      update: (input) => ipcRenderer.invoke('archive:items:update', input),
      delete: (itemId) => ipcRenderer.invoke('archive:items:delete', itemId),
      open: (itemId) => ipcRenderer.invoke('archive:items:open', itemId),
      reveal: (itemId) => ipcRenderer.invoke('archive:items:reveal', itemId),
    },
  },
  scenes: {
    list: () => ipcRenderer.invoke('scenes:list'),
    create: () => ipcRenderer.invoke('scenes:create'),
    update: (input) => ipcRenderer.invoke('scenes:update', input),
    delete: (id) => ipcRenderer.invoke('scenes:delete', id),
    reorder: (sceneIds) => ipcRenderer.invoke('scenes:reorder', sceneIds),
  },
  sceneBeats: {
    create: (sceneId, afterBeatId) => ipcRenderer.invoke('sceneBeats:create', sceneId, afterBeatId),
    update: (input) => ipcRenderer.invoke('sceneBeats:update', input),
    delete: (id) => ipcRenderer.invoke('sceneBeats:delete', id),
    reorder: (sceneId, beatIds) => ipcRenderer.invoke('sceneBeats:reorder', sceneId, beatIds),
  },
  sceneFolders: {
    list: () => ipcRenderer.invoke('sceneFolders:list'),
    create: (name, parentPath) => ipcRenderer.invoke('sceneFolders:create', name, parentPath),
    update: (currentPath, input) => ipcRenderer.invoke('sceneFolders:update', currentPath, input),
    delete: (currentPath) => ipcRenderer.invoke('sceneFolders:delete', currentPath),
  },
  boards: {
    list: () => ipcRenderer.invoke('boards:list'),
    create: (name, folder) => ipcRenderer.invoke('boards:create', name, folder),
    delete: (boardId) => ipcRenderer.invoke('boards:delete', boardId),
    createClone: (sourceBoardId, name) => ipcRenderer.invoke('boards:createClone', sourceBoardId, name),
    updateBoard: (input) => ipcRenderer.invoke('boards:updateBoard', input),
    reorderBoards: (boardIds) => ipcRenderer.invoke('boards:reorderBoards', boardIds),
    addScene: (boardId, sceneId, afterItemId, boardPosition) =>
      ipcRenderer.invoke('boards:addScene', boardId, sceneId, afterItemId, boardPosition),
    addBlock: (boardId, kind, afterItemId) => ipcRenderer.invoke('boards:addBlock', boardId, kind, afterItemId),
    duplicateItem: (itemId) => ipcRenderer.invoke('boards:duplicateItem', itemId),
    removeItem: (itemId) => ipcRenderer.invoke('boards:removeItem', itemId),
    reorder: (boardId, itemIds) => ipcRenderer.invoke('boards:reorder', boardId, itemIds),
    updateItem: (input) => ipcRenderer.invoke('boards:updateItem', input),
  },
  boardFolders: {
    list: () => ipcRenderer.invoke('boardFolders:list'),
    create: (name, parentPath) => ipcRenderer.invoke('boardFolders:create', name, parentPath),
    rename: (oldPath, newName) => ipcRenderer.invoke('boardFolders:rename', oldPath, newName),
    update: (currentPath, input) => ipcRenderer.invoke('boardFolders:update', currentPath, input),
    delete: (currentPath) => ipcRenderer.invoke('boardFolders:delete', currentPath),
  },
  blockTemplates: {
    list: () => ipcRenderer.invoke('blockTemplates:list'),
    create: (input) => ipcRenderer.invoke('blockTemplates:create', input),
    delete: (id) => ipcRenderer.invoke('blockTemplates:delete', id),
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (input) => ipcRenderer.invoke('settings:update', input),
  },
  windows: {
    getContext: () => ipcRenderer.invoke('windows:getContext'),
    listContexts: () => ipcRenderer.invoke('windows:listContexts'),
    openWorkspace: (workspace, options) => ipcRenderer.invoke('windows:openWorkspace', workspace, options),
    updateContext: (input) => ipcRenderer.invoke('windows:updateContext', input),
    getDragSession: () => currentDragSession,
    readDragSession: () => ipcRenderer.invoke('windows:getDragSession'),
    consumeDragSession: async () => {
      currentDragSession = await ipcRenderer.invoke('windows:consumeDragSession')
      return currentDragSession
    },
    setDragSession: (session) => {
      currentDragSession = session
      return ipcRenderer.invoke('windows:setDragSession', session)
    },
    getGlobalUiState: () => ipcRenderer.invoke('windows:getGlobalUiState'),
    updateGlobalUiState: (input) => ipcRenderer.invoke('windows:updateGlobalUiState', input),
    listLayouts: () => ipcRenderer.invoke('windows:listLayouts'),
    saveLayout: (name) => ipcRenderer.invoke('windows:saveLayout', name),
    applyLayout: (layoutId) => ipcRenderer.invoke('windows:applyLayout', layoutId),
    deleteLayout: (layoutId) => ipcRenderer.invoke('windows:deleteLayout', layoutId),
    subscribe: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) =>
        listener(payload)
      ipcRenderer.on('windows:event', handler)
      return () => {
        ipcRenderer.removeListener('windows:event', handler)
      }
    },
  },
  consultant: {
    chat: (input) => ipcRenderer.invoke('consultant:chat', input),
  },
  tags: {
    list: () => ipcRenderer.invoke('tags:list'),
    upsert: (input) => ipcRenderer.invoke('tags:upsert', input),
    delete: (id) => ipcRenderer.invoke('tags:delete', id),
  },
  transcription: {
    pickFile: () => ipcRenderer.invoke('transcription:pickFile'),
    getSetup: () => ipcRenderer.invoke('transcription:getSetup'),
    downloadEngine: () => ipcRenderer.invoke('transcription:downloadEngine'),
    downloadFfmpeg: () => ipcRenderer.invoke('transcription:downloadFfmpeg'),
    downloadModel: (modelId) => ipcRenderer.invoke('transcription:downloadModel', { modelId }),
    deleteModel: (modelId) => ipcRenderer.invoke('transcription:deleteModel', { modelId }),
    start: (input) => ipcRenderer.invoke('transcription:start', input),
    cancel: () => ipcRenderer.invoke('transcription:cancel'),
    getStatus: () => ipcRenderer.invoke('transcription:getStatus'),
    getDiagnostics: () => ipcRenderer.invoke('transcription:getDiagnostics'),
    appendNotebook: (text) => ipcRenderer.invoke('transcription:appendNotebook', text),
    saveAs: (text) => ipcRenderer.invoke('transcription:saveAs', text),
    saveToArchive: (input) => ipcRenderer.invoke('transcription:saveToArchive', input),
    subscribe: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof listener>[0]) =>
        listener(payload)
      ipcRenderer.on('transcription:event', handler)
      return () => {
        ipcRenderer.removeListener('transcription:event', handler)
      }
    },
    library: {
      folders: {
        list: () => ipcRenderer.invoke('transcription:library:folders:list'),
        create: (name, parentPath) => ipcRenderer.invoke('transcription:library:folders:create', name, parentPath),
        update: (currentPath, input) =>
          ipcRenderer.invoke('transcription:library:folders:update', currentPath, input),
        delete: (currentPath) => ipcRenderer.invoke('transcription:library:folders:delete', currentPath),
      },
      items: {
        list: () => ipcRenderer.invoke('transcription:library:items:list'),
        create: (input) => ipcRenderer.invoke('transcription:library:items:create', input),
        update: (input) => ipcRenderer.invoke('transcription:library:items:update', input),
        delete: (itemId) => ipcRenderer.invoke('transcription:library:items:delete', itemId),
      },
    },
  },
}

contextBridge.exposeInMainWorld('narralab', api)
