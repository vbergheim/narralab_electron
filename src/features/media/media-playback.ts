import type { MediaInspection } from '@/types/media'

export function getPreferredPlaybackPath(entry: MediaInspection | null): string | null {
  if (!entry?.playable) return null
  if (entry.playbackPath) return entry.playbackPath
  if (entry.pathKind === 'directory') {
    return entry.playableChildPaths[0] ?? null
  }
  return null
}

export function isPlayableVideo(entry: MediaInspection | null): boolean {
  return entry?.playable === true && entry.mediaKind === 'video'
}
