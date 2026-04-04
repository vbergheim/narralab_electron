import { mkdtempSync, rmSync } from 'node:fs'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'

import { app, shell } from 'electron'

import type { MediaPlayerEvent, MediaPlayerState } from '@/types/media-player'
import { ensureModernZSkin, installBundledMpv, installedMpvBinaryPath } from './media-player-install'
import { userInstalledFfprobePath } from './transcription-ffmpeg-install'

type Broadcast = (event: MediaPlayerEvent) => void

const OBSERVED_PROPERTIES = ['pause', 'time-pos', 'duration', 'path', 'volume'] as const
const MPV_INSTALL_URL = 'https://mpv.io/installation/'

export class MediaPlayerService {
  private readonly broadcast: Broadcast
  private mpvPath: string | null
  private readonly installRoot: string
  private readonly configRoot: string
  private state: MediaPlayerState
  private proc: ChildProcess | null = null
  private socket: net.Socket | null = null
  private socketDir: string | null = null
  private socketPath: string | null = null
  private socketBuffer = ''

  constructor(broadcast: Broadcast) {
    this.broadcast = broadcast
    this.installRoot = path.join(app.getPath('userData'), 'mpv')
    this.configRoot = path.join(app.getPath('userData'), 'mpv-config')
    this.mpvPath = resolveMpvPath(this.installRoot)
    this.state = {
      available: this.mpvPath !== null,
      connected: false,
      status: 'idle',
      embedded: false,
      currentPath: null,
      durationSeconds: null,
      positionSeconds: null,
      volume: 100,
      fullscreen: false,
      error: this.mpvPath ? null : 'mpv was not found on this system.',
      installUrl: MPV_INSTALL_URL,
      installHint: installHint(),
    }
  }

  getState(): MediaPlayerState {
    return { ...this.state }
  }

  async open(filePath: string): Promise<MediaPlayerState> {
    const resolvedPath = this.ensurePlayablePath(filePath)
    await this.openUsingTarget(resolvedPath)
    return this.getState()
  }

  async openInWindow(shellWindow: unknown, filePath: string): Promise<MediaPlayerState> {
    void shellWindow
    return this.open(filePath)
  }

  async setViewport(shellWindow?: unknown, viewport?: unknown): Promise<MediaPlayerState> {
    void shellWindow
    void viewport
    return this.getState()
  }

  async detachWindow(shellWindow?: unknown): Promise<MediaPlayerState> {
    void shellWindow
    await this.close()
    return this.getState()
  }

  async play(): Promise<MediaPlayerState> {
    await this.sendCommand(['set_property', 'pause', false])
    return this.getState()
  }

  async pause(): Promise<MediaPlayerState> {
    await this.sendCommand(['set_property', 'pause', true])
    return this.getState()
  }

  async seek(seconds: number): Promise<MediaPlayerState> {
    await this.sendCommand(['set_property', 'time-pos', Math.max(0, seconds)])
    return this.getState()
  }

  async seekRelative(seconds: number): Promise<MediaPlayerState> {
    await this.sendCommand(['seek', seconds, 'relative'])
    return this.getState()
  }

  async setVolume(volume: number): Promise<MediaPlayerState> {
    await this.sendCommand(['set_property', 'volume', clamp(volume, 0, 100)])
    return this.getState()
  }

  async toggleFullscreen(): Promise<MediaPlayerState> {
    await this.sendCommand(['cycle', 'fullscreen'])
    this.updateState({ fullscreen: !this.state.fullscreen })
    return this.getState()
  }

  async focus(): Promise<MediaPlayerState> {
    if (!this.proc?.pid) {
      return this.getState()
    }

    if (process.platform === 'darwin') {
      spawnSync('/usr/bin/osascript', [
        '-e',
        `tell application "System Events" to set frontmost of the first process whose unix id is ${this.proc.pid} to true`,
      ])
    }

    return this.getState()
  }

  async close(): Promise<MediaPlayerState> {
    if (this.socket) {
      try {
        await this.sendCommand(['quit'])
      } catch {
        // ignore
      }
    }

    this.teardownProcess()
    this.updateState({
      connected: false,
      status: 'idle',
      currentPath: null,
      durationSeconds: null,
      positionSeconds: null,
      fullscreen: false,
      error: null,
    })
    return this.getState()
  }

