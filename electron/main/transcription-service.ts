import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createWriteStream } from 'node:fs'

import type { WebContents } from 'electron'
import { app, dialog } from 'electron'
import ffmpegStatic from 'ffmpeg-static'

import {
  TRANSCRIPTION_MODEL_CATALOG,
  type TranscriptionLanguage,
  type TranscriptionMainDiagnostics,
  type TranscriptionModelCatalogEntry,
  type TranscriptionModelId,
  type TranscriptionStatus,
  type TranscriptionTimestampInterval,
} from '@/types/transcription'
import type { AppTranscriptionSettings } from '@/types/ai'

import type { AppSettingsService } from './app-settings-service'
import type { ProjectService } from './project-service'
import {
  bundledEngineCliPath,
  installTranscriptionEngine,
  isTranscriptionEngineAutoInstallSupported,
  repairDarwinWhisperEngineLibIfNeeded,
} from './transcription-engine-install'
import {
  installUserFfmpeg,
  isFfmpegAutoInstallSupported,
  userInstalledFfmpegPath,
  userInstalledFfprobePath,
} from './transcription-ffmpeg-install'

type ProgressSender = Pick<WebContents, 'send'>

/**
 * whisper-cli med -pp: `whisper_print_progress_callback: progress =  45%`
 * Vi prioriterer dette mønsteret så ikke tilfeldig «10%» i annen logg gir falsk stolpe.
 */
/** whisper-cli base name for `-of` (writes `narralab-out.txt` with `-otxt`). */
const WHISPER_OUTPUT_BASENAME = 'narralab-out'

/** whisper.cpp default is min(4, cores); vi bruker flere tråder på CPU for kortere kjøretid. */
function whisperThreadCount(): number {
  const n = os.cpus().length
  return Math.min(16, Math.max(1, n))
}

/**
 * macOS + Electron: whisper/ggml + OpenMP kan deadlock (0 % CPU, ingen stderr) med mange tråder.
 * Én tråd er tregere men stabilt i praksis.
 */
function whisperThreadCountForJob(): number {
  if (process.platform === 'darwin') {
    return 1
  }
  return whisperThreadCount()
}

/** Grov varighet (sek) av 16 kHz mono PCM i WAV (inkl. header — konservativ for timeout). */
function estimateWavPcmDurationSec(wavPath: string): number {
  try {
    const st = fs.statSync(wavPath)
    return Math.max(1, st.size / 32_000)
  } catch {
    return 60
  }
}

const DIAG_FFMPEG_MAX = 8_000
const DIAG_WHISPER_ERR_MAX = 16_000
const DIAG_WHISPER_OUT_MAX = 6_000

function appendDiagnosticTail(prev: string, chunk: string, maxChars: number): string {
  const next = prev + chunk
  return next.length <= maxChars ? next : next.slice(-maxChars)
}

function sanitizeEnvForWhisperChild(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out = { ...base }
  if (process.platform === 'darwin') {
    for (const k of Object.keys(out)) {
      if (k.startsWith('DYLD_')) {
        delete out[k]
      }
    }
  }
  return out
}

/** OpenMP/BLAS matcher whisper `-t`; DYLD_* fjernes på macOS så Electron ikke forvirrer dyld. */
function whisperSpawnEnv(threadCount: number): NodeJS.ProcessEnv {
  const t = String(threadCount)
  return {
    ...sanitizeEnvForWhisperChild(process.env),
    OMP_NUM_THREADS: t,
    OPENBLAS_NUM_THREADS: '1',
    MKL_NUM_THREADS: '1',
    VECLIB_MAXIMUM_THREADS: t,
    NUMEXPR_NUM_THREADS: t,
    OMP_WAIT_POLICY: 'passive',
  }
}

/**
 * macOS: kjør whisper under `env -i` så **ingen** Electron/Node-variabler arves (kan gi 0 % CPU-heng i native kode).
 * `KEY=value`-lista sendes som separate argv til `/usr/bin/env`.
 */
