import { execFile, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream, promises as fs } from 'node:fs'
import fsSync from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const WINDOWS_WHISPER_ZIP =
  'https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.4/whisper-bin-x64.zip'

export type EngineDownloadPart = 'windows-zip' | 'whisper-cpp' | 'ggml' | 'libomp'

export type EngineDownloadProgress = {
  part: EngineDownloadPart
  bytesReceived: number
  totalBytes: number | null
}

export function isTranscriptionEngineAutoInstallSupported(): boolean {
  return process.platform === 'win32' || process.platform === 'darwin'
}

function engineDir(whisperRoot: string) {
  return path.join(whisperRoot, 'engine')
}

export function bundledEngineCliPath(whisperRoot: string): string | null {
  const binName = process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'
  const p = path.join(engineDir(whisperRoot), 'bin', binName)
  return fsSync.existsSync(p) ? p : null
}

type BrewBottleFile = { url: string; sha256: string }

type BrewFormulaJson = {
  bottle: { stable: { files: Record<string, BrewBottleFile> } }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }
  return (await res.json()) as T
}

async function ghcrBearerToken(repository: string): Promise<string> {
  // Docker/OCI registry token scope must be "repository:<path>:pull", not "<path>:pull"
  const scope = encodeURIComponent(`repository:${repository}:pull`)
  const u = `https://ghcr.io/token?service=ghcr.io&scope=${scope}`
  const res = await fetch(u, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`GHCR token failed (${res.status})`)
  }
  const data = (await res.json()) as { token?: string }
  if (!data.token) {
    throw new Error('GHCR token response missing token')
  }
  return data.token
}

async function streamToFileWithProgress(
  url: string,
  dest: string,
  headers: Record<string, string> | undefined,
  onProgress: (received: number, total: number | null) => void,
): Promise<void> {
  const res = await fetch(url, { headers, redirect: 'follow' })
  if (!res.ok || !res.body) {
    throw new Error(`Download failed (${res.status})`)
  }
  const len = res.headers.get('content-length')
  const total = len ? Number(len) : null
  const reader = res.body.getReader()
  const ws = createWriteStream(dest)
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
      onProgress(received, Number.isFinite(total as number) ? (total as number) : null)
      await new Promise<void>((resolve, reject) => {
        ws.write(Buffer.from(value), (err) => (err ? reject(err) : resolve()))
      })
    }
    await new Promise<void>((resolve, reject) => {
      ws.end((err: Error | null | undefined) => (err ? reject(err) : resolve()))
    })
  } catch (e) {
    ws.destroy()
    await fs.rm(dest, { force: true }).catch(() => {})
    throw e
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  await new Promise<void>((resolve, reject) => {
    const rs = fsSync.createReadStream(filePath)
    rs.on('data', (chunk) => hash.update(chunk))
    rs.on('error', reject)
    rs.on('end', () => resolve())
  })
  return hash.digest('hex')
}

async function extractArchive(archivePath: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true })
  const lower = archivePath.toLowerCase()
  const args = lower.endsWith('.zip') ? ['-xf', archivePath, '-C', destDir] : ['-xzf', archivePath, '-C', destDir]
  await execFileAsync('tar', args, { maxBuffer: 32 * 1024 * 1024 })
}

function pickDarwinArmBottleKeys(): string[] {
  return ['arm64_tahoe', 'arm64_sequoia', 'arm64_sonoma']
}

function pickBottleKeysToTry(): string[] {
  if (process.platform === 'darwin') {
    if (process.arch === 'arm64') {
      return pickDarwinArmBottleKeys()
    }
    if (process.arch === 'x64') {
      return ['sonoma']
    }
  }
  return []
}

/** Homebrew-tarball kan ha flere mapper; aldri bruk «første» fra readdir (kan være feil rekkefølge). */
function resolveBottleCellarVersion(cellarRoot: string, markerSubpath: string): string {
  const entries = fsSync.readdirSync(cellarRoot, { withFileTypes: true })
  const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => path.join(cellarRoot, e.name))
  const hits = dirs.filter((d) => fsSync.existsSync(path.join(d, ...markerSubpath.split('/'))))
  if (hits.length === 0) {
    throw new Error(`Could not find bottle version under ${cellarRoot} (missing ${markerSubpath})`)
  }
  hits.sort()
  return hits[hits.length - 1]
}

