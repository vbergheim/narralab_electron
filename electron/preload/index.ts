import { contextBridge, ipcRenderer } from 'electron'

import type { DocuDocApi } from '@/types/project'

const api: DocuDocApi = {
  project: {
    create: (path) => ipcRenderer.invoke('project:create', path),
    open: (path) => ipcRenderer.invoke('project:open', path),
    saveAs: (path) => ipcRenderer.invoke('project:saveAs', path),
    exportJson: (path) => ipcRenderer.invoke('project:exportJson', path),
    exportBoardScript: (boardId, path, format) => ipcRenderer.invoke('project:exportBoardScript', boardId, path, format),
    importJson: (path) => ipcRenderer.invoke('project:importJson', path),
    getMeta: () => ipcRenderer.invoke('project:getMeta'),
  },
  notebook: {
    get: () => ipcRenderer.invoke('notebook:get'),
    update: (content) => ipcRenderer.invoke('notebook:update', content),
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
    addScene: (boardId, sceneId, afterItemId) => ipcRenderer.invoke('boards:addScene', boardId, sceneId, afterItemId),
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
  consultant: {
    chat: (input) => ipcRenderer.invoke('consultant:chat', input),
  },
  tags: {
    list: () => ipcRenderer.invoke('tags:list'),
    upsert: (input) => ipcRenderer.invoke('tags:upsert', input),
    delete: (id) => ipcRenderer.invoke('tags:delete', id),
  },
}

contextBridge.exposeInMainWorld('docudoc', api)
