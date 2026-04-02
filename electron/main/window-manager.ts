import { BrowserWindow, screen } from 'electron'

import type { AppSettingsService } from './app-settings-service'
import type { ProjectService } from './project-service'
import type { AppSettings, SavedWindowLayout, WindowWorkspace } from '@/types/ai'
import type { BoardViewMode } from '@/types/board'
import type { GlobalUiState, ProjectChangeScope, WindowContext, WindowDragSession } from '@/types/project'

type WindowRecord = {
  browserWindow: BrowserWindow
  context: WindowContext
}

type BrowserFactoryInput = {
  title: string
  workspace: WindowWorkspace | 'main'
  bounds?: { x: number; y: number; width: number; height: number }
}

type BrowserFactory = (input: BrowserFactoryInput) => BrowserWindow

const DEFAULT_GLOBAL_UI_STATE: GlobalUiState = {
  activeBoardId: null,
  selectedArchiveFolderId: null,
  selectedTranscriptionItemId: null,
}

export class WindowManager {
  private readonly windows = new Map<number, WindowRecord>()
  private globalUiState: GlobalUiState = DEFAULT_GLOBAL_UI_STATE
  private dragSession: WindowDragSession = null
  private projectRevision = 0
  private readonly settingsService: AppSettingsService
  private readonly projectService: ProjectService
  private readonly browserFactory: BrowserFactory

  constructor(settingsService: AppSettingsService, projectService: ProjectService, browserFactory: BrowserFactory) {
    this.settingsService = settingsService
    this.projectService = projectService
    this.browserFactory = browserFactory
  }

  registerMainWindow(browserWindow: BrowserWindow) {
    const settings = this.settingsService.getSettings()
    const context: WindowContext = {
      windowId: browserWindow.webContents.id,
      role: 'main',
      workspace: 'main',
      boardId: null,
      viewMode: settings.ui.defaultBoardView,
      sceneDensity: settings.ui.defaultSceneDensity,
    }

    this.attachWindow(browserWindow, context)
    return context
  }

  getContext(windowId: number): WindowContext {
    return this.windows.get(windowId)?.context ?? this.buildFallbackContext(windowId)
  }

  listContexts() {
    return Array.from(this.windows.values()).map((record) => record.context)
  }

  updateContext(windowId: number, input: Partial<Pick<WindowContext, 'boardId' | 'viewMode' | 'sceneDensity'>>) {
    const record = this.windows.get(windowId)
    if (!record) {
      throw new Error('Window not found')
    }

    record.context = {
      ...record.context,
      ...input,
    }

    this.broadcast({
      type: 'window-context',
      payload: record.context,
    })

    return record.context
  }

  async openWorkspace(
    workspace: WindowWorkspace,
    options?: Partial<Pick<WindowContext, 'boardId' | 'viewMode' | 'sceneDensity'>>,
  ) {
    const settings = this.settingsService.getSettings()
    const browserWindow = this.browserFactory({
      title: `NarraLab · ${workspaceLabel(workspace)}`,
      workspace,
      bounds: this.resolveWindowBounds(undefined),
    })

    const context: WindowContext = {
      windowId: browserWindow.webContents.id,
      role: 'detached',
      workspace,
      boardId: options?.boardId ?? this.globalUiState.activeBoardId ?? null,
      viewMode: options?.viewMode ?? this.resolveDefaultBoardView(settings),
      sceneDensity: options?.sceneDensity ?? settings.ui.defaultSceneDensity,
    }

    this.attachWindow(browserWindow, context)
    return context
  }

  getGlobalUiState() {
    return this.globalUiState
  }

  getDragSession() {
    return this.dragSession
  }

  consumeDragSession() {
    const session = this.dragSession
    this.dragSession = null
    this.broadcast({
      type: 'drag-session',
      payload: this.dragSession,
    })
    return session
  }

  updateDragSession(session: WindowDragSession) {
    this.dragSession = normalizeDragSession(session)
    this.broadcast({
      type: 'drag-session',
      payload: this.dragSession,
    })
    return this.dragSession
  }

  updateGlobalUiState(input: Partial<GlobalUiState>) {
    this.globalUiState = {
      ...this.globalUiState,
      ...input,
    }

    this.broadcast({
      type: 'global-ui-state',
      payload: this.globalUiState,
    })

    return this.globalUiState
  }