function darwinMinimalWhisperEnvAssignments(threadCount: number): string[] {
  const t = String(threadCount)
  const userPath = (process.env.PATH ?? '').trim()
  const pathVal = userPath ? `/usr/bin:/bin:/usr/sbin:/sbin:${userPath}` : '/usr/bin:/bin:/usr/sbin:/sbin'
  return [
    `PATH=${pathVal}`,
    `HOME=${process.env.HOME ?? ''}`,
    `TMPDIR=${process.env.TMPDIR ?? '/tmp'}`,
    `USER=${process.env.USER ?? ''}`,
    `LOGNAME=${process.env.LOGNAME ?? process.env.USER ?? ''}`,
    `LANG=${process.env.LANG ?? 'en_US.UTF-8'}`,
    `MallocNanoZone=0`,
    `OMP_NUM_THREADS=${t}`,
    `OPENBLAS_NUM_THREADS=1`,
    `MKL_NUM_THREADS=1`,
    `VECLIB_MAXIMUM_THREADS=${t}`,
    `NUMEXPR_NUM_THREADS=${t}`,
    `OMP_WAIT_POLICY=passive`,
  ]
}

function probeWhisperHelpBinary(whisperPath: string, threadCount: number): string {
  if (!fs.existsSync(whisperPath)) {
    return '(binary missing)'
  }
  try {
    if (process.platform === 'darwin' && fs.existsSync('/usr/bin/env')) {
      const assignments = darwinMinimalWhisperEnvAssignments(threadCount)
      const r = spawnSync('/usr/bin/env', ['-i', ...assignments, whisperPath, '-h'], {
        encoding: 'utf8',
        timeout: 8000,
        maxBuffer: 512 * 1024,
      })
      if (r.error) {
        return `error: ${r.error.message}`
      }
      const combined = `${r.stdout || ''}${r.stderr || ''}`
      const head = combined.slice(0, 200).replace(/\s+/g, ' ').trim()
      return `exit=${r.status} ioLen=${combined.length} head=${JSON.stringify(head)}`
    }
    const r = spawnSync(whisperPath, ['-h'], {
      encoding: 'utf8',
      timeout: 8000,
      maxBuffer: 512 * 1024,
      env: whisperSpawnEnv(threadCount),
    })
    if (r.error) {
      return `error: ${r.error.message}`
    }
    const combined = `${r.stdout || ''}${r.stderr || ''}`
    const head = combined.slice(0, 200).replace(/\s+/g, ' ').trim()
    return `exit=${r.status} ioLen=${combined.length} head=${JSON.stringify(head)}`
  } catch (e) {
    return e instanceof Error ? e.message : String(e)
  }
}

function spawnWhisperCli(
  whisperPath: string,
  whisperArgs: string[],
  cwd: string,
  threadCount: number,
  stdio: ['ignore' | 'pipe', 'pipe', 'pipe'],
): ChildProcess {
  if (process.platform === 'darwin' && fs.existsSync('/usr/bin/env')) {
    const assignments = darwinMinimalWhisperEnvAssignments(threadCount)
    return spawn('/usr/bin/env', ['-i', ...assignments, whisperPath, ...whisperArgs], {
      cwd,
      stdio,
    })
  }
  return spawn(whisperPath, whisperArgs, {
    cwd,
    stdio,
    env: whisperSpawnEnv(threadCount),
  })
}

function parseWhisperProgressFraction(combinedOutput: string): number | undefined {
  const precise = [...combinedOutput.matchAll(/progress\s*=\s*(\d{1,3})\s*%/gi)]
  if (precise.length > 0) {
    const n = parseInt(precise[precise.length - 1][1], 10)
    if (!Number.isNaN(n)) {
      return Math.min(1, Math.max(0, n / 100))
    }
  }
  const loose = [...combinedOutput.matchAll(/(\d{1,3})\s*%/g)]
  if (loose.length === 0) {
    return undefined
  }
  const n = parseInt(loose[loose.length - 1][1], 10)
  return Number.isNaN(n) ? undefined : Math.min(1, Math.max(0, n / 100))
}

export type TranscriptionStartPayload = {
  filePath: string
  modelId?: TranscriptionModelId
  language?: TranscriptionLanguage
  timestampInterval?: TranscriptionTimestampInterval
}

/**
 * Parse a SRT-formatted string into segments with start times in seconds.
 */
function parseSrtSegments(srt: string): Array<{ startSec: number; text: string }> {
  const segments: Array<{ startSec: number; text: string }> = []
  // Split on blank lines, each block is one subtitle entry
  const blocks = srt.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  for (const block of blocks) {
    const lines = block.split('\n')
    // find the timing line: 00:00:01,000 --> 00:00:04,500
    const timingLine = lines.find((l) => l.includes('-->'))
    if (!timingLine) continue
    const [startStr] = timingLine.split('-->')
    const startSec = srtTimeToSec(startStr.trim())
    // text is everything after the index and timing lines
    const textLines = lines.filter((l, i) => i > 0 && !l.includes('-->') && !/^\d+$/.test(l.trim()))
    const text = textLines.join(' ').trim()
    if (text) segments.push({ startSec, text })
  }
  return segments
}

