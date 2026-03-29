export const SCENE_DRAG_IDS_MIME = 'application/x-narralab-scenes'
export const SCENE_DRAG_ID_MIME = 'application/x-narralab-scene'
const SCENE_DRAG_TEXT_PREFIX = 'narralab-scenes:'

export function writeSceneDragData(dataTransfer: DataTransfer, sceneIds: string[]) {
  const normalized = sceneIds.filter((value) => typeof value === 'string' && value.trim().length > 0)
  if (normalized.length === 0) {
    return
  }

  dataTransfer.setData(SCENE_DRAG_IDS_MIME, JSON.stringify(normalized))
  dataTransfer.setData(SCENE_DRAG_ID_MIME, normalized[0])
  dataTransfer.setData('text/plain', `${SCENE_DRAG_TEXT_PREFIX}${JSON.stringify(normalized)}`)
}

export function readSceneDragData(dataTransfer: DataTransfer) {
  const rawIds = dataTransfer.getData(SCENE_DRAG_IDS_MIME)
  if (rawIds) {
    try {
      const parsed = JSON.parse(rawIds)
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      }
    } catch {
      // Fall through to single item and text/plain parsing.
    }
  }

  const singleId = dataTransfer.getData(SCENE_DRAG_ID_MIME)
  if (singleId) {
    return [singleId]
  }

  const textPayload = dataTransfer.getData('text/plain')
  if (textPayload.startsWith(SCENE_DRAG_TEXT_PREFIX)) {
    try {
      const parsed = JSON.parse(textPayload.slice(SCENE_DRAG_TEXT_PREFIX.length))
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      }
    } catch {
      return []
    }
  }

  return []
}