function findVersionedLibWhisper(libDir: string): string | null {
  const files = fsSync.readdirSync(libDir)
  const hit = files.find((f) => /^libwhisper\.\d+\.\d+\.\d+\.dylib$/.test(f))
  return hit ? path.join(libDir, hit) : null
}

/**
 * fs.cp kan bevare symlinker som peker på absolutte stier i temp-mappa — etter sletting mangler libwhisper.1.dylib.
 * Vi tvinger relative symlinker som i Homebrew-flaska.
 */
function ensureWhisperLibSymlinks(libDir: string): void {
  const verPath = findVersionedLibWhisper(libDir)
  if (!verPath || !fsSync.existsSync(verPath)) {
    throw new Error('Missing versioned libwhisper.*.*.*.dylib in engine lib')
  }
  const base = path.basename(verPath)
  const link1 = path.join(libDir, 'libwhisper.1.dylib')
  const link0 = path.join(libDir, 'libwhisper.dylib')
  for (const p of [link1, link0]) {
    try {
      fsSync.unlinkSync(p)
    } catch {
      // ignore
    }
  }
  fsSync.symlinkSync(base, link1)
  fsSync.symlinkSync('libwhisper.1.dylib', link0)
}

/** Kall ved behov hvis bruker har ødelagt motor-mappe fra eldre install. */
export function repairDarwinWhisperEngineLibIfNeeded(whisperRoot: string): void {
  if (process.platform !== 'darwin') {
    return
  }
  const libDir = path.join(engineDir(whisperRoot), 'lib')
  if (!fsSync.existsSync(libDir)) {
    return
  }
  const link1 = path.join(libDir, 'libwhisper.1.dylib')
  const verPath = findVersionedLibWhisper(libDir)
  if (!verPath || !fsSync.existsSync(verPath)) {
    return
  }
  try {
    if (fsSync.existsSync(link1)) {
      return
    }
  } catch {
    // existsSync can throw on some edge cases; fall through to repair
  }
  try {
    ensureWhisperLibSymlinks(libDir)
  } catch {
    // ignore: partial/corrupt install
  }
}

function runInstallNameTool(args: string[]): void {
  const r = spawnSync('/usr/bin/install_name_tool', args, { encoding: 'utf8' })
  if (r.status !== 0) {
    throw new Error(
      r.stderr?.trim() ||
        `install_name_tool failed (${r.status}). Install Xcode Command Line Tools if needed.`,
    )
  }
}

