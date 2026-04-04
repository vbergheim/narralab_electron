import { createHash } from 'node:crypto'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

const MPV_MACOS_BUILDS_URL = 'https://laboratory.stolendata.net/~djinn/mpv_osx/'
const MODERNZ_BASE_URL = 'https://raw.githubusercontent.com/Samillion/ModernZ/main/'
const MODERNZ_SCRIPT = 'modernz.lua'
const MODERNZ_FONT_FILES = ['modernz-icons.ttf']
const TIMECODE_SCRIPT = 'mpv-timecode.lua'
const LEGACY_MODERNX_FILES = [
  path.join('scripts', 'modernx.lua'),
  path.join('script-opts', 'modernx.conf'),
  path.join('fonts', 'Material-Design-Iconic-Font.ttf'),
  path.join('fonts', 'Material-Design-Iconic-Round.ttf'),
]

export function installedMpvBinaryPath(rootDir: string): string | null {
  const candidate = path.join(rootDir, 'mpv.app', 'Contents', 'MacOS', 'mpv')
  return fs.existsSync(candidate) ? candidate : null
}

export async function ensureModernZSkin(configRoot: string, onProgress?: (message: string) => void): Promise<boolean> {
  const scriptsDir = path.join(configRoot, 'scripts')
  const fontsDir = path.join(configRoot, 'fonts')
  const scriptOptsDir = path.join(configRoot, 'script-opts')
  const inputConfPath = path.join(configRoot, 'input.conf')
  const scriptPath = path.join(scriptsDir, MODERNZ_SCRIPT)
  const timecodeScriptPath = path.join(scriptsDir, TIMECODE_SCRIPT)
  const fontPaths = MODERNZ_FONT_FILES.map((fileName) => path.join(fontsDir, fileName))

  await removeLegacyModernXSkin(configRoot)

  if (fs.existsSync(scriptPath) && fontPaths.every((fontPath) => fs.existsSync(fontPath))) {
    await fsPromises.mkdir(scriptsDir, { recursive: true })
    await fsPromises.writeFile(timecodeScriptPath, TIMECODE_SCRIPT_SOURCE, 'utf8')
    await fsPromises.writeFile(inputConfPath, INPUT_CONF_SOURCE, 'utf8')
    return true
  }

  try {
    onProgress?.('Installing mpv skin…')
    await fsPromises.mkdir(scriptsDir, { recursive: true })
    await fsPromises.mkdir(fontsDir, { recursive: true })
    await fsPromises.mkdir(scriptOptsDir, { recursive: true })

    const downloads = await Promise.all([
      downloadBinary(`${MODERNZ_BASE_URL}${MODERNZ_SCRIPT}`),
      ...MODERNZ_FONT_FILES.map((fileName) => downloadBinary(`${MODERNZ_BASE_URL}${fileName}`)),
    ])

    await fsPromises.writeFile(scriptPath, downloads[0])
    await Promise.all(
      MODERNZ_FONT_FILES.map((fileName, index) => fsPromises.writeFile(path.join(fontsDir, fileName), downloads[index + 1])),
    )
    await fsPromises.writeFile(timecodeScriptPath, TIMECODE_SCRIPT_SOURCE, 'utf8')
    await fsPromises.writeFile(inputConfPath, INPUT_CONF_SOURCE, 'utf8')

    return true
  } catch {
    return false
  }
}

export async function installBundledMpv(params: {
  installRoot: string
  onProgress?: (message: string) => void
}): Promise<string> {
  if (process.platform !== 'darwin') {
    throw new Error('Automatic mpv installation is currently supported only on macOS.')
  }

  params.onProgress?.('Fetching mpv build information…')
  const build = await resolveMacosBuild()
  const tmpDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'narralab-mpv-install-'))
  const archivePath = path.join(tmpDir, 'mpv.tar.gz')
  const extractDir = path.join(tmpDir, 'extract')

  try {
    params.onProgress?.('Downloading Media Player…')
    await downloadFile(build.url, archivePath)

    if (build.sha256) {
      params.onProgress?.('Verifying download…')
      const digest = await sha256File(archivePath)
      if (digest !== build.sha256) {
        throw new Error('Downloaded mpv archive failed checksum verification.')
      }
    }

    await fsPromises.mkdir(extractDir, { recursive: true })
    params.onProgress?.('Unpacking Media Player…')
    await extractTarGz(archivePath, extractDir)

    const appBundlePath = findMpvAppBundle(extractDir)
    if (!appBundlePath) {
      throw new Error('Could not find mpv.app in the downloaded archive.')
    }

    params.onProgress?.('Installing Media Player…')
    await fsPromises.rm(params.installRoot, { recursive: true, force: true })
    await fsPromises.mkdir(path.dirname(params.installRoot), { recursive: true })
    await fsPromises.cp(appBundlePath, path.join(params.installRoot, 'mpv.app'), {
      recursive: true,
      force: true,
    })

    const binaryPath = installedMpvBinaryPath(params.installRoot)
    if (!binaryPath) {
      throw new Error('mpv was installed, but the executable could not be found.')
    }

    try {
      await fsPromises.chmod(binaryPath, 0o755)
    } catch {
      // ignore
    }

    return binaryPath
  } finally {
    await fsPromises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function resolveMacosBuild(): Promise<{ url: string; sha256: string | null }> {
  const response = await fetch(MPV_MACOS_BUILDS_URL)
  if (!response.ok) {
    throw new Error(`Could not fetch mpv build list (${response.status}).`)
  }

  const html = await response.text()
  const fileName = process.arch === 'arm64' ? 'mpv-arm64-latest.tar.gz' : 'mpv-latest.tar.gz'
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = html.match(new RegExp(`${escaped}[^\\n]*sha256:([a-f0-9]{64})`, 'i'))
  const sha256 = match?.[1]?.toLowerCase() ?? null

  return {
    url: new URL(fileName, MPV_MACOS_BUILDS_URL).toString(),
    sha256,
  }
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}).`)
  }
  const arrayBuffer = await response.arrayBuffer()
  await fsPromises.writeFile(destPath, Buffer.from(arrayBuffer))
}

async function downloadBinary(url: string): Promise<Buffer> {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}).`)
  }
  return Buffer.from(await response.arrayBuffer())
}

