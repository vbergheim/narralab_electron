export type MediaPlayerStatus = 'idle' | 'opening' | 'installing' | 'playing' | 'paused' | 'error'

export type MediaPreviewKind = 'video' | 'audio' | 'image' | 'other'

export type MediaPlayerViewport = {
  x: number
  y: number
  width: number
  height: number
}

export type MediaPanelSource = {
  id: string
  name: string
  filePath: string
  exists: boolean
  fileSize: number
  extension: string
  kindLabel: string
  previewKind: MediaPreviewKind
}

export type MediaPlayerState = {
  available: boolean
  connected: boolean
  status: MediaPlayerStatus
  embedded: boolean
  currentPath: string | null
  durationSeconds: number | null
  positionSeconds: number | null
  volume: number | null
  fullscreen: boolean
  error: string | null
  installUrl: string
  installHint: string | null
}

export type MediaPlayerEvent = {
  type: 'state'
  payload: MediaPlayerState
}
