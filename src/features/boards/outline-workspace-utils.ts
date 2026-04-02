import { readSceneDragData } from '@/lib/scene-drag'

export function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized

  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function getDraggedSceneIds(dataTransfer: DataTransfer) {
  const session = window.narralab.windows.getDragSession()
  if (session?.kind === 'scene') {
    return session.sceneIds
  }

  return readSceneDragData(dataTransfer)
}

export async function resolveDraggedSceneIds(dataTransfer: DataTransfer, consume = false) {
  const nativeIds = readSceneDragData(dataTransfer)
  if (nativeIds.length > 0) {
    if (consume) {
      void window.narralab.windows.setDragSession(null)
    }
    return nativeIds
  }

  const session = consume
    ? await window.narralab.windows.consumeDragSession()
    : await window.narralab.windows.readDragSession()
  if (session?.kind === 'scene') {
    return session.sceneIds
  }

  return []
}