  notifyProjectChanged(scopes: ProjectChangeScope[] = ['all']) {
    const normalizedScopes = normalizeProjectChangeScopes(scopes)
    const meta = this.projectService.getMeta()
    if (meta && (normalizedScopes.includes('all') || normalizedScopes.includes('meta'))) {
      this.settingsService.updateSettings({ lastProjectPath: meta.path })
    }

    this.dragSession = null
    this.projectRevision += 1

    this.broadcast({
      type: 'project-changed',
      payload: {
        revision: this.projectRevision,
        scopes: normalizedScopes,
      },
    })
  }

  listLayouts() {
    return this.settingsService.getSettings().ui.savedLayouts
  }

  saveLayout(name: string) {
    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('Layout name cannot be empty')
    }

    const settings = this.settingsService.getSettings()
    const existing = settings.ui.savedLayouts.filter((layout) => layout.name !== trimmedName)
    const now = new Date().toISOString()
    const layout: SavedWindowLayout = {
      id: `layout_${Math.random().toString(36).slice(2, 10)}`,
      name: trimmedName,
      createdAt: now,
      updatedAt: now,
      windows: Array.from(this.windows.values())
        .filter((record) => record.context.role === 'detached')
        .map((record, index) => {
          const bounds = record.browserWindow.getBounds()
          const display = screen.getDisplayMatching(bounds)
          return {
            id: `${record.context.workspace}_${index}`,
            workspace: record.context.workspace as WindowWorkspace,
            boardId: record.context.boardId,
            viewMode: record.context.viewMode,
            sceneDensity: record.context.sceneDensity,
            bounds,
            displayId: display?.id ?? null,
          }
        }),
    }

    const nextLayouts = [...existing, layout]
    this.settingsService.updateSettings({
      savedLayouts: nextLayouts,
      lastLayoutByProject: this.updateProjectLayoutMap(settings, layout.id),
    })

