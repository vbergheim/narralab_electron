import { contextBridge, ipcRenderer } from 'electron'

import type { DocuDocApi } from '@/types/project'

const api: DocuDocApi = {
  project: {
    create: (path) => ipcRenderer.invoke('project:create', path),
    open: (path) => ipcRenderer.invoke('project:open', path),
    saveAs: (path) => ipcRenderer.invoke('project:saveAs', path),
    exportJson: (path) => ipcRenderer.invoke('project:exportJson', path),
    importJson: (path) => ipcRenderer.invoke('project:importJson', path),
    getMeta: () => ipcRenderer.invoke('project:getMeta'),
  },
  notebook: {
    get: () => ipcRenderer.invoke('notebook:get'),
    update: (content) => ipcRenderer.invoke('notebook:update', content),
  },
  scenes: {
    list: () => ipcRenderer.invoke('scenes:list'),
    create: () => ipcRenderer.invoke('scenes:create'),
    update: (input) => ipcRenderer.invoke('scenes:update', input),
    delete: (id) => ipcRenderer.invoke('scenes:delete', id),
  },
  boards: {
    list: () => ipcRenderer.invoke('boards:list'),
    createClone: (sourceBoardId, name) => ipcRenderer.invoke('boards:createClone', sourceBoardId, name),
    updateBoard: (boardId, name) => ipcRenderer.invoke('boards:updateBoard', boardId, name),
    addScene: (boardId, sceneId, afterItemId) => ipcRenderer.invoke('boards:addScene', boardId, sceneId, afterItemId),
    addBlock: (boardId, kind, afterItemId) => ipcRenderer.invoke('boards:addBlock', boardId, kind, afterItemId),
    duplicateItem: (itemId) => ipcRenderer.invoke('boards:duplicateItem', itemId),
    removeItem: (itemId) => ipcRenderer.invoke('boards:removeItem', itemId),
    reorder: (boardId, itemIds) => ipcRenderer.invoke('boards:reorder', boardId, itemIds),
    updateItem: (input) => ipcRenderer.invoke('boards:updateItem', input),
  },
  tags: {
    list: () => ipcRenderer.invoke('tags:list'),
    upsert: (input) => ipcRenderer.invoke('tags:upsert', input),
    delete: (id) => ipcRenderer.invoke('tags:delete', id),
  },
}

contextBridge.exposeInMainWorld('docudoc', api)
