import { contextBridge, ipcRenderer, webUtils } from 'electron'

import { createNarraLabApi } from './api'

contextBridge.exposeInMainWorld('narralab', createNarraLabApi(ipcRenderer, webUtils))