function patchDarwinEngineLayout(engineRoot: string): void {
  const binCli = path.join(engineRoot, 'bin', 'whisper-cli')
  const libWhisper = findVersionedLibWhisper(path.join(engineRoot, 'lib'))
  if (!libWhisper) {
    throw new Error('Could not find libwhisper in engine bundle')
  }

  runInstallNameTool([
    '-change',
    '@@HOMEBREW_PREFIX@@/opt/ggml/lib/libggml.0.dylib',
    '@loader_path/../ggml-lib/libggml.0.dylib',
    binCli,
  ])
  runInstallNameTool([
    '-change',
    '@@HOMEBREW_PREFIX@@/opt/ggml/lib/libggml-base.0.dylib',
    '@loader_path/../ggml-lib/libggml-base.0.dylib',
    binCli,
  ])

  runInstallNameTool(['-id', '@loader_path/libwhisper.1.dylib', libWhisper])
  runInstallNameTool([
    '-change',
    '@@HOMEBREW_PREFIX@@/opt/whisper-cpp/lib/libwhisper.1.dylib',
    '@loader_path/libwhisper.1.dylib',
    libWhisper,
  ])
  runInstallNameTool([
    '-change',
    '@@HOMEBREW_PREFIX@@/opt/ggml/lib/libggml.0.dylib',
    '@loader_path/../ggml-lib/libggml.0.dylib',
    libWhisper,
  ])

  // Patch CPU backends to find libomp and libggml
  const binDir = path.join(engineRoot, 'bin')
  for (const name of fsSync.readdirSync(binDir)) {
    if (!name.endsWith('.so')) continue
    const soPath = path.join(binDir, name)
    try {
      runInstallNameTool([
        '-change',
        '@@HOMEBREW_PREFIX@@/opt/libomp/lib/libomp.dylib',
        '@loader_path/../lib/libomp.dylib',
        soPath,
      ])
      runInstallNameTool([
        '-change',
        '@@HOMEBREW_PREFIX@@/opt/ggml/lib/libggml-base.0.dylib',
        '@loader_path/../ggml-lib/libggml-base.0.dylib',
        soPath,
      ])
      runInstallNameTool([
        '-change',
        '@rpath/libggml-base.0.dylib',
        '@loader_path/../ggml-lib/libggml-base.0.dylib',
        soPath,
      ])
    } catch {
      // ignore
    }
  }

  // Rewrite hardcoded ggml libexec location
  const ggmlLibPath = path.join(engineRoot, 'ggml-lib', 'libggml.0.dylib')
  if (fsSync.existsSync(ggmlLibPath)) {
    const buf = fsSync.readFileSync(ggmlLibPath)
    const targetStr = '/opt/homebrew/Cellar/ggml/0.9.8/libexec'
    let pos = buf.indexOf(Buffer.from(targetStr))
    if (pos === -1) {
      pos = buf.indexOf(Buffer.from('@loader_path/../bin'))
    }
    if (pos >= 0) {
      const replace = Buffer.from('.', 'utf8')
      replace.copy(buf, pos)
      const padLen = targetStr.length - replace.length
      if (padLen > 0) {
        buf.fill(0, pos + replace.length, pos + targetStr.length)
      }
      fsSync.writeFileSync(ggmlLibPath, buf)
    }
  }
  runInstallNameTool([
    '-change',
    '@@HOMEBREW_PREFIX@@/opt/ggml/lib/libggml-base.0.dylib',
    '@loader_path/../ggml-lib/libggml-base.0.dylib',
    libWhisper,
  ])

  const ggmlLib = path.join(engineRoot, 'ggml-lib')
  const ggml0 = path.join(ggmlLib, 'libggml.0.dylib')
  const ggmlBase0 = path.join(ggmlLib, 'libggml-base.0.dylib')
  if (fsSync.existsSync(ggml0)) {
    runInstallNameTool(['-id', '@loader_path/libggml.0.dylib', ggml0])
    runInstallNameTool([
      '-change',
      '@@HOMEBREW_PREFIX@@/opt/ggml/lib/libggml.0.dylib',
      '@loader_path/libggml.0.dylib',
      ggml0,
    ])
    runInstallNameTool(['-change', '@rpath/libggml-base.0.dylib', '@loader_path/libggml-base.0.dylib', ggml0])
    const delR = spawnSync('/usr/bin/install_name_tool', ['-delete_rpath', '@loader_path/../lib', ggml0], {
      encoding: 'utf8',
    })
    if (delR.status !== 0) {
      // ignore: some toolchains omit -delete_rpath
    }
  }
  if (fsSync.existsSync(ggmlBase0)) {
    runInstallNameTool(['-id', '@loader_path/libggml-base.0.dylib', ggmlBase0])
    runInstallNameTool([
      '-change',
      '@@HOMEBREW_PREFIX@@/opt/ggml/lib/libggml-base.0.dylib',
      '@loader_path/libggml-base.0.dylib',
      ggmlBase0,
    ])
  }

  for (const dirName of ['bin', 'lib', 'ggml-lib']) {
    const dirPath = path.join(engineRoot, dirName)
    if (!fsSync.existsSync(dirPath)) continue
    for (const name of fsSync.readdirSync(dirPath)) {
      const p = path.join(dirPath, name)
      try {
        if (fsSync.statSync(p).isFile()) {
          spawnSync('/usr/bin/codesign', ['-s', '-', '--force', p], { encoding: 'utf8' })
        }
      } catch {
        // best-effort ad-hoc sign
      }
    }
  }

  try {
    fsSync.chmodSync(binCli, 0o755)
  } catch {
    // ignore
  }
}