function srtTimeToSec(t: string): number {
  // HH:MM:SS,mmm
  const m = t.match(/(\d+):(\d+):(\d+)[,.]?(\d*)/)
  if (!m) return 0
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const sec = parseInt(m[3], 10)
  const ms = parseInt((m[4] || '0').padEnd(3, '0').slice(0, 3), 10)
  return h * 3600 + min * 60 + sec + ms / 1000
}

function secToTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function buildTranscriptFromSrt(
  srt: string,
  interval: TranscriptionTimestampInterval,
  tcOffsetSec: number,
): string {
  const segments = parseSrtSegments(srt)
  if (segments.length === 0) return ''

  if (interval === 'none') {
    return segments.map((s) => s.text).join(' ').trim()
  }

  const intervalSec = typeof interval === 'number' ? interval : 0
  let lastEmittedSec = -Infinity
  const parts: string[] = []

  for (const seg of segments) {
    const realSec = seg.startSec + tcOffsetSec
    const shouldEmit = interval === 'segment' || realSec - lastEmittedSec >= intervalSec
    if (shouldEmit) {
      if (parts.length > 0) parts.push('')   // blank line before timestamp
      parts.push(`[${secToTimestamp(realSec)}]`)
      lastEmittedSec = realSec
    }
    parts.push(seg.text)
  }

  return parts.join('\n').trimEnd()
}

/**
 * Parse a SMPTE timecode string (HH:MM:SS:FF or HH:MM:SS.mmm or HH:MM:SS;FF) to seconds.
 * Returns null if the string cannot be parsed. Frame-rate assumed 25fps when frame number present.
 */
function parseSMPTETimecode(tc: string): number | null {
  // Match HH:MM:SS:FF or HH:MM:SS;FF (drop-frame) or HH:MM:SS.mmm
  const m = tc.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[:;,.](\d+)$/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const sec = parseInt(m[3], 10)
  const sub = m[4]
  // sub could be frame number (2 digits) or milliseconds (3 digits)
  const subSec = sub.length >= 3 ? parseInt(sub.slice(0, 3), 10) / 1000 : parseInt(sub, 10) / 25
  const total = h * 3600 + min * 60 + sec + subSec
  if (Number.isNaN(total)) return null
  return total
}

export class TranscriptionService {
  private readonly settingsService: AppSettingsService
  private readonly projectService: ProjectService
  private status: TranscriptionStatus = { phase: 'idle', message: '' }
  private ffmpegProc: ChildProcess | null = null
  private whisperProc: ChildProcess | null = null
  private progressSender: ProgressSender | null = null
  private cancelled = false
  private diagnosticFfmpegStderr = ''
  private diagnosticWhisperStderr = ''
  private diagnosticWhisperStdout = ''

  constructor(settingsService: AppSettingsService, projectService: ProjectService) {
    this.settingsService = settingsService
    this.projectService = projectService
  }

  getWhisperRoot() {
    return path.join(app.getPath('userData'), 'whisper')
  }

  getModelsDir() {
    return path.join(this.getWhisperRoot(), 'models')
  }

  getModelPath(modelId: TranscriptionModelId) {
    const entry = TRANSCRIPTION_MODEL_CATALOG.find((m) => m.id === modelId)
    if (!entry) {
      throw new Error('Unknown transcription model')
    }
    return path.join(this.getModelsDir(), entry.fileName)
  }

  isModelPresent(modelId: TranscriptionModelId) {
    try {
      return fs.existsSync(this.getModelPath(modelId))
    } catch {
      return false
    }
  }

  getCatalogState(): Array<TranscriptionModelCatalogEntry & { downloaded: boolean }> {
    return TRANSCRIPTION_MODEL_CATALOG.map((entry) => ({
      ...entry,
      downloaded: this.isModelPresent(entry.id),
    }))
  }

