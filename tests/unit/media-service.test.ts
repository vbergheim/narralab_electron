import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { inspectMediaSources } from '../../electron/main/media-service'

describe('inspectMediaSources', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('detects proxy media in a sibling Proxy directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'narralab-media-'))
    tempDirs.push(root)
    const original = path.join(root, 'A001_01.MXF')
    const proxyDir = path.join(root, 'Proxy')
    const proxy = path.join(proxyDir, 'A001_01.mp4')

    fs.mkdirSync(proxyDir, { recursive: true })
    fs.writeFileSync(original, 'original')
    fs.writeFileSync(proxy, 'proxy')

    const [inspection] = inspectMediaSources([original], { ffprobePath: null })

    expect(inspection.mediaKind).toBe('video')
    expect(inspection.playbackMode).toBe('proxy')
    expect(inspection.proxyPath).toBe(proxy)
    expect(inspection.playbackPath).toBe(proxy)
  })

  it('collects playable entries from nested directories', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'narralab-media-'))
    tempDirs.push(root)
    const nested = path.join(root, 'day_01')

    fs.mkdirSync(nested, { recursive: true })
    fs.writeFileSync(path.join(nested, 'clip01.mov'), 'video')
    fs.writeFileSync(path.join(nested, 'clip01.wav'), 'audio')
    fs.writeFileSync(path.join(nested, 'notes.txt'), 'text')

    const [inspection] = inspectMediaSources([root], { ffprobePath: null })

    expect(inspection.pathKind).toBe('directory')
    expect(inspection.playable).toBe(true)
    expect(inspection.playableChildCount).toBe(2)
    expect(inspection.playableChildPaths.some((entry) => entry.endsWith('clip01.mov'))).toBe(true)
    expect(inspection.playableChildPaths.some((entry) => entry.endsWith('clip01.wav'))).toBe(true)
  })

  it('marks missing paths as unavailable', () => {
    const missing = path.join(os.tmpdir(), 'narralab-missing-media.mov')

    const [inspection] = inspectMediaSources([missing], { ffprobePath: null })

    expect(inspection.exists).toBe(false)
    expect(inspection.pathKind).toBe('missing')
    expect(inspection.playbackMode).toBe('unavailable')
  })
})
