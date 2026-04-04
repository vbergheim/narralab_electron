import type { MediaInspection } from '@/types/media'
import type { MediaPanelSource, MediaPreviewKind } from '@/types/media-player'

export function formatDurationSeconds(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '—'
  const totalSeconds = Math.max(0, Math.round(value))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatResolution(inspection: MediaInspection | null) {
  if (!inspection?.width || !inspection.height) return '—'
  return `${inspection.width} × ${inspection.height}`
}

export function formatFrameRate(inspection: MediaInspection | null) {
  if (!inspection?.frameRate) return '—'
  return `${inspection.frameRate.toFixed(2)} fps`
}

export function inferMediaPreviewKind(
  source: Pick<MediaPanelSource, 'previewKind' | 'extension'>,
  inspection: MediaInspection | null,
): MediaPreviewKind {
  if (inspection?.mediaKind === 'video' || inspection?.mediaKind === 'audio' || inspection?.mediaKind === 'image') {
    return inspection.mediaKind
  }
  if (source.previewKind === 'video' || source.previewKind === 'audio' || source.previewKind === 'image') {
    return source.previewKind
  }

  const extension = source.extension.toLowerCase()
  if (['mxf', 'mkv', 'webm', 'ts', '3gp', 'braw', 'mp4', 'mov', 'm4v', 'avi'].includes(extension)) return 'video'
  if (['aac', 'flac', 'mp3', 'wav', 'm4a', 'aiff'].includes(extension)) return 'audio'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg'].includes(extension)) return 'image'
  return 'other'
}

export function isInlinePreviewKind(value: string): value is 'video' | 'audio' | 'image' {
  return value === 'video' || value === 'audio' || value === 'image'
}

export function toFileUrl(filePath: string) {
  const normalized = filePath.replaceAll('\\', '/')
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`)
  }
  return encodeURI(`file://${normalized}`)
}

export function formatFileSize(size: number) {
  if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  if (size >= 1024) return `${Math.round(size / 1024)} KB`
  return `${size} B`
}