  getSetup(): {
    catalog: Array<TranscriptionModelCatalogEntry & { downloaded: boolean }>
    ffmpegPath: string | null
    ffprobePath: string | null
    whisperPath: string | null
    ffmpegAutoDownloadSupported: boolean
    engineAutoDownloadSupported: boolean
    settings: AppTranscriptionSettings
  } {
    const settings = this.settingsService.getSettings()
    return {
      catalog: this.getCatalogState(),
      ffmpegPath: this.resolveFfmpegPath(),
      ffprobePath: userInstalledFfprobePath(this.getWhisperRoot()),
      whisperPath: this.resolveWhisperCliPath(),
      ffmpegAutoDownloadSupported: isFfmpegAutoInstallSupported(),
      engineAutoDownloadSupported: isTranscriptionEngineAutoInstallSupported(),
      settings: settings.transcription,
    }
  }

  resolveFfmpegPath(): string | null {
    if (typeof ffmpegStatic === 'string' && ffmpegStatic.length) {
      if (ffmpegStatic.includes('app.asar')) {
        const unpackedPath = ffmpegStatic.replace('app.asar', 'app.asar.unpacked')
        if (fs.existsSync(unpackedPath)) {
          return unpackedPath
        }
      }
      if (fs.existsSync(ffmpegStatic)) {
        return ffmpegStatic
      }
    }

    const userDl = userInstalledFfmpegPath(this.getWhisperRoot())
    if (userDl) {
      return userDl
    }

    const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
    for (const dir of (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)) {
      const full = path.join(dir, name)
      try {
        if (fs.existsSync(full) && fs.statSync(full).isFile()) {
          return full
        }
      } catch {
        // continue
      }
    }

    return null
  }

