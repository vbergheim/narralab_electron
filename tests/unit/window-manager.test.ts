import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WindowManager } from '../../electron/main/window-manager'
import type { AppSettings } from '@/types/ai'
import type { ProjectChangedEvent, WindowDragSession } from '@/types/project'

vi.mock('electron', () => ({
  BrowserWindow: class BrowserWindow {},
  screen: {
    getPrimaryDisplay: () => ({
      id: 1,
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    }),
    getAllDisplays: () => [],
    getDisplayMatching: () => ({
      id: 1,
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
    }),
  },
}))

function buildSettings(): AppSettings {
  return {
    ai: {
      provider: 'openai',
      openAiModel: 'gpt-5-mini',
      geminiModel: 'gemini-2.5-flash',
      systemPrompt: '',
      extraInstructions: '',
      responseStyle: 'structured',
      secretStorageMode: 'safe',
      allowPlaintextSecrets: false,
      hasOpenAiApiKey: false,
      hasGeminiApiKey: false,
    },
    ui: {
      restoreLastProject: false,
      restoreLastLayout: false,
      defaultBoardView: 'outline',
      defaultSceneDensity: 'compact',
      defaultDetachedWorkspace: 'outline',
      lastProjectPath: null,
      lastLayoutByProject: {},
      savedLayouts: [],
      consultantLauncherPosition: null,
      consultantDialogSize: null,
      consultantDialogPosition: null,
    },
    transcription: {
      modelId: 'small',
      language: 'auto',
      timestampInterval: 'segment',
    },
  }
}

describe('WindowManager drag sessions', () => {
  const settings = buildSettings()
  const settingsService = {
    getSettings: vi.fn(() => settings),
    updateSettings: vi.fn(),
  }
  const projectService = {
    getMeta: vi.fn(() => null),
  }

  let windowManager: WindowManager

  function attachFakeWindow(windowId = 101) {
    const listeners = new Map<string, Array<() => void>>()
    const sentEvents: Array<ProjectChangedEvent | { type: 'drag-session'; payload: WindowDragSession }> = []
    const browserWindow = {
      webContents: {
        id: windowId,
        isDestroyed: () => false,
        send: (_channel: string, event: ProjectChangedEvent | { type: 'drag-session'; payload: WindowDragSession }) => {
          sentEvents.push(event)
        },
      },
      on: (event: string, handler: () => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), handler])
      },
      isDestroyed: () => false,
      getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    }

    windowManager.registerMainWindow(browserWindow as never)
    return { sentEvents }
  }

  beforeEach(() => {
    settingsService.getSettings.mockClear()
    settingsService.updateSettings.mockClear()
    projectService.getMeta.mockClear()
    windowManager = new WindowManager(
      settingsService as never,
      projectService as never,
      (() => {
        throw new Error('browserFactory should not be called in this test')
      }) as never,
    )
  })

  it('consumes drag sessions atomically', () => {
    const session: WindowDragSession = { kind: 'scene', sceneIds: ['scene-1', 'scene-2'] }

    windowManager.updateDragSession(session)

    expect(windowManager.getDragSession()).toEqual(session)
    expect(windowManager.consumeDragSession()).toEqual(session)
    expect(windowManager.getDragSession()).toBeNull()
  })

  it('clears drag sessions on project change notifications', () => {
    windowManager.updateDragSession({ kind: 'scene', sceneIds: ['scene-1'] })

    windowManager.notifyProjectChanged()

    expect(windowManager.getDragSession()).toBeNull()
  })

  it('broadcasts scoped project changes with monotonic revision numbers', () => {
    const { sentEvents } = attachFakeWindow()

    windowManager.notifyProjectChanged(['boards', 'tags'])
    windowManager.notifyProjectChanged(['layouts'])

    expect(sentEvents).toHaveLength(2)
    expect(sentEvents[0]).toEqual({
      type: 'project-changed',
      payload: {
        revision: 1,
        scopes: ['boards', 'tags'],
      },
    })
    expect(sentEvents[1]).toEqual({
      type: 'project-changed',
      payload: {
        revision: 2,
        scopes: ['layouts'],
      },
    })
  })

  it('uses shared active board state as the detached window default', async () => {
    const browserFactory = vi.fn((input: { workspace: string }) => ({
      webContents: {
        id: 202,
        isDestroyed: () => false,
        send: vi.fn(),
      },
      on: vi.fn(),
      isDestroyed: () => false,
      getBounds: () => ({ x: 0, y: 0, width: 800, height: 600 }),
      close: vi.fn(),
      __workspace: input.workspace,
    }))

    windowManager = new WindowManager(
      settingsService as never,
      projectService as never,
      browserFactory as never,
    )

    windowManager.updateGlobalUiState({ activeBoardId: 'board-42' })
    const context = await windowManager.openWorkspace('outline')

    expect(context.boardId).toBe('board-42')
    expect(context.workspace).toBe('outline')
  })
})