  async openInstallGuide(): Promise<MediaPlayerState> {
    await shell.openExternal(MPV_INSTALL_URL)
    return this.getState()
  }

  async install(): Promise<MediaPlayerState> {
    this.updateState({
      status: 'installing',
      error: null,
    })

    try {
      this.mpvPath = await installBundledMpv({
        installRoot: this.installRoot,
      })
      await ensureModernZSkin(this.configRoot).catch(() => false)
      this.updateState({
        available: true,
        connected: false,
        status: 'idle',
        error: null,
      })
      return this.getState()
    } catch (error) {
      this.mpvPath = resolveMpvPath(this.installRoot)
      const message = error instanceof Error ? error.message : 'Could not install Media Player.'
      this.updateState({
        available: this.mpvPath !== null,
        status: 'error',
        error: message,
      })
      throw error
    }
  }

  private ensurePlayablePath(filePath: string) {
    const resolvedPath = path.resolve(filePath)
    if (!fs.existsSync(resolvedPath)) {
      this.updateState({ status: 'error', error: 'Media file not found.' })
      throw new Error('Media file not found.')
    }

    if (!this.mpvPath) {
      this.updateState({ status: 'error', error: 'mpv was not found on this system.' })
      throw new Error('mpv was not found on this system. Install mpv to use the Media Player.')
    }

    return resolvedPath
  }

  private async openUsingTarget(filePath: string) {
    this.updateState({
      status: 'opening',
      currentPath: filePath,
      durationSeconds: null,
      positionSeconds: null,
      fullscreen: false,
      error: null,
    })

    await this.ensureProcess()
    await this.loadIntoPlayer(filePath)
    await this.updateTimecodeOverlay(filePath)
  }

  private async loadIntoPlayer(filePath: string) {
    await this.sendCommand(['loadfile', filePath, 'replace'])
    await this.sendCommand(['set_property', 'pause', false])
  }

  private async updateTimecodeOverlay(filePath: string) {
    const timecode = await readEmbeddedTimecode(filePath)
    if (!timecode) {
      await this.sendCommand(['script-message', 'clear-start-timecode'])
      return
    }

    await this.sendCommand([
      'script-message',
      'set-start-timecode',
      String(timecode.startSeconds),
      String(timecode.frameRate ?? 24),
    ])
  }

  private updateState(patch: Partial<MediaPlayerState>) {
    this.state = {
      ...this.state,
      ...patch,
      available: this.mpvPath !== null,
      embedded: false,
      installUrl: MPV_INSTALL_URL,
      installHint: installHint(),
    }
    this.broadcast({ type: 'state', payload: this.getState() })
  }

  private async ensureProcess(): Promise<void> {
    if (this.socket && !this.socket.destroyed && this.state.connected) {
      return
    }

    this.teardownProcess()
    this.socketDir = mkdtempSync(path.join(os.tmpdir(), 'narralab-mpv-'))
    this.socketPath = path.join(this.socketDir, 'mpv.sock')
    await ensureMpvConfig(this.configRoot)

    const args = [
      '--config-dir=' + this.configRoot,
      '--idle=yes',
      '--force-window=yes',
      '--keep-open=yes',
      '--input-ipc-server=' + this.socketPath,
      '--term-status-msg=',
      '--msg-level=all=warn',
      '--osc=yes',
      '--title=NarraLab Media Player',
    ]

    this.proc = spawn(this.mpvPath as string, args, {
      stdio: ['ignore', 'ignore', 'ignore'],
    })

    this.proc.on('exit', () => {
      this.socket?.destroy()
      this.socket = null
      this.proc = null
      this.updateState({
        connected: false,
        status: this.state.status === 'error' ? 'error' : 'idle',
      })
      this.cleanupSocketDir()
    })

    await this.connectSocketWithRetry(this.socketPath)
    this.observeProperties()
  }