    return layout
  }

  async applyLayout(layoutId: string) {
    const settings = this.settingsService.getSettings()
    const layout = settings.ui.savedLayouts.find((entry) => entry.id === layoutId) ?? null
    if (!layout) {
      return null
    }

    this.closeDetachedWindows()
    for (const layoutWindow of layout.windows) {
      const browserWindow = this.browserFactory({
        title: `NarraLab · ${workspaceLabel(layoutWindow.workspace)}`,
        workspace: layoutWindow.workspace,
        bounds: this.resolveWindowBounds(layoutWindow),
      })

      const context: WindowContext = {
        windowId: browserWindow.webContents.id,
        role: 'detached',
        workspace: layoutWindow.workspace,
        boardId: layoutWindow.boardId,
        viewMode: layoutWindow.viewMode,
        sceneDensity: layoutWindow.sceneDensity,
      }

      this.attachWindow(browserWindow, context)
    }

    this.settingsService.updateSettings({
      lastLayoutByProject: this.updateProjectLayoutMap(settings, layout.id),
    })

    return layout
  }

  deleteLayout(layoutId: string) {
    const settings = this.settingsService.getSettings()
    const nextLayouts = settings.ui.savedLayouts.filter((layout) => layout.id !== layoutId)
    const nextMap = { ...settings.ui.lastLayoutByProject }
    Object.keys(nextMap).forEach((projectPath) => {
      if (nextMap[projectPath] === layoutId) {
        delete nextMap[projectPath]
      }
    })
    this.settingsService.updateSettings({
      savedLayouts: nextLayouts,
      lastLayoutByProject: nextMap,
    })
    return nextLayouts
  }

  async restoreLastProjectAndLayout(openProject: (projectPath: string) => Promise<void>) {
    const settings = this.settingsService.getSettings()
    if (!settings.ui.restoreLastProject || !settings.ui.lastProjectPath) {
      return
    }

    await openProject(settings.ui.lastProjectPath)

    if (!settings.ui.restoreLastLayout) {
      return
    }

    const layoutId = settings.ui.lastLayoutByProject[settings.ui.lastProjectPath]
    if (layoutId) {
      await this.applyLayout(layoutId)
    }
  }

  private attachWindow(browserWindow: BrowserWindow, context: WindowContext) {
    const windowId = browserWindow.webContents.id
    this.windows.set(windowId, { browserWindow, context })

    const updateBounds = () => {
      const record = this.windows.get(windowId)
      if (!record) {
        return
      }
      record.context = { ...record.context }
      this.broadcast({
        type: 'window-context',
        payload: record.context,
      })
    }

    browserWindow.on('move', updateBounds)
    browserWindow.on('resize', updateBounds)
    browserWindow.on('closed', () => {
      this.windows.delete(windowId)
    })
  }

  private closeDetachedWindows() {
    Array.from(this.windows.values())
      .filter((record) => record.context.role === 'detached')
      .forEach((record) => record.browserWindow.close())
  }

  private resolveWindowBounds(layoutWindow?: SavedWindowLayout['windows'][number]) {
    if (!layoutWindow) {
      const primary = screen.getPrimaryDisplay().workArea
      return {
        x: primary.x + 60,
        y: primary.y + 60,
        width: Math.min(1440, primary.width - 120),
        height: Math.min(960, primary.height - 120),
      }
    }

    const display =
      screen.getAllDisplays().find((entry) => entry.id === layoutWindow.displayId) ??
      screen.getPrimaryDisplay()
    const area = display.workArea

    return clampBounds(layoutWindow.bounds, area)
  }

  private updateProjectLayoutMap(settings: AppSettings, layoutId: string) {
    const projectPath = this.projectService.getMeta()?.path
    if (!projectPath) {
      return settings.ui.lastLayoutByProject
    }
    return {
      ...settings.ui.lastLayoutByProject,
      [projectPath]: layoutId,
    }
  }

  private buildFallbackContext(windowId: number): WindowContext {
    const settings = this.settingsService.getSettings()
    return {
      windowId,
      role: 'main',
      workspace: 'main',
      boardId: this.globalUiState.activeBoardId,
      viewMode: this.resolveDefaultBoardView(settings),
      sceneDensity: settings.ui.defaultSceneDensity,
    }
  }

  private broadcast(
    event:
      | { type: 'project-changed'; payload: { revision: number; scopes: ProjectChangeScope[] } }
      | { type: 'window-context'; payload: WindowContext }
      | { type: 'global-ui-state'; payload: GlobalUiState }
      | { type: 'drag-session'; payload: WindowDragSession },
  ) {
    this.windows.forEach((record, windowId) => {
      if (record.browserWindow.isDestroyed() || record.browserWindow.webContents.isDestroyed()) {
        this.windows.delete(windowId)
        return
      }

      try {
        record.browserWindow.webContents.send('windows:event', event)
      } catch {
        this.windows.delete(windowId)
      }
    })
  }

  private resolveDefaultBoardView(settings: AppSettings): BoardViewMode {
    try {
      return this.projectService.getProjectSettings().defaultBoardView
    } catch {
      return settings.ui.defaultBoardView
    }
  }
}

function clampBounds(
  bounds: { x: number; y: number; width: number; height: number },
  workArea: Electron.Rectangle,
) {
  const width = Math.min(bounds.width, workArea.width)
  const height = Math.min(bounds.height, workArea.height)
  return {
    x: Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width),
    y: Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height),
    width,
    height,
  }
}

function workspaceLabel(workspace: WindowWorkspace) {
  if (workspace === 'board-manager') return 'Board Manager'
  if (workspace === 'transcribe') return 'Transcribe'
  return workspace.charAt(0).toUpperCase() + workspace.slice(1)
}

function normalizeDragSession(session: WindowDragSession): WindowDragSession {
  if (!session) {
    return null
  }

  if (session.kind === 'scene') {
    const sceneIds = session.sceneIds.filter((value) => typeof value === 'string' && value.trim().length > 0)
    if (sceneIds.length === 0) {
      return null
    }
    return { kind: 'scene', sceneIds }
  }

  if (session.kind === 'transcription') {
    const itemIds = session.itemIds.filter((value) => typeof value === 'string' && value.startsWith('tx_item_'))
    if (itemIds.length === 0) {
      return null
    }
    return { kind: 'transcription', itemIds }
  }

  return null
}

function normalizeProjectChangeScopes(scopes: ProjectChangeScope[]): ProjectChangeScope[] {
  if (scopes.length === 0) {
    return ['all']
  }

  return [...new Set(scopes)]
}
