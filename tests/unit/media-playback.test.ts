import { describe, expect, it } from 'vitest'

import { getPreferredPlaybackPath, isPlayableVideo } from '@/features/media/media-playback'
import type { MediaInspection } from '@/types/media'

function makeInspection(overrides: Partial<MediaInspection> = {}): MediaInspection {
  return {
    requestedPath: '/tmp/A001_01.MXF',
    normalizedPath: '/tmp/A001_01.MXF',
    displayName: 'A001_01.MXF',
    exists: true,
    pathKind: 'file',
    mediaKind: 'video',
    playable: true,
    fileSize: 10,
    playbackMode: 'direct',
    playbackPath: '/tmp/A001_01.MXF',
    proxyPath: null,
    playableChildCount: 0,
    playableChildPaths: [],
    durationSeconds: null,
    width: null,
    height: null,
    frameRate: null,
    videoCodec: null,
    audioCodec: null,
    containerFormat: null,
    timecode: null,
    ...overrides,
  }
}

describe('media playback helpers', () => {
  it('prefers the resolved playback path for direct files', () => {
    expect(getPreferredPlaybackPath(makeInspection())).toBe('/tmp/A001_01.MXF')
  })

  it('falls back to the first playable child for directories', () => {
    const entry = makeInspection({
      pathKind: 'directory',
      mediaKind: 'directory',
      playbackMode: 'directory',
      playbackPath: null,
      playableChildCount: 2,
      playableChildPaths: ['/tmp/day_01/clip01.mov', '/tmp/day_01/clip02.mov'],
    })

    expect(getPreferredPlaybackPath(entry)).toBe('/tmp/day_01/clip01.mov')
  })

  it('recognises video-only playback entries', () => {
    expect(isPlayableVideo(makeInspection())).toBe(true)
    expect(isPlayableVideo(makeInspection({ mediaKind: 'audio' }))).toBe(false)
  })
})