  private connectSocketWithRetry(socketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0
      const maxAttempts = 50

      const tryConnect = () => {
        attempts += 1
        const socket = net.createConnection(socketPath)

        socket.once('connect', () => {
          this.socket = socket
          this.socketBuffer = ''
          socket.on('data', (chunk) => this.onSocketData(chunk.toString()))
          socket.on('close', () => {
            if (this.socket === socket) {
              this.socket = null
              this.updateState({ connected: false })
            }
          })
          socket.on('error', (error) => {
            this.updateState({
              connected: false,
              status: 'error',
              error: error.message,
            })
          })
          this.updateState({
            connected: true,
            error: null,
            fullscreen: false,
          })
          resolve()
        })

        socket.once('error', () => {
          socket.destroy()
          if (attempts >= maxAttempts) {
            this.updateState({
              connected: false,
              status: 'error',
              error: 'Could not connect to mpv IPC.',
            })
            reject(new Error('Could not connect to mpv IPC.'))
            return
          }
          setTimeout(tryConnect, 100)
        })
      }

      tryConnect()
    })
  }

  private observeProperties() {
    void this.sendCommand(['observe_property', 1, OBSERVED_PROPERTIES[0]])
    void this.sendCommand(['observe_property', 2, OBSERVED_PROPERTIES[1]])
    void this.sendCommand(['observe_property', 3, OBSERVED_PROPERTIES[2]])
    void this.sendCommand(['observe_property', 4, OBSERVED_PROPERTIES[3]])
    void this.sendCommand(['observe_property', 5, OBSERVED_PROPERTIES[4]])
  }

  private async sendCommand(command: unknown[]): Promise<void> {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('mpv IPC is not connected.')
    }

    const payload = JSON.stringify({ command }) + '\n'
    await new Promise<void>((resolve, reject) => {
      this.socket?.write(payload, (error) => {
        if (error) {
          this.updateState({ status: 'error', error: error.message })
          reject(error)
          return
        }
        resolve()
      })
    })
  }

  private onSocketData(chunk: string) {
    this.socketBuffer += chunk

    while (this.socketBuffer.includes('\n')) {
      const newlineIndex = this.socketBuffer.indexOf('\n')
      const raw = this.socketBuffer.slice(0, newlineIndex).trim()
      this.socketBuffer = this.socketBuffer.slice(newlineIndex + 1)
      if (!raw) continue

      try {
        const message = JSON.parse(raw) as {
          event?: string
          name?: string
          data?: unknown
        }

        if (message.event === 'property-change') {
          this.applyPropertyChange(message.name, message.data)
        }
      } catch {
        // ignore malformed IPC lines
      }
    }
  }

  private applyPropertyChange(name?: string, data?: unknown) {
    switch (name) {
      case 'pause': {
        const paused = data === true
        this.updateState({ status: paused ? 'paused' : 'playing' })
        break
      }
      case 'time-pos': {
        this.updateState({ positionSeconds: typeof data === 'number' ? data : null })
        break
      }
      case 'duration': {
        this.updateState({ durationSeconds: typeof data === 'number' ? data : null })
        break
      }
      case 'path': {
        this.updateState({ currentPath: typeof data === 'string' ? data : this.state.currentPath })
        break
      }
      case 'volume': {
        this.updateState({ volume: typeof data === 'number' ? clamp(data, 0, 100) : null })
        break
      }
      default:
        break
    }
  }

  private teardownProcess() {
    this.socket?.destroy()
    this.socket = null

    if (this.proc && !this.proc.killed) {
      this.proc.kill('SIGTERM')
    }
    this.proc = null
    this.cleanupSocketDir()
  }

  private cleanupSocketDir() {
    if (!this.socketDir) return
    rmSync(this.socketDir, { recursive: true, force: true })
    this.socketDir = null
    this.socketPath = null
  }
}

function resolveMpvPath(installRoot: string): string | null {
  const installed = installedMpvBinaryPath(installRoot)
  if (installed) return installed
  if (commandExists('mpv')) return 'mpv'
  const appBundleBinary = '/Applications/mpv.app/Contents/MacOS/mpv'
  return fs.existsSync(appBundleBinary) ? appBundleBinary : null
}

