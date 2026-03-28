import fs from 'node:fs'
import path from 'node:path'

import { app, BrowserWindow, nativeImage } from 'electron'

import { registerIpc } from './ipc'
import { ProjectService } from './project-service'

const projectService = new ProjectService()
let mainWindow: BrowserWindow | null = null
let pendingProjectToOpen: string | null = null

function createWindow() {
  const iconPath = resolveRuntimeIconPath()
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1280,
    minHeight: 820,
    backgroundColor: '#0f1117',
    icon: iconPath,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    const appPath = app.isPackaged ? app.getAppPath() : process.cwd()
    void mainWindow.loadFile(path.join(appPath, 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  pendingProjectToOpen = filePath

  if (app.isReady()) {
    void openProjectFile(filePath)
  }
})

app.whenReady().then(() => {
  registerIpc(projectService)
  applyDockIcon()
  createWindow()
  if (pendingProjectToOpen) {
    void openProjectFile(pendingProjectToOpen)
    pendingProjectToOpen = null
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  projectService.close()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function resolveRuntimeIconPath() {
  const appPath = app.isPackaged ? process.resourcesPath : process.cwd()
  const candidates = [
    path.join(appPath, 'build', 'icon.png'),
    path.join(appPath, 'Grafikk', 'appikon.png'),
  ]

  return candidates.find((candidate) => fs.existsSync(candidate))
}

function applyDockIcon() {
  if (process.platform !== 'darwin') {
    return
  }

  const iconPath = resolveRuntimeIconPath()
  if (!iconPath) {
    return
  }

  if (app.dock) {
    app.dock.setIcon(nativeImage.createFromPath(iconPath))
  }
}

async function openProjectFile(filePath: string) {
  await projectService.openProject(filePath)

  if (!mainWindow) {
    createWindow()
  }

  mainWindow?.show()
  mainWindow?.focus()
}
