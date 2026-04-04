import { createHash } from 'node:crypto'
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { app } from 'electron'
import ffmpegStatic from 'ffmpeg-static'

import type { MediaInspection, MediaKind } from '@/types/media'

import { userInstalledFfmpegPath, userInstalledFfprobePath } from './transcription-ffmpeg-install'

const MAX_DIRECTORY_PREVIEW_ITEMS = 24
const MAX_DIRECTORY_SCAN_DEPTH = 3
const PROXY_DIR_NAMES = ['Proxy', 'Proxies', 'proxy', 'proxies']
const VIDEO_EXTENSIONS = new Set(['3gp', 'avi', 'braw', 'm4v', 'mkv', 'mov', 'mp4', 'mxf', 'ts', 'webm'])
const AUDIO_EXTENSIONS = new Set(['aac', 'aif', 'aiff', 'flac', 'm4a', 'mp3', 'wav'])
const IMAGE_EXTENSIONS = new Set(['avif', 'gif', 'heic', 'jpeg', 'jpg', 'png', 'tif', 'tiff', 'webp'])
const PROXY_PREFERRED_EXTENSIONS = ['mp4', 'mov', 'm4v', 'mkv', 'webm']
const PROXY_SUFFIXES = ['', '_Proxy', '_proxy', '-Proxy', '-proxy', ' Proxy', ' proxy']

type ProbeMetadata = {
  durationSeconds: number | null
  width: number | null
  height: number | null
  frameRate: number | null
  videoCodec: string | null
  audioCodec: string | null
  containerFormat: string | null
  timecode: string | null
}

function emptyProbeMetadata(): ProbeMetadata {
  return {
    durationSeconds: null,
    width: null,
    height: null,
    frameRate: null,
    videoCodec: null,
    audioCodec: null,
    containerFormat: null,
    timecode: null,
  }
}

export class MediaService {
  inspectSources(paths: string[]): MediaInspection[] {
    return inspectMediaSources(paths, { ffprobePath: resolveFfprobePath(), previewCacheRoot: getPreviewCacheRoot() })
  }

  async createPreviewProxy(filePath: string): Promise<MediaInspection> {
    const inputPath = path.resolve(filePath)
    if (!fs.existsSync(inputPath)) {
      throw new Error('Media file not found')
    }

    const stats = fs.statSync(inputPath)
    if (!stats.isFile()) {
      throw new Error('Preview proxy can only be generated for files')
    }

    const mediaKind = inferMediaKind(inputPath)
    if (mediaKind !== 'video') {
      throw new Error('Preview proxy is only supported for video files')
    }

    const ffmpegPath = resolveFfmpegPath()
    if (!ffmpegPath) {
      throw new Error('FFmpeg is not available for preview proxy generation')
    }

    const previewCacheRoot = getPreviewCacheRoot()
    fs.mkdirSync(previewCacheRoot, { recursive: true })
    const outputPath = buildPreviewProxyPath(inputPath, stats, previewCacheRoot)

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
      await runFfmpegPreviewProxy(ffmpegPath, inputPath, outputPath)
    }

    return inspectMediaSources([inputPath], {
      ffprobePath: resolveFfprobePath(),
      previewCacheRoot,
    })[0]
  }
}

export function inspectMediaSources(
  paths: string[],
  options: { ffprobePath?: string | null; previewCacheRoot?: string | null } = {},
): MediaInspection[] {
  const ffprobePath = options.ffprobePath ?? null
  const previewCacheRoot = options.previewCacheRoot ?? null
  return paths
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => inspectMediaPath(entry, ffprobePath, previewCacheRoot))
}

