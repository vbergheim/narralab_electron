import { describe, expect, it } from 'vitest'

import { buildBrowserWindowOptions, isAllowedAppNavigation } from '../../electron/main/browser-window-policy'

describe('browser window policy', () => {
  it('builds hardened BrowserWindow options for the main window', () => {
    const options = buildBrowserWindowOptions({
      title: 'NarraLab',
      workspace: 'main',
      preloadPath: '/tmp/preload.js',
      icon: '/tmp/icon.png',
    })

    expect(options.minWidth).toBe(980)
    expect(options.minHeight).toBe(720)
    expect(options.webPreferences).toMatchObject({
      preload: '/tmp/preload.js',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    })
  })

  it('uses compact minimum bounds for detached windows', () => {
    const options = buildBrowserWindowOptions({
      title: 'Detached Outline',
      workspace: 'outline',
      preloadPath: '/tmp/preload.js',
      bounds: { x: 10, y: 20, width: 900, height: 700 },
    })

    expect(options.minWidth).toBe(220)
    expect(options.minHeight).toBe(180)
    expect(options.x).toBe(10)
    expect(options.y).toBe(20)
    expect(options.width).toBe(900)
    expect(options.height).toBe(700)
  })

  it('allows only same-origin navigation in dev mode', () => {
    expect(
      isAllowedAppNavigation('http://localhost:5173/projects/1', 'http://localhost:5173'),
    ).toBe(true)
    expect(
      isAllowedAppNavigation('https://example.com/phish', 'http://localhost:5173'),
    ).toBe(false)
    expect(
      isAllowedAppNavigation('notaurl', 'http://localhost:5173'),
    ).toBe(false)
  })

  it('allows only local file navigation in packaged mode', () => {
    expect(isAllowedAppNavigation('file:///Applications/NarraLab/index.html')).toBe(true)
    expect(isAllowedAppNavigation('https://example.com')).toBe(false)
  })
})
