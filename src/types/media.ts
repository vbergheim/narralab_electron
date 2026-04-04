export type MediaPathKind = 'file' | 'directory' | 'missing'
export type MediaKind = 'video' | 'audio' | 'image' | 'other' | 'directory' | 'missing'
export type MediaPlaybackMode = 'direct' | 'proxy' | 'directory' | 'unavailable'

export type MediaInspection = {
  requestedPath: string
  normalizedPath: string
  displayName: string
  exists: boolean
  pathKind: MediaPathKind
  mediaKind: MediaKind
  playable: boolean
  fileSize: number | null
  playbackMode: MediaPlaybackMode
  playbackPath: string | null
  proxyPath: string | null
  playableChildCount: number
  playableChildPaths: string[]
  durationSeconds: number | null
  width: number | null
  height: number | null
  frameRate: number | null
  videoCodec: string | null
  audioCodec: string | null
  containerFormat: string | null
  timecode: string | null
}