function inspectMediaPath(rawPath: string, ffprobePath: string | null, previewCacheRoot: string | null): MediaInspection {
  const inputPath = path.resolve(rawPath)
  const normalizedPath = normalizePath(inputPath)
  const displayName = path.basename(inputPath) || normalizedPath

  if (!fs.existsSync(inputPath)) {
    return {
      requestedPath: rawPath,
      normalizedPath,
      displayName,
      exists: false,
      pathKind: 'missing',
      mediaKind: 'missing',
      playable: false,
      fileSize: null,
      playbackMode: 'unavailable',
      playbackPath: null,
      proxyPath: null,
      playableChildCount: 0,
      playableChildPaths: [],
      ...emptyProbeMetadata(),
    }
  }

  const stats = fs.statSync(inputPath)
  if (stats.isDirectory()) {
    const playableChildPaths = collectPlayableDirectoryEntries(inputPath, MAX_DIRECTORY_SCAN_DEPTH, MAX_DIRECTORY_PREVIEW_ITEMS)
    return {
      requestedPath: rawPath,
      normalizedPath,
      displayName,
      exists: true,
      pathKind: 'directory',
      mediaKind: 'directory',
      playable: playableChildPaths.length > 0,
      fileSize: null,
      playbackMode: playableChildPaths.length > 0 ? 'directory' : 'unavailable',
      playbackPath: null,
      proxyPath: null,
      playableChildCount: playableChildPaths.length,
      playableChildPaths,
      ...emptyProbeMetadata(),
    }
  }

  const mediaKind = inferMediaKind(inputPath)
  const playable = mediaKind === 'video' || mediaKind === 'audio'
  const proxyPath = mediaKind === 'video' ? findProxyPath(inputPath, stats, previewCacheRoot) : null
  const playbackPath = proxyPath ?? (playable ? normalizedPath : null)
  const playbackMode = proxyPath ? 'proxy' : playable ? 'direct' : 'unavailable'
  const probeTarget = playbackPath ? denormalizePath(playbackPath) : inputPath
  const metadata = playable ? probeFileMetadata(probeTarget, ffprobePath) : emptyProbeMetadata()

  return {
    requestedPath: rawPath,
    normalizedPath,
    displayName,
    exists: true,
    pathKind: 'file',
    mediaKind,
    playable,
    fileSize: stats.size,
    playbackMode,
    playbackPath,
    proxyPath,
    playableChildCount: 0,
    playableChildPaths: [],
    ...metadata,
  }
}

function collectPlayableDirectoryEntries(dirPath: string, maxDepth: number, limit: number): string[] {
  const collected: string[] = []
  collectPlayableDirectoryEntriesInner(dirPath, maxDepth, limit, collected)
  return collected
}

function collectPlayableDirectoryEntriesInner(
  dirPath: string,
  remainingDepth: number,
  limit: number,
  collected: string[],
) {
  if (remainingDepth === 0 || collected.length >= limit) return

  let entries: string[]
  try {
    entries = fs.readdirSync(dirPath).map((entry) => path.join(dirPath, entry))
  } catch {
    return
  }

  entries.sort((left, right) => normalizePath(left).localeCompare(normalizePath(right)))

  for (const entryPath of entries) {
    if (collected.length >= limit) break

    let stats: fs.Stats
    try {
      stats = fs.statSync(entryPath)
    } catch {
      continue
    }

    if (stats.isDirectory()) {
      collectPlayableDirectoryEntriesInner(entryPath, remainingDepth - 1, limit, collected)
      continue
    }

    const mediaKind = inferMediaKind(entryPath)
    if (mediaKind === 'video' || mediaKind === 'audio') {
      collected.push(normalizePath(entryPath))
    }
  }
}

function inferMediaKind(filePath: string): MediaKind {
  const extension = path.extname(filePath).slice(1).toLowerCase()
  if (!extension) return 'other'
  if (VIDEO_EXTENSIONS.has(extension)) return 'video'
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio'
  if (IMAGE_EXTENSIONS.has(extension)) return 'image'
  return 'other'
}

function findProxyPath(originalPath: string, stats: fs.Stats, previewCacheRoot: string | null): string | null {
  const parent = path.dirname(originalPath)
  const grandparent = path.dirname(parent)
  const stem = path.basename(originalPath, path.extname(originalPath))
  const originalExtension = path.extname(originalPath).slice(1).toLowerCase()

  const candidateDirs = [parent, ...PROXY_DIR_NAMES.map((name) => path.join(parent, name))]
  if (grandparent && grandparent !== parent) {
    candidateDirs.push(...PROXY_DIR_NAMES.map((name) => path.join(grandparent, name)))
  }

  const preferredExtensions = [
    ...(originalExtension ? [originalExtension] : []),
    ...PROXY_PREFERRED_EXTENSIONS.filter((entry) => entry !== originalExtension),
  ]

  for (const dirPath of candidateDirs) {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) continue

    let fileEntries: string[]
    try {
      fileEntries = fs.readdirSync(dirPath)
    } catch {
      continue
    }

    for (const suffix of PROXY_SUFFIXES) {
      for (const extension of preferredExtensions) {
        const targetName = `${stem}${suffix}.${extension}`.toLowerCase()
        const match = fileEntries.find((entry) => entry.toLowerCase() === targetName)
        if (!match) continue

        const candidate = path.join(dirPath, match)
        if (!samePath(originalPath, candidate)) {
          return normalizePath(candidate)
        }
      }
    }
  }

  if (previewCacheRoot) {
    const cachedProxyPath = buildPreviewProxyPath(originalPath, stats, previewCacheRoot)
    if (fs.existsSync(cachedProxyPath) && fs.statSync(cachedProxyPath).isFile()) {
      return normalizePath(cachedProxyPath)
    }
  }

  return null
}