async function removeLegacyModernXSkin(configRoot: string): Promise<void> {
  await Promise.all(
    LEGACY_MODERNX_FILES.map(async (relativePath) => {
      const fullPath = path.join(configRoot, relativePath)
      await fsPromises.rm(fullPath, { force: true }).catch(() => {})
    }),
  )
}

const TIMECODE_SCRIPT_SOURCE = `local mp = require('mp')
local visible = true
local overlay = mp.create_osd_overlay('ass-events')
overlay.res_x = 0
overlay.res_y = 720
overlay.z = 10
local base_seconds = nil
local base_fps = 24

local function ass_escape(text)
  return mp.command_native({ 'escape-ass', text or '' })
end

local function current_display_timecode()
  local elapsed = mp.get_property_number('time-pos', 0) or 0
  if base_seconds == nil then
    return '—'
  end
  local fps = base_fps > 0 and base_fps or 24
  local total_frames = math.max(0, math.floor((base_seconds + elapsed) * fps + 0.5))
  local frames_per_hour = fps * 3600
  local frames_per_minute = fps * 60
  local hours = math.floor(total_frames / frames_per_hour)
  local minutes = math.floor((total_frames % frames_per_hour) / frames_per_minute)
  local seconds = math.floor((total_frames % frames_per_minute) / fps)
  local frames = total_frames % fps
  return string.format('%02d:%02d:%02d:%02d', hours, minutes, seconds, frames)
end

local function render()
  if not visible then
    overlay:remove()
    return
  end

  local tc = current_display_timecode()
  local w, h = mp.get_osd_size()
  if w and h and w > 0 and h > 0 then
    overlay.res_x = w
    overlay.res_y = h
    local x = math.floor(w / 2)
    local y = 34
    overlay.data = string.format('{\\\\an8\\\\pos(%d,%d)\\\\fs52\\\\bord5\\\\shad0\\\\1c&HFFFFFF&\\\\3c&H000000&}TC: %s', x, y, ass_escape(tc))
    overlay:update()
    return
  end

  overlay.data = '{\\\\an8\\\\fs52\\\\bord5\\\\shad0\\\\1c&HFFFFFF&\\\\3c&H000000&}TC: ' .. ass_escape(tc)
  overlay:update()
end

local function toggle()
  visible = not visible
  render()
end

local function set_start_timecode(seconds, fps)
  local parsed_seconds = tonumber(seconds)
  if parsed_seconds ~= nil then
    base_seconds = parsed_seconds
  end
  local parsed_fps = tonumber(fps)
  if parsed_fps ~= nil and parsed_fps > 0 then
    base_fps = parsed_fps
  end
  render()
end

local function clear_start_timecode()
  base_seconds = nil
  render()
end

mp.add_forced_key_binding('ctrl+t', 'toggle-timecode', toggle)
mp.register_script_message('toggle-timecode', toggle)
mp.register_script_message('set-start-timecode', set_start_timecode)
mp.register_script_message('clear-start-timecode', clear_start_timecode)
mp.register_event('file-loaded', render)
mp.register_event('start-file', render)
mp.register_event('end-file', function()
  overlay:remove()
end)
mp.observe_property('time-pos', 'number', render)
mp.observe_property('osd-width', 'number', render)
mp.observe_property('osd-height', 'number', render)
`

const INPUT_CONF_SOURCE = `ctrl+t script-message-to mpv-timecode toggle-timecode
`

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  const stream = fs.createReadStream(filePath)
  return await new Promise<string>((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function extractTarGz(archivePath: string, destDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = spawn('tar', ['-xzf', archivePath, '-C', destDir], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''

    proc.stderr.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(stderr.trim() || `tar exited with ${code}`))
    })
  })
}

function findMpvAppBundle(rootDir: string): string | null {
  const stack = [rootDir]
  while (stack.length > 0) {
    const current = stack.pop() as string
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory() && entry.name === 'mpv.app') {
        return fullPath
      }
      if (entry.isDirectory()) {
        stack.push(fullPath)
      }
    }
  }
  return null
}
