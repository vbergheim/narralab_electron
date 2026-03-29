import fs from 'node:fs'
import path from 'node:path'

import { app, BrowserWindow, nativeImage } from 'electron'

import { AIConsultantService } from './ai-consultant-service'
import { AppSettingsService } from './app-settings-service'
import { registerIpc } from './ipc'
import { ProjectService } from './project-service'
import { WindowManager } from './window-manager'

const projectService = new ProjectService()
const settingsService = new AppSettingsService()
const consultantService = new AIConsultantService(projectService, settingsService)
let mainWindow: BrowserWindow | null = null
let pendingProjectToOpen: string | null = null
const windowManager = new WindowManager(settingsService, projectService, createBrowserWindow)

function createMainWindow() {
  if (mainWindow) {
    return mainWindow
  }

  mainWindow = createBrowserWindow({ title: 'DocuDoc', workspace: 'main' })
  windowManager.registerMainWindow(mainWindow)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  return mainWindow
}

function createBrowserWindow(input: {
  title: string
  workspace: 'main' | 'outline' | 'bank' | 'inspector' | 'notebook' | 'archive'
  bounds?: { x: number; y: number; width: number; height: number }
}) {
  const iconPath = resolveRuntimeIconPath()
  const isInspector = input.workspace === 'inspector'
  const isNotebook = input.workspace === 'notebook' || input.workspace === 'archive'
  const browserWindow = new BrowserWindow({
    width: input.bounds?.width ?? 1600,
    height: input.bounds?.height ?? 980,
    x: input.bounds?.x,
    y: input.bounds?.y,
    minWidth: isInspector ? 420 : isNotebook ? 760 : 980,
    minHeight: isInspector ? 560 : 720,
    backgroundColor: '#0f1117',
    icon: iconPath,
    title: input.title,
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
    void browserWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    const appPath = app.isPackaged ? app.getAppPath() : process.cwd()
    void browserWindow.loadFile(path.join(appPath, 'dist', 'index.html'))
  }

  return browserWindow
}

app.on('open-file', (event, filePath) => {
  event.preventDefault()
  pendingProjectToOpen = filePath

  if (app.isReady()) {
    void openProjectFile(filePath)
  }
})

app.whenReady().then(() => {
  registerIpc(projectService, settingsService, consultantService, windowManager)
  applyDockIcon()
  createMainWindow()
  if (pendingProjectToOpen) {
    void openProjectFile(pendingProjectToOpen)
    pendingProjectToOpen = null
  } else {
    void windowManager.restoreLastProjectAndLayout(openProjectFile)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
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
  windowManager.notifyProjectChanged()

  if (!mainWindow) {
    createMainWindow()
  }

  mainWindow?.show()
  mainWindow?.focus()
}
