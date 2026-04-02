import { createRequire } from 'node:module'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createGunzip } from 'node:zlib'
import { PassThrough } from 'node:stream'

function ffmpegStaticReleaseTag(): string {
  try {
    const require = createRequire(import.meta.url)
    const pkg = require('ffmpeg-static/package.json') as { 'ffmpeg-static'?: { 'binary-release-tag'?: string } }
    const tag = pkg['ffmpeg-static']?.['binary-release-tag']
    return typeof tag === 'string' && tag.length ? tag : 'b6.0'
  } catch {
    return 'b6.0'
  }
}

function platformDownloadSuffix(): string | null {
  const p = process.platform
  const a = process.arch
  if (p === 'darwin' && a === 'arm64') {
    return 'darwin-arm64'
  }
  if (p === 'darwin' && a === 'x64') {
    return 'darwin-x64'
  }
  if (p === 'win32' && a === 'x64') {
    return 'win32-x64'
  }
  if (p === 'win32' && a === 'ia32') {
    return 'win32-ia32'
  }
  if (p === 'linux' && a === 'x64') {
    return 'linux-x64'
  }
  if (p === 'linux' && a === 'arm64') {
    return 'linux-arm64'
  }
  if (p === 'linux' && a === 'arm') {
    return 'linux-arm'
  }
  return null
}

export function isFfmpegAutoInstallSupported(): boolean {
  return platformDownloadSuffix() !== null
}

export function userInstalledFfmpegPath(whisperRoot: string): string | null {
  const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const p = path.join(whisperRoot, 'ffmpeg', 'bin', name)
  return fs.existsSync(p) ? p : null
}

export function userInstalledFfprobePath(whisperRoot: string): string | null {
  const name = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe'
  const p = path.join(whisperRoot, 'ffmpeg', 'bin', name)
  return fs.existsSync(p) ? p : null
}

async function downloadBinary(params: {
  url: string
  destPath: string
  onProgress?: (received: number, total: number | null) => void
}): Promise<void> {
  const partial = `${params.destPath}.partial`
  await fsPromises.rm(partial, { force: true }).catch(() => {})

  const res = await fetch(params.url, { redirect: 'follow' })
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status}) from ${params.url}`)
  }

  const len = res.headers.get('content-length')
  const total = len ? Number(len) : null
  let received = 0

  const pass = new PassThrough()
  const reader = res.body.getReader()

  const pump = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          pass.end()
          break
        }
        if (value?.byteLength) {
          received += value.byteLength
          params.onProgress?.(received, Number.isFinite(total as number) ? (total as number) : null)
          pass.write(Buffer.from(value))
        }
      }
    } catch (err) {
      pass.destroy(err instanceof Error ? err : new Error(String(err)))
    }
  }

  const ws = createWriteStream(partial)
  const pumpPromise = pump()
  try {
    await pipeline(pass, createGunzip(), ws)
    await pumpPromise
  } catch (e) {
    try { await reader.cancel() } catch { /* ignore */ }
    pass.destroy()
    await fsPromises.rm(partial, { force: true }).catch(() => {})
    await pumpPromise.catch(() => {})
    throw e
  }

  await fsPromises.rename(partial, params.destPath)
  try {
    fs.chmodSync(params.destPath, 0o755)
  } catch {
    // Windows or read-only FS
  }
}

export async function installUserFfmpeg(params: {
  whisperRoot: string
  onProgress: (received: number, total: number | null) => void
}): Promise<void> {
  const suffix = platformDownloadSuffix()
  if (!suffix) {
    throw new Error('Automatic FFmpeg install is not supported on this CPU/OS combination.')
  }

  const tag = ffmpegStaticReleaseTag()
  await fsPromises.mkdir(params.whisperRoot, { recursive: true })
  const binDir = path.join(params.whisperRoot, 'ffmpeg', 'bin')
  await fsPromises.mkdir(binDir, { recursive: true })

  const ext = process.platform === 'win32' ? '.exe' : ''

  // Download ffmpeg
  const ffmpegUrl = `https://github.com/eugeneware/ffmpeg-static/releases/download/${tag}/ffmpeg-${suffix}.gz`
  await downloadBinary({
    url: ffmpegUrl,
    destPath: path.join(binDir, `ffmpeg${ext}`),
    onProgress: params.onProgress,
  })

  // Also download ffprobe (same release, best-effort — don't fail if missing)
  const ffprobeUrl = `https://github.com/eugeneware/ffmpeg-static/releases/download/${tag}/ffprobe-${suffix}.gz`
  try {
    await downloadBinary({ url: ffprobeUrl, destPath: path.join(binDir, `ffprobe${ext}`) })
  } catch {
    // ffprobe is optional — TC extraction simply won't be available
  }
}
