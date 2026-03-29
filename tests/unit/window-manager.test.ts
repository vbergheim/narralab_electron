import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WindowManager } from '../../electron/main/window-manager'
import type { AppSettings } from '@/types/ai'
import type { WindowDragSession } from '@/types/project'

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
})