async function downloadHomebrewBottle(
  formulaName: 'whisper-cpp' | 'ggml' | 'libomp',
  bottleKey: string,
  destArchive: string,
  onProgress: (received: number, total: number | null) => void,
): Promise<void> {
  const formula = await fetchJson<BrewFormulaJson>(`https://formulae.brew.sh/api/formula/${formulaName}.json`)
  const file = formula.bottle.stable.files[bottleKey]
  if (!file?.url || !file.sha256) {
    throw new Error(`No Homebrew bottle for ${formulaName} (${bottleKey})`)
  }
  const repo = `homebrew/core/${formulaName}`
  const token = await ghcrBearerToken(repo)
  await streamToFileWithProgress(
    file.url,
    destArchive,
    { Authorization: `Bearer ${token}`, Accept: 'application/octet-stream' },
    onProgress,
  )
  const got = await sha256File(destArchive)
  if (got !== file.sha256) {
    await fs.rm(destArchive, { force: true }).catch(() => {})
    throw new Error(`${formulaName} download checksum mismatch`)
  }
}

async function installWindowsEngine(whisperRoot: string, onProgress: (p: EngineDownloadProgress) => void): Promise<void> {
  const destRoot = engineDir(whisperRoot)
  const partial = `${destRoot}.partial`
  await fs.rm(partial, { recursive: true, force: true }).catch(() => {})

  const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'narralab-whisper-win-'))
  const zipPath = path.join(stage, 'whisper.zip')
  try {
    await streamToFileWithProgress(
      WINDOWS_WHISPER_ZIP,
      zipPath,
      undefined,
      (received, total) => onProgress({ part: 'windows-zip', bytesReceived: received, totalBytes: total }),
    )
    const extracted = path.join(stage, 'out')
    await extractArchive(zipPath, extracted)
    const release = path.join(extracted, 'Release')
    if (!fsSync.existsSync(path.join(release, 'whisper-cli.exe'))) {
      throw new Error('Windows bundle missing whisper-cli.exe')
    }
    await fs.mkdir(path.join(partial, 'bin'), { recursive: true })
    for (const name of fsSync.readdirSync(release)) {
      await fs.copyFile(path.join(release, name), path.join(partial, 'bin', name))
    }
    await fs.rm(destRoot, { recursive: true, force: true }).catch(() => {})
    await fs.rename(partial, destRoot)
  } catch (e) {
    await fs.rm(partial, { recursive: true, force: true }).catch(() => {})
    throw e
  } finally {
    await fs.rm(stage, { recursive: true, force: true }).catch(() => {})
  }
}

