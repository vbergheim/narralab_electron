import { describe, expect, it, vi } from 'vitest'

import { createNarraLabApi } from '../../electron/preload/api'

describe('createNarraLabApi', () => {
  it('does not expose the removed refreshProject bridge', () => {
    const listeners = new Map<string, (event: unknown, payload: unknown) => void>()
    const api = createNarraLabApi(
      {
        invoke: vi.fn(),
        on: vi.fn((channel: string, listener: (event: unknown, payload: unknown) => void) => {
          listeners.set(channel, listener)
        }),
        removeListener: vi.fn(),
      },
      {
        getPathForFile: vi.fn(() => null),
      },
    )

    expect('refreshProject' in api.windows).toBe(false)
    expect(listeners.has('windows:event')).toBe(true)
  })

  it('caches drag session updates from window events', async () => {
    const listeners = new Map<string, (event: unknown, payload: unknown) => void>()
    const ipcRenderer = {
      invoke: vi.fn(async (channel: string, payload?: unknown) =>
        channel === 'windows:consumeDragSession' ? { kind: 'scene', sceneIds: ['scene-1'] } : payload ?? null,
      ),
      on: vi.fn((channel: string, listener: (event: unknown, payload: unknown) => void) => {
        listeners.set(channel, listener)
      }),
      removeListener: vi.fn(),
    }

    const api = createNarraLabApi(ipcRenderer, {
      getPathForFile: vi.fn(() => null),
    })

    expect(api.windows.getDragSession()).toBeNull()

    listeners.get('windows:event')?.(null, {
      type: 'drag-session',
      payload: { kind: 'scene', sceneIds: ['scene-1'] },
    })

    expect(api.windows.getDragSession()).toEqual({ kind: 'scene', sceneIds: ['scene-1'] })
    expect(await api.windows.consumeDragSession()).toEqual({ kind: 'scene', sceneIds: ['scene-1'] })
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('windows:consumeDragSession')
  })

  it('resolves dropped file paths through webUtils', () => {
    const fileA = {} as File
    const fileB = {} as File
    const webUtils = {
      getPathForFile: vi
        .fn()
        .mockReturnValueOnce('/tmp/a.txt')
        .mockReturnValueOnce(null),
    }

    const api = createNarraLabApi(
      {
        invoke: vi.fn(),
        on: vi.fn(),
        removeListener: vi.fn(),
      },
      webUtils,
    )

    expect(api.archive.items.resolveDroppedPaths([fileA, fileB])).toEqual(['/tmp/a.txt'])
  })
})
