export const TRANSCRIPTION_DRAG_IDS_MIME = 'application/x-narralab-transcription-items'
export const TRANSCRIPTION_DRAG_ID_MIME = 'application/x-narralab-transcription-item'
const TRANSCRIPTION_DRAG_TEXT_PREFIX = 'narralab-transcription-items:'

export function writeTranscriptionDragData(dataTransfer: DataTransfer, itemIds: string[]) {
  const normalized = itemIds.filter(
    (value) => typeof value === 'string' && value.startsWith('tx_item_'),
  )
  if (normalized.length === 0) {
    return
  }

  dataTransfer.setData(TRANSCRIPTION_DRAG_IDS_MIME, JSON.stringify(normalized))
  dataTransfer.setData(TRANSCRIPTION_DRAG_ID_MIME, normalized[0])
  dataTransfer.setData('text/plain', `${TRANSCRIPTION_DRAG_TEXT_PREFIX}${JSON.stringify(normalized)}`)
  dataTransfer.effectAllowed = 'copyMove'
}

export function readTranscriptionDragData(dataTransfer: DataTransfer): string[] {
  const rawIds = dataTransfer.getData(TRANSCRIPTION_DRAG_IDS_MIME)
  if (rawIds) {
    try {
      const parsed = JSON.parse(rawIds)
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (value): value is string => typeof value === 'string' && value.startsWith('tx_item_'),
        )
      }
    } catch {
      // Fall through to single item and text/plain parsing.
    }
  }

  const singleId = dataTransfer.getData(TRANSCRIPTION_DRAG_ID_MIME)
  if (singleId && singleId.startsWith('tx_item_')) {
    return [singleId]
  }

  const textPayload = dataTransfer.getData('text/plain')
  if (textPayload.startsWith(TRANSCRIPTION_DRAG_TEXT_PREFIX)) {
    try {
      const parsed = JSON.parse(textPayload.slice(TRANSCRIPTION_DRAG_TEXT_PREFIX.length))
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (value): value is string => typeof value === 'string' && value.startsWith('tx_item_'),
        )
      }
    } catch {
      return []
    }
  }

  return []
}

/** Prefer main-process drag session (reliable in Electron); fall back to dataTransfer on drop. */
export function getDraggedTranscriptionItemIds(dataTransfer: DataTransfer): string[] {
  const session = window.narralab.windows.getDragSession()
  if (session?.kind === 'transcription') {
    return session.itemIds
  }
  return readTranscriptionDragData(dataTransfer)
}