function installHint(): string | null {
  if (process.platform === 'darwin') {
    return 'macOS: NarraLab can install mpv automatically, or you can use the official install page.'
  }
  if (process.platform === 'win32') {
    return 'Windows: install mpv from the official install page, then reopen NarraLab.'
  }
  return 'Install mpv from the official install page, then reopen NarraLab.'
}

async function ensureMpvConfig(configRoot: string) {
  fs.mkdirSync(configRoot, { recursive: true })
  const skinInstalled = await ensureModernZSkin(configRoot).catch(() => false)
  fs.writeFileSync(
    path.join(configRoot, 'mpv.conf'),
    [
      '# NarraLab Media Player',
      skinInstalled ? 'osc=no' : 'osc=yes',
      skinInstalled ? 'border=no' : '# border=no',
      'osd-level=1',
      'osd-fractions=yes',
      'cursor-autohide=250',
      'save-position-on-quit=yes',
    ].join('\n') + '\n',
    'utf8',
  )
}

function commandExists(command: string) {
  const result = spawnSync(process.platform === 'win32' ? 'where' : 'which', [command], {
    stdio: 'ignore',
  })
  return result.status === 0
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

type EmbeddedTimecode = {
  startSeconds: number
  frameRate: number | null
}

async function readEmbeddedTimecode(filePath: string): Promise<EmbeddedTimecode | null> {
  const ffprobePath = resolveFfprobePath()
  if (!ffprobePath) return null

  const output = spawnSync(
    ffprobePath,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
    { encoding: 'utf8' },
  )

  if (output.status !== 0 || !output.stdout) {
    return null
  }

  try {
    const payload = JSON.parse(output.stdout) as {
      format?: { tags?: Record<string, string> }
      streams?: Array<{
        codec_type?: string
        avg_frame_rate?: string
        r_frame_rate?: string
        tags?: Record<string, string>
      }>
    }

    const timecode =
      extractTimecode(payload.format?.tags ?? null) ??
      extractStreamTimecode(payload.streams ?? [])
    if (!timecode) return null

    const stream = (payload.streams ?? []).find((entry) => entry.codec_type === 'video')
    const frameRate = parseRate(stream?.avg_frame_rate ?? stream?.r_frame_rate ?? null)
    const startSeconds = parseSMPTETimecode(timecode, frameRate)
    if (startSeconds == null) return null

    return {
      startSeconds,
      frameRate,
    }
  } catch {
    return null
  }
}

function extractTimecode(tags: Record<string, string> | null): string | null {
  if (!tags) return null
  return tags.timecode ?? tags.TIMECODE ?? null
}

function extractStreamTimecode(streams: Array<{ tags?: Record<string, string> }>): string | null {
  for (const stream of streams) {
    const candidate = stream.tags?.timecode ?? stream.tags?.TIMECODE ?? null
    if (candidate) {
      return candidate
    }
  }
  return null
}

function parseSMPTETimecode(raw: string, frameRate: number | null): number | null {
  const match = raw.trim().match(/^(\d{2}):(\d{2}):(\d{2})[:;.](\d{2})$/)
  if (!match) return null

  const hours = Number.parseInt(match[1], 10)
  const minutes = Number.parseInt(match[2], 10)
  const seconds = Number.parseInt(match[3], 10)
  const frames = Number.parseInt(match[4], 10)
  if (![hours, minutes, seconds, frames].every(Number.isFinite)) return null

  const totalSeconds = hours * 3600 + minutes * 60 + seconds
  const fps = frameRate && frameRate > 0 ? frameRate : 24
  return totalSeconds + frames / fps
}

function parseRate(raw: string | null): number | null {
  if (!raw) return null
  const [left, right] = raw.split('/')
  const numerator = Number.parseFloat(left)
  const denominator = Number.parseFloat(right)
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null
  return numerator / denominator
}

function resolveFfprobePath(): string | null {
  const whisperRoot = path.join(app.getPath('userData'), 'whisper')
  const installed = userInstalledFfprobePath(whisperRoot)
  if (installed) return installed
  if (commandExists('ffprobe')) return 'ffprobe'
  return null
}
