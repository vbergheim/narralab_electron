import type { BrowserWindowConstructorOptions } from 'electron'

import type { WindowWorkspace } from '@/types/ai'

type CreateBrowserWindowOptionsInput = {
  title: string
  workspace: WindowWorkspace | 'main'
  preloadPath: string
  icon?: string
  bounds?: { x: number; y: number; width: number; height: number }
}

export function buildBrowserWindowOptions(
  input: CreateBrowserWindowOptionsInput,
): BrowserWindowConstructorOptions {
  const isMainWindow = input.workspace === 'main'
  const minWidth = isMainWindow ? 980 : 220
  const minHeight = isMainWindow ? 720 : 180

  return {
    width: input.bounds?.width ?? 1600,
    height: input.bounds?.height ?? 980,
    x: input.bounds?.x,
    y: input.bounds?.y,
    minWidth,
    minHeight,
    backgroundColor: '#0f1117',
    icon: input.icon,
    title: input.title,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: input.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  }
}

export function isAllowedAppNavigation(navigationUrl: string, devServerUrl?: string) {
  if (devServerUrl) {
    try {
      return new URL(navigationUrl).origin === new URL(devServerUrl).origin
    } catch {
      return false
    }
  }

  return navigationUrl.startsWith('file://')
}