async function installDarwinEngine(whisperRoot: string, onProgress: (p: EngineDownloadProgress) => void): Promise<void> {
  const keys = pickBottleKeysToTry()
  if (keys.length === 0) {
    throw new Error('Unsupported Mac CPU architecture for automatic engine install')
  }

  const destRoot = engineDir(whisperRoot)
  const partial = `${destRoot}.partial`
  await fs.rm(partial, { recursive: true, force: true }).catch(() => {})

  const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'narralab-whisper-mac-'))
  try {
    let bottleKey: string | null = null
    let lastErr: unknown = null
    const wTar = path.join(stage, 'whisper-cpp.tar.gz')
    const gTar = path.join(stage, 'ggml.tar.gz')

    for (const key of keys) {
      try {
        await downloadHomebrewBottle('whisper-cpp', key, wTar, (received, total) =>
          onProgress({ part: 'whisper-cpp', bytesReceived: received, totalBytes: total }),
        )
        bottleKey = key
        break
      } catch (e) {
        lastErr = e
        await fs.rm(wTar, { force: true }).catch(() => {})
      }
    }
    if (!bottleKey) {
      throw lastErr instanceof Error ? lastErr : new Error('Could not download whisper-cpp for this Mac')
    }

    const ompTar = path.join(stage, 'libomp.tar.gz')
    await downloadHomebrewBottle('ggml', bottleKey, gTar, (received, total) =>
      onProgress({ part: 'ggml', bytesReceived: received, totalBytes: total }),
    )
    await downloadHomebrewBottle('libomp', bottleKey, ompTar, (received, total) =>
      onProgress({ part: 'libomp', bytesReceived: received, totalBytes: total }),
    )

    const wDir = path.join(stage, 'w')
    const gDir = path.join(stage, 'g')
    const oDir = path.join(stage, 'o')
    await extractArchive(wTar, wDir)
    await extractArchive(gTar, gDir)
    await extractArchive(ompTar, oDir)

    const wCellar = path.join(wDir, 'whisper-cpp')
    const gCellar = path.join(gDir, 'ggml')
    const oCellar = path.join(oDir, 'libomp')
    if (!fsSync.existsSync(wCellar) || !fsSync.existsSync(gCellar) || !fsSync.existsSync(oCellar)) {
      throw new Error('Unexpected Homebrew archive layout (missing cellar)')
    }
    const wVers = resolveBottleCellarVersion(wCellar, 'bin/whisper-cli')
    const gVers = resolveBottleCellarVersion(gCellar, 'lib/libggml.0.dylib')
    const oVers = resolveBottleCellarVersion(oCellar, 'lib/libomp.dylib')

    await fs.mkdir(path.join(partial, 'bin'), { recursive: true })
    await fs.mkdir(path.join(partial, 'lib'), { recursive: true })
    await fs.mkdir(path.join(partial, 'ggml-lib'), { recursive: true })

    await fs.copyFile(path.join(wVers, 'bin', 'whisper-cli'), path.join(partial, 'bin', 'whisper-cli'))
    await fs.cp(path.join(wVers, 'lib'), path.join(partial, 'lib'), {
      recursive: true,
      verbatimSymlinks: true,
    })
    await fs.copyFile(path.join(oVers, 'lib', 'libomp.dylib'), path.join(partial, 'lib', 'libomp.dylib'))
    ensureWhisperLibSymlinks(path.join(partial, 'lib'))

    const ggmlLibSrc = path.join(gVers, 'lib')
    for (const name of fsSync.readdirSync(ggmlLibSrc)) {
      if (!name.endsWith('.dylib')) {
        continue
      }
      await fs.copyFile(path.join(ggmlLibSrc, name), path.join(partial, 'ggml-lib', name))
    }

    const libexec = path.join(gVers, 'libexec')
    if (fsSync.existsSync(libexec)) {
      for (const name of fsSync.readdirSync(libexec)) {
        if (!name.endsWith('.so')) {
          continue
        }
        await fs.copyFile(path.join(libexec, name), path.join(partial, 'bin', name))
      }
    }

    patchDarwinEngineLayout(partial)

    await fs.rm(destRoot, { recursive: true, force: true }).catch(() => {})
    await fs.rename(partial, destRoot)
  } catch (e) {
    await fs.rm(partial, { recursive: true, force: true }).catch(() => {})
    throw e
  } finally {
    await fs.rm(stage, { recursive: true, force: true }).catch(() => {})
  }
}

export async function installTranscriptionEngine(params: {
  whisperRoot: string
  onProgress: (p: EngineDownloadProgress) => void
}): Promise<void> {
  const { whisperRoot, onProgress } = params
  await fs.mkdir(whisperRoot, { recursive: true })

  if (process.platform === 'win32') {
    await installWindowsEngine(whisperRoot, onProgress)
    return
  }
  if (process.platform === 'darwin') {
    await installDarwinEngine(whisperRoot, onProgress)
    return
  }
  throw new Error('Automatic engine install is not supported on this OS')
}