  /**
   * Use ffprobe to read the embedded start timecode (SMPTE TC) from professional video files.
   * Returns the offset in seconds, or 0 if not present / ffprobe unavailable.
   * Supports: MOV, MP4, MXF (tmcd track or format tags).
   */
  async readStartTimecode(filePath: string): Promise<number> {
    const ffprobePath = userInstalledFfprobePath(this.getWhisperRoot())
    if (!ffprobePath) return 0
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const proc = spawn(ffprobePath, [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_streams',
          '-show_format',
          filePath,
        ], { stdio: ['ignore', 'pipe', 'ignore'] })
        let out = ''
        proc.stdout?.on('data', (chunk: Buffer) => { out += chunk.toString() })
        proc.on('error', reject)
        proc.on('close', () => resolve(out))
      })

      const json = JSON.parse(result) as {
        format?: { tags?: Record<string, string> }
        streams?: Array<{ tags?: Record<string, string>; codec_tag_string?: string }>
      }

      // Try format.tags.timecode first (most common)
      const fmtTc = json.format?.tags?.timecode ?? json.format?.tags?.TIMECODE
      if (fmtTc) {
        const sec = parseSMPTETimecode(fmtTc)
        if (sec !== null) return sec
      }

      // Try per-stream tags (streams with tmcd codec_tag or timecode tag)
      for (const stream of json.streams ?? []) {
        const streamTc = stream.tags?.timecode ?? stream.tags?.TIMECODE
        if (streamTc) {
          const sec = parseSMPTETimecode(streamTc)
          if (sec !== null) return sec
        }
      }
    } catch {
      // ffprobe failed or file has no TC; silently skip
    }
    return 0
  }

  resolveWhisperCliPath(): string | null {
    const binName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
    const root = this.getWhisperRoot()
    repairDarwinWhisperEngineLibIfNeeded(root)
    const engineBin = bundledEngineCliPath(root)
    if (engineBin) {
      return engineBin
    }

    const legacyBundled = path.join(this.getWhisperRoot(), 'bin', binName)
    if (fs.existsSync(legacyBundled)) {
      return legacyBundled
    }

    const candidates =
      process.platform === 'win32'
        ? ['whisper-cli.exe', 'whisper-cpp.exe', 'whisper-cpp.cmd']
        : ['whisper-cli', 'whisper-cpp', 'main']

    const pathDirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean)

    for (const dir of pathDirs) {
      for (const name of candidates) {
        const full = path.join(dir, name)
        try {
          if (fs.existsSync(full) && fs.statSync(full).isFile()) {
            return full
          }
        } catch {
          // continue
        }
      }
    }

    const homebrew = ['/opt/homebrew/bin/whisper-cli', '/opt/homebrew/bin/whisper-cpp', '/usr/local/bin/whisper-cli', '/usr/local/bin/whisper-cpp']
    for (const full of homebrew) {
      if (fs.existsSync(full)) {
        return full
      }
    }

    return null
  }

  async pickMediaFile(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: 'Choose audio or video',
      properties: ['openFile'],
      filters: [
        {
          name: 'Media',
          extensions: ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'mp4', 'mov', 'mkv', 'webm', 'avi'],
        },
        { name: 'All files', extensions: ['*'] },
      ],
    })

    if (result.canceled || !result.filePaths[0]) {
      return null
    }

    return result.filePaths[0]
  }

  getStatus(): TranscriptionStatus {
    return { ...this.status }
  }

  getDiagnostics(): TranscriptionMainDiagnostics {
    const { resultText, ...rest } = this.status
    const statusForDiag: TranscriptionStatus =
      resultText && resultText.length > 0
        ? { ...rest, resultText: `[utelatt – ${resultText.length} tegn]` }
        : { ...rest }

    const whisperCliPath = this.resolveWhisperCliPath()
    let whisperBinaryFileDescription = ''
    if (whisperCliPath && fs.existsSync(whisperCliPath)) {
      try {
        const r = spawnSync('/usr/bin/file', [whisperCliPath], { encoding: 'utf8', timeout: 5000 })
        whisperBinaryFileDescription = (r.stdout || r.stderr || '').trim().slice(0, 500)
      } catch {
        /* ignore */
      }
    }

    const whisperHelpProbe = whisperCliPath ? probeWhisperHelpBinary(whisperCliPath, 1) : '(no path)'

    return {
      appVersion: app.getVersion(),
      platform: process.platform,
      mainArch: process.arch,
      whisperCliPath,
      whisperBinaryFileDescription,
      whisperHelpProbe,
      status: statusForDiag,
      cancelled: this.cancelled,
      ffmpegChildRunning: this.ffmpegProc !== null,
      whisperChildRunning: this.whisperProc !== null,
      ffmpegStderrTail: this.diagnosticFfmpegStderr,
      whisperStderrTail: this.diagnosticWhisperStderr,
      whisperStdoutTail: this.diagnosticWhisperStdout,
    }
  }

  private emit(payload: TranscriptionStatus) {
    this.status = { ...payload }
    const target = this.progressSender
    if (!target) {
      return
    }
    try {
      target.send('transcription:event', { type: 'status', payload: this.status })
    } catch {
      // WebContents gone or channel unavailable
    }
  }

  private emitDownload(modelId: TranscriptionModelId, bytesReceived: number, totalBytes: number | null) {
    const target = this.progressSender
    if (!target) {
      return
    }
    try {
      target.send('transcription:event', {
        type: 'download',
        payload: { modelId, bytesReceived, totalBytes },
      })
    } catch {
      // ignore
    }
  }

  private emitEngineDownload(
    part: 'windows-zip' | 'whisper-cpp' | 'ggml' | 'libomp',
    bytesReceived: number,
    totalBytes: number | null,
  ) {
    const target = this.progressSender
    if (!target) {
      return
    }
    try {
      target.send('transcription:event', {
        type: 'engine-download',
        payload: { part, bytesReceived, totalBytes },
      })
    } catch {
      // ignore
    }
  }

  async downloadEngine(sender: ProgressSender): Promise<void> {
    if (!isTranscriptionEngineAutoInstallSupported()) {
      throw new Error('Automatic engine install is not available on this system.')
    }
    this.progressSender = sender
    await installTranscriptionEngine({
      whisperRoot: this.getWhisperRoot(),
      onProgress: (p) => this.emitEngineDownload(p.part, p.bytesReceived, p.totalBytes),
    })
  }

  private emitFfmpegDownload(bytesReceived: number, totalBytes: number | null) {
    const target = this.progressSender
    if (!target) {
      return
    }
    try {
      target.send('transcription:event', {
        type: 'ffmpeg-download',
        payload: { bytesReceived, totalBytes },
      })
    } catch {
      // ignore
    }
  }

  async downloadFfmpeg(sender: ProgressSender): Promise<void> {
    if (!isFfmpegAutoInstallSupported()) {
      throw new Error('Automatic FFmpeg install is not available on this system.')
    }
    this.progressSender = sender
    await installUserFfmpeg({
      whisperRoot: this.getWhisperRoot(),
      onProgress: (received, total) => this.emitFfmpegDownload(received, total),
    })
  }

  cancel() {
    this.cancelled = true
    this.killChildren()
    if (this.status.phase === 'preparing' || this.status.phase === 'transcribing') {
      this.emit({ phase: 'cancelled', message: 'Cancelled' })
    }
  }

  private killChildren() {
    for (const proc of [this.ffmpegProc, this.whisperProc]) {
      if (!proc) continue
      try {
        proc.kill('SIGTERM')
      } catch {
        // ignore
      }
    }
    this.ffmpegProc = null
    this.whisperProc = null
  }

  async downloadModel(modelId: TranscriptionModelId, sender: ProgressSender): Promise<void> {
    const entry = TRANSCRIPTION_MODEL_CATALOG.find((m) => m.id === modelId)
    if (!entry) {
      throw new Error('Unknown model')
    }

    this.progressSender = sender
    fs.mkdirSync(this.getModelsDir(), { recursive: true })
    const dest = this.getModelPath(modelId)
    const partial = `${dest}.partial`

    if (fs.existsSync(partial)) {
      fs.rmSync(partial, { force: true })
    }

    const response = await fetch(entry.url, { redirect: 'follow' })
    if (!response.ok || !response.body) {
      throw new Error(`Model download failed (${response.status})`)
    }

    const len = response.headers.get('content-length')
    const total = len ? Number(len) : null

    const reader = response.body.getReader()
    const writeStream = createWriteStream(partial)
    let received = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        if (!value?.byteLength) {
          continue
        }
        received += value.byteLength
        this.emitDownload(modelId, received, Number.isFinite(total as number) ? (total as number) : null)
        await new Promise<void>((resolve, reject) => {
          writeStream.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()))
        })
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.end((err: Error | null | undefined) => (err ? reject(err) : resolve()))
      })
    } catch (error) {
      writeStream.destroy()
      await fs.promises.rm(partial, { force: true }).catch(() => {})
      throw error
    }

    await fs.promises.rename(partial, dest)
    this.emitDownload(modelId, received, received)
  }

  async deleteModel(modelId: TranscriptionModelId): Promise<void> {
    const dest = this.getModelPath(modelId)
    if (!fs.existsSync(dest)) {
      return
    }
    await fs.promises.rm(dest, { force: true })
  }

  async saveTranscriptAs(text: string): Promise<string | null> {
    const meta = this.projectService.getMeta()
    const defaultPath = meta?.path ? path.join(path.dirname(meta.path), 'transcript.txt') : undefined

    const result = await dialog.showSaveDialog({
      title: 'Save transcript',
      defaultPath,
      filters: [{ name: 'Text', extensions: ['txt'] }],
    })

    if (result.canceled || !result.filePath) {
      return null
    }

    await fs.promises.writeFile(result.filePath, text, 'utf8')
    return result.filePath
  }

  /** Fire-and-forget from IPC; reports via transcription:event */
  async runJob(payload: TranscriptionStartPayload, sender: ProgressSender): Promise<void> {
    this.cancelled = false
    this.progressSender = sender
    this.killChildren()
    this.diagnosticFfmpegStderr = ''
    this.diagnosticWhisperStderr = ''
    this.diagnosticWhisperStdout = ''

    let tmpRoot: string | null = null

    try {
      const settings = this.settingsService.getSettings()
      const modelId = payload.modelId ?? settings.transcription.modelId
      const language = payload.language ?? settings.transcription.language
      const timestampInterval = payload.timestampInterval ?? settings.transcription.timestampInterval

      const mediaPath = path.normalize(payload.filePath)
      if (!path.isAbsolute(mediaPath) || !fs.existsSync(mediaPath)) {
        this.emit({ phase: 'error', message: 'Invalid media file', error: 'File not found' })
        return
      }

      const ffmpeg = this.resolveFfmpegPath()
      if (!ffmpeg) {
        this.emit({
          phase: 'error',
          message: 'FFmpeg not found',
          error: isFfmpegAutoInstallSupported()
            ? 'Download FFmpeg under Settings → Transcribe, or install ffmpeg and ensure it is in PATH.'
            : 'Install ffmpeg and ensure it is in PATH.',
        })
        return
      }

      const whisper = this.resolveWhisperCliPath()
      if (!whisper) {
        this.emit({
          phase: 'error',
          message: 'Transcription engine missing',
          error: isTranscriptionEngineAutoInstallSupported()
            ? 'Download the transcription engine under Settings → Transcribe.'
            : 'Install whisper.cpp or set the path to whisper-cli under Settings → Transcribe.',
        })
        return
      }

      const modelPath = this.getModelPath(modelId)
      if (!fs.existsSync(modelPath)) {
        this.emit({
          phase: 'error',
          message: 'Model not found',
          error: `Download the "${modelId}" model under Settings → Transcribe.`,
        })
        return
      }

      tmpRoot = await fs.promises.mkdtemp(path.join(app.getPath('temp'), 'narralab-transcribe-'))
      const workWav = path.join(tmpRoot, 'narralab-work.wav')

      this.emit({ phase: 'preparing', message: 'Extracting audio…' })
      await this.runFfmpeg(ffmpeg, mediaPath, workWav)

      if (this.cancelled) {
        return
      }

      // Extract professional start timecode if ffprobe is available
      const tcOffsetSec = await this.readStartTimecode(mediaPath)

      this.emit({ phase: 'transcribing', message: 'Transcribing locally…' })
      await this.runWhisper(whisper, modelPath, workWav, tmpRoot, language, timestampInterval !== 'none')

      if (this.cancelled) {
        return
      }

      let text: string
      if (timestampInterval !== 'none') {
        // Try SRT first for timestamped output
        const srtPath = path.join(tmpRoot, `${WHISPER_OUTPUT_BASENAME}.srt`)
        if (fs.existsSync(srtPath)) {
          const srtContent = fs.readFileSync(srtPath, 'utf8')
          text = buildTranscriptFromSrt(srtContent, timestampInterval, tcOffsetSec)
        } else {
          text = this.readTranscriptFromWorkdir(tmpRoot, 'narralab-work.wav')
        }
      } else {
        text = this.readTranscriptFromWorkdir(tmpRoot, 'narralab-work.wav')
      }

      if (!text.trim()) {
        this.emit({
          phase: 'error',
          message: 'Empty transcript',
          error: 'Whisper exited without producing text. Try a different model or check the engine under Settings → Transcribe.',
        })
        return
      }

      const tcDisplay = tcOffsetSec > 0 ? ` · Start TC: ${secToTimestamp(tcOffsetSec)}` : ''

      this.emit({
        phase: 'complete',
        message: `Done${tcDisplay}`,
        progress: 1,
        resultText: text.trim(),
      })
    } catch (error) {
      console.error('Transcription runJob failed:', error)
      if (this.cancelled) {
        return
      }
      const message = error instanceof Error ? error.message : 'Transcription failed'
      this.emit({ phase: 'error', message: 'Transcription failed', error: message })
    } finally {
      if (tmpRoot) {
        await fs.promises.rm(tmpRoot, { recursive: true, force: true }).catch(() => {})
      }
      this.ffmpegProc = null
      this.whisperProc = null
    }
  }

  private runFfmpeg(ffmpegPath: string, inputPath: string, outputWav: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['-nostdin', '-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', outputWav]
      const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] })
      this.ffmpegProc = proc
      let err = ''
      proc.stderr?.on('data', (chunk: Buffer) => {
        const s = chunk.toString()
        err += s
        this.diagnosticFfmpegStderr = appendDiagnosticTail(this.diagnosticFfmpegStderr, s, DIAG_FFMPEG_MAX)
      })
      proc.on('error', reject)
      proc.on('close', (code) => {
        this.ffmpegProc = null
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(err.trim() || `ffmpeg exited with ${code}`))
        }
      })
    })
  }

  private runWhisper(
    whisperPath: string,
    modelPath: string,
    workWav: string,
    cwd: string,
    language: TranscriptionLanguage,
    outputSrt = false,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const threads = whisperThreadCountForJob()
      const mappedLanguage = language === 'nb' ? 'no' : language
      const baseArgs: string[] = [
        '-t',
        String(threads),
        '-m',
        modelPath,
        '-of',
        WHISPER_OUTPUT_BASENAME,
        '-f',
        workWav,
        '-otxt',
        ...(outputSrt ? ['-osrt'] : []),
        '-pp',
        '-l',
        mappedLanguage,
      ]
      const whisperArgs = baseArgs

      const proc = spawnWhisperCli(whisperPath, whisperArgs, cwd, threads, ['pipe', 'pipe', 'pipe'])
      proc.stdin?.end()
      this.whisperProc = proc
      let stderr = ''
      let stdout = ''
      let lastProgressEmitMs = 0
      let lastEmittedFraction: number | undefined

      const audioSec = estimateWavPcmDurationSec(workWav)
      // Minst 3 min; ~25 s veggtid per 1 s lyd; maks 45 min (lange filer / trege maskiner).
      const timeoutMs = Math.min(45 * 60_000, Math.max(180_000, Math.ceil(audioSec) * 25_000))
      const onTimeout = () => {
        try {
          proc.kill('SIGTERM')
        } catch {
          /* ignore */
        }
        setTimeout(() => {
          try {
            proc.kill('SIGKILL')
          } catch {
            /* ignore */
          }
        }, 4000)
      }
      let settled = false
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null
      let lastWhisperIoAt = Date.now()
      const clearHeartbeat = () => {
        if (heartbeatTimer !== null) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
      }
      const settle = (fn: () => void) => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(killTimer)
        clearHeartbeat()
        fn()
      }

      heartbeatTimer = setInterval(() => {
        if (settled || this.cancelled) {
          return
        }
        const quietSec = Math.round((Date.now() - lastWhisperIoAt) / 1000)
        if (quietSec < 12) {
          return
        }
        const prev = this.status.phase === 'transcribing' ? this.status.progress : undefined
        this.emit({
          phase: 'transcribing',
          message: 'Transkriberer lokalt…',
          ...(prev !== undefined ? { progress: prev } : {}),
          progressLine: `Ingen ny logg fra whisper på ${quietSec} s. Sjekk Aktivitetsmonitor for whisper-cli. Kopier diagnostikk – feltet «whisperHelpProbe» viser om -h fungerer.`,
        })
      }, 10_000)

      const killTimer = setTimeout(() => {
        onTimeout()
        settle(() =>
          reject(
            new Error(
              `whisper-cli brukte lengre tid enn forventet (>${Math.round(timeoutMs / 1000)} s). Avbrutt. Prøv Base-modellen, eller sjekk CPU-belastning og at motoren er riktig installert.`,
            ),
          ),
        )
      }, timeoutMs)

      const emitWhisperProgress = (force = false) => {
        if (this.cancelled) {
          return
        }
        const combined = `${stderr}\n${stdout}`
        const parsed = parseWhisperProgressFraction(combined)
        const prev = this.status.phase === 'transcribing' ? this.status.progress : undefined
        const progress = parsed !== undefined ? parsed : prev
        const now = Date.now()
        const fractionMoved = progress !== lastEmittedFraction
        if (!force && now - lastProgressEmitMs < 200 && !fractionMoved) {
          return
        }
        lastProgressEmitMs = now
        if (progress !== undefined) {
          lastEmittedFraction = progress
        }
        const tailLine =
          stderr.split(/\r?\n/).filter(Boolean).slice(-1)[0] ??
          stdout.split(/\r?\n/).filter(Boolean).slice(-1)[0] ??
          ''
        this.emit({
          phase: 'transcribing',
          message: 'Transkriberer lokalt…',
          ...(progress !== undefined ? { progress } : {}),
          progressLine: tailLine.slice(-200),
        })
      }

      proc.stdout?.on('data', (chunk: Buffer) => {
        lastWhisperIoAt = Date.now()
        const s = chunk.toString()
        stdout += s
        this.diagnosticWhisperStdout = appendDiagnosticTail(this.diagnosticWhisperStdout, s, DIAG_WHISPER_OUT_MAX)
        emitWhisperProgress()
      })

      proc.stderr?.on('data', (chunk: Buffer) => {
        lastWhisperIoAt = Date.now()
        const s = chunk.toString()
        stderr += s
        this.diagnosticWhisperStderr = appendDiagnosticTail(this.diagnosticWhisperStderr, s, DIAG_WHISPER_ERR_MAX)
        emitWhisperProgress()
      })

      proc.on('error', (err) => {
        settle(() => {
          this.whisperProc = null
          reject(err)
        })
      })

      proc.on('close', (code) => {
        settle(() => {
          this.whisperProc = null
          if (code === 0) {
            emitWhisperProgress(true)
            resolve()
          } else {
            reject(new Error(stderr.trim() || `whisper exited with ${code}`))
          }
        })
      })
    })
  }

  private readTranscriptFromWorkdir(workDir: string, wavFileName: string): string {
    const base = path.basename(wavFileName, path.extname(wavFileName))
    const candidates = [
      path.join(workDir, `${WHISPER_OUTPUT_BASENAME}.txt`),
      path.join(workDir, `${wavFileName}.txt`),
      path.join(workDir, `${base}.txt`),
    ]

    for (const file of candidates) {
      if (fs.existsSync(file)) {
        return fs.readFileSync(file, 'utf8')
      }
    }

    const txts = fs
      .readdirSync(workDir)
      .filter((name) => name.endsWith('.txt'))
      .map((name) => path.join(workDir, name))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)

    if (txts[0]) {
      return fs.readFileSync(txts[0], 'utf8')
    }

    return ''
  }
}