function samePath(left: string, right: string): boolean {
  try {
    return fs.realpathSync(left) === fs.realpathSync(right)
  } catch {
    return normalizePath(left) === normalizePath(right)
  }
}

function probeFileMetadata(filePath: string, ffprobePath: string | null): ProbeMetadata {
  if (!ffprobePath) return emptyProbeMetadata()

  const output = spawnSync(
    ffprobePath,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    { encoding: 'utf8' },
  )
  if (output.status !== 0 || !output.stdout) return emptyProbeMetadata()

  try {
    const payload = JSON.parse(output.stdout) as {
      format?: { duration?: string; format_name?: string; tags?: Record<string, string> }
      streams?: Array<{
        codec_type?: string
        codec_name?: string
        width?: number
        height?: number
        avg_frame_rate?: string
        r_frame_rate?: string
        tags?: Record<string, string>
      }>
    }

    const result = emptyProbeMetadata()
    result.durationSeconds = parseNullableFloat(payload.format?.duration)
    result.containerFormat = payload.format?.format_name ?? null
    result.timecode = extractTimecode(payload.format?.tags ?? null)

    for (const stream of payload.streams ?? []) {
      if (stream.codec_type === 'video' && result.videoCodec == null) {
        result.videoCodec = stream.codec_name ?? null
        result.width = Number.isFinite(stream.width) ? stream.width ?? null : null
        result.height = Number.isFinite(stream.height) ? stream.height ?? null : null
        result.frameRate = parseRate(stream.avg_frame_rate ?? stream.r_frame_rate ?? null)
        if (result.timecode == null) {
          result.timecode = extractTimecode(stream.tags ?? null)
        }
      }
      if (stream.codec_type === 'audio' && result.audioCodec == null) {
        result.audioCodec = stream.codec_name ?? null
      }
    }

    return result
  } catch {
    return emptyProbeMetadata()
  }
}

function extractTimecode(tags: Record<string, string> | null): string | null {
  if (!tags) return null
  return tags.timecode ?? tags.TIMECODE ?? null
}

function parseRate(raw: string | null): number | null {
  if (!raw) return null
  const [left, right] = raw.split('/')
  const numerator = Number.parseFloat(left)
  const denominator = Number.parseFloat(right)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null
  return numerator / denominator
}

function parseNullableFloat(raw: string | undefined): number | null {
  if (!raw) return null
  const parsed = Number.parseFloat(raw)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll('\\', '/')
}

function denormalizePath(filePath: string): string {
  return process.platform === 'win32' ? filePath.replaceAll('/', '\\') : filePath
}

function resolveFfprobePath(): string | null {
  const userDataPath = app.getPath('userData')
  const installed = userInstalledFfprobePath(path.join(userDataPath, 'whisper'))
  if (installed) return installed
  if (commandExists('ffprobe')) return 'ffprobe'
  return null
}

function resolveFfmpegPath(): string | null {
  if (typeof ffmpegStatic === 'string' && fs.existsSync(ffmpegStatic)) {
    return ffmpegStatic
  }
  const userDataPath = app.getPath('userData')
  const installed = userInstalledFfmpegPath(path.join(userDataPath, 'whisper'))
  if (installed) return installed
  if (commandExists('ffmpeg')) return 'ffmpeg'
  return null
}

function getPreviewCacheRoot(): string {
  return path.join(app.getPath('userData'), 'media-preview-cache')
}

function buildPreviewProxyPath(inputPath: string, stats: fs.Stats, previewCacheRoot: string): string {
  const hash = createHash('sha256')
    .update(path.resolve(inputPath))
    .update(String(stats.size))
    .update(String(stats.mtimeMs))
    .digest('hex')
    .slice(0, 16)
  const baseName = path.basename(inputPath, path.extname(inputPath)).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 48) || 'media'
  return path.join(previewCacheRoot, `${baseName}-${hash}.mp4`)
}

function runFfmpegPreviewProxy(ffmpegPath: string, inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const outputDir = path.dirname(outputPath)
    fs.mkdirSync(outputDir, { recursive: true })

    const args = [
      '-y',
      '-i',
      inputPath,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-vf',
      'scale=min(1280,iw):-2',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-movflags',
      '+faststart',
      outputPath,
    ]

    const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''

    proc.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
      if (stderr.length > 4000) {
        stderr = stderr.slice(-4000)
      }
    })

    proc.on('error', (error) => reject(error))
    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve()
        return
      }
      reject(new Error(stderr.trim() || `ffmpeg exited with ${code}`))
    })
  })
}

function commandExists(command: string): boolean {
  const checker = process.platform === 'win32' ? 'where' : 'which'
  const result = spawnSync(checker, [command], { stdio: 'ignore' })
  return result.status === 0
}
