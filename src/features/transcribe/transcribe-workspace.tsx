import { useEffect, useState, useCallback } from 'react'
import {
  CircleStop,
  ClipboardCopy,
  FileAudio,
  FolderOpen,
  Loader2,
  MicVocal,
  NotebookPen,
  Save,
  Settings,
  Link,
  Archive,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import type { AppSettings, AppSettingsUpdateInput } from '@/types/ai'
import type { NotebookDocument, ProjectMeta } from '@/types/project'
import type { Scene } from '@/types/scene'
import {
  TRANSCRIPTION_MODEL_CATALOG,
  type TranscriptionLanguage,
  type TranscriptionModelId,
  type TranscriptionProgressEvent,
  type TranscriptionStatus,
  type TranscriptionTimestampInterval,
  type TranscriptionFolder,
  type TranscriptionItem,
} from '@/types/transcription'
import type { TranscriptionSetup } from '@/types/project'
import { TranscriptionLibrarySidebar } from './components/transcription-library-sidebar'

const presetTimestampIntervals: ReadonlyArray<TranscriptionTimestampInterval> = ['none', 'segment', 30, 60, 120, 300, 600, 1800]

type Props = {
  projectMeta: ProjectMeta | null
  settings: AppSettings
  onSaveAppSettings(input: AppSettingsUpdateInput): Promise<void>
  onNotebookSynced(document: NotebookDocument): void
  onOpenTranscribeSettings(): void
}

function formatJobElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const m = Math.floor(seconds / 60)
  const r = seconds % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

const languageOptions: Array<{ value: TranscriptionLanguage; label: string }> = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'nb', label: 'Norwegian Bokmål' },
  { value: 'nn', label: 'Norwegian Nynorsk' },
  { value: 'en', label: 'English' },
  { value: 'sv', label: 'Swedish' },
  { value: 'da', label: 'Danish' },
  { value: 'de', label: 'German' },
  { value: 'fr', label: 'French' },
  { value: 'es', label: 'Spanish' },
]

const selectCls =
  'h-10 w-full appearance-none rounded-xl border border-border bg-panel pl-3 pr-10 text-sm text-foreground outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20 bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20fill%3D%27none%27%20viewBox%3D%270%200%2020%2020%27%3E%3Cpath%20stroke%3D%27%236b7280%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%20stroke-width%3D%271.5%27%20d%3D%27m6%208%204%204%204-4%27%2F%3E%3C%2Fsvg%3E")] bg-[position:right_0.5rem_center] bg-[length:1.25rem_1.25rem] bg-no-repeat'

function TranscriptionProgressBar({ status }: { status: TranscriptionStatus }) {
  const active = status.phase === 'preparing' || status.phase === 'transcribing'
  if (!active) {
    return null
  }
  const p = status.progress
  const hasNumericProgress =
    status.phase === 'transcribing' && typeof p === 'number' && p > 0 && p <= 1

  return (
    <div className="mt-2 space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-panelMuted">
        {hasNumericProgress ? (
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, Math.round(p * 100)))}%` }}
          />
        ) : (
          <div className="relative h-full w-full overflow-hidden rounded-full">
            <div className="absolute inset-y-0 w-2/5 rounded-full bg-accent motion-safe:animate-transcribe-indeterminate" />
          </div>
        )}
      </div>
      {hasNumericProgress ? (
        <div className="text-[11px] tabular-nums text-muted">{Math.round(Math.min(1, Math.max(0, p)) * 100)}%</div>
      ) : null}
    </div>
  )
}

export function TranscribeWorkspace({
  projectMeta,
  settings,
  onSaveAppSettings,
  onNotebookSynced,
  onOpenTranscribeSettings,
}: Props) {
  const [setup, setSetup] = useState<TranscriptionSetup | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [modelId, setModelId] = useState<TranscriptionModelId>(settings.transcription.modelId)
  const [language, setLanguage] = useState<TranscriptionLanguage>(settings.transcription.language)
  const [timestampInterval, setTimestampInterval] = useState<TranscriptionTimestampInterval>(
    settings.transcription.timestampInterval,
  )
  const [status, setStatus] = useState<TranscriptionStatus>({ phase: 'idle', message: '' })
  const [resultText, setResultText] = useState('')
  const [elapsedSec, setElapsedSec] = useState(0)

  // Library state
  const [libraryFolders, setLibraryFolders] = useState<TranscriptionFolder[]>([])
  const [libraryItems, setLibraryItems] = useState<TranscriptionItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isNewTranscription, setIsNewTranscription] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Project data for linking
  const [scenes, setScenes] = useState<Scene[]>([])

  const jobActive = status.phase === 'preparing' || status.phase === 'transcribing'
  const usesCustomTimestampInterval = !presetTimestampIntervals.some((entry) => entry === timestampInterval)

  useEffect(() => {
    if (!jobActive) return
    const t0 = Date.now()
    const tick = () => setElapsedSec(Math.floor((Date.now() - t0) / 1000))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [jobActive])

  const refreshSetup = useCallback(async () => {
    try {
      const next = await window.narralab.transcription.getSetup()
      setSetup(next)
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load transcription setup')
    }
  }, [])

  const refreshLibrary = useCallback(async () => {
    try {
      const [folders, items] = await Promise.all([
        window.narralab.transcription.library.folders.list(),
        window.narralab.transcription.library.items.list()
      ])
      setLibraryFolders(folders)
      setLibraryItems(items)
    } catch (e) {
      console.error('Failed to load library:', e)
    }
  }, [])

  const refreshScenes = useCallback(async () => {
    try {
      const list = await window.narralab.scenes.list()
      setScenes(list)
    } catch (e) {
      console.error('Failed to load scenes:', e)
    }
  }, [])

  useEffect(() => {
    void refreshSetup()
    void refreshLibrary()
    void refreshScenes()
  }, [refreshSetup, refreshLibrary, refreshScenes])

  useEffect(() => {
    setModelId(settings.transcription.modelId)
    setLanguage(settings.transcription.language)
    setTimestampInterval(settings.transcription.timestampInterval)
  }, [settings.transcription.language, settings.transcription.modelId, settings.transcription.timestampInterval])

  useEffect(() => {
    const dispose = window.narralab.transcription.subscribe(async (event: TranscriptionProgressEvent) => {
      if (event.type === 'status') {
        setStatus(event.payload)
        if (event.payload.phase === 'complete' && event.payload.resultText) {
          const text = event.payload.resultText
          setResultText(text)

          // Auto-save to library
          if (filePath) {
            const name = filePath.split(/[/\\]/).pop() || 'Untitled'
            try {
              const newItem = await window.narralab.transcription.library.items.create({
                name,
                content: text,
                sourceFilePath: filePath
              })
              await refreshLibrary()
              setSelectedItemId(newItem.id)
              setIsNewTranscription(false)
            } catch (e) {
              console.error('Failed to auto-save:', e)
            }
          }
        }
        if (event.payload.phase === 'error') {
          setResultText('')
        }
      }
    })
    return dispose
  }, [filePath, refreshLibrary])

  const handleSelectItem = useCallback((itemId: string) => {
    const item = libraryItems.find(i => i.id === itemId)
    if (item) {
      setSelectedItemId(itemId)
      setResultText(item.content)
      setIsNewTranscription(false)
      setFilePath(item.sourceFilePath)
      // If we are looking at a saved item, reset live status
      setStatus({ phase: 'idle', message: '' })
    }
  }, [libraryItems])

  // Sync from global selection
  useEffect(() => {
    const dispose = window.narralab.windows.subscribe((event) => {
      if (event.type === 'project-changed') {
        if (event.payload.scopes.includes('all') || event.payload.scopes.includes('transcription-library')) {
          void refreshLibrary()
        }
        if (event.payload.scopes.includes('all') || event.payload.scopes.includes('scenes')) {
          void refreshScenes()
        }
        return
      }

      if (event.type === 'global-ui-state' && event.payload.selectedTranscriptionItemId) {
        handleSelectItem(event.payload.selectedTranscriptionItemId)
        // Clear it so it doesn't re-trigger on next sync if we select something else
        void window.narralab.windows.updateGlobalUiState({ selectedTranscriptionItemId: null })
      }
    })
    return dispose
  }, [handleSelectItem, refreshLibrary, refreshScenes])

  const pickFile = async () => {
    const path = await window.narralab.transcription.pickFile()
    if (path) {
      setFilePath(path)
    }
  }

  const onDropMedia = (event: React.DragEvent) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files)
    const paths = window.narralab.archive.items.resolveDroppedPaths(files)
    if (paths[0]) {
      setFilePath(paths[0])
    }
  }

  const start = async () => {
    if (!filePath) return
    setResultText('')
    setLoadError(null)
    setStatus({ phase: 'preparing', message: 'Starting…' })
    try {
      setIsNewTranscription(true)
      setSelectedItemId(null)
      await onSaveAppSettings({
        transcriptionModelId: modelId,
        transcriptionLanguage: language,
        transcriptionTimestampInterval: timestampInterval,
      })
      await window.narralab.transcription.start({ filePath, modelId, language, timestampInterval })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setStatus({ phase: 'error', message: 'Failed to start', error: msg })
    }
  }

  const cancel = async () => {
    await window.narralab.transcription.cancel()
  }

  const copyResult = async () => {
    if (!resultText) return
    await navigator.clipboard.writeText(resultText)
  }

  const saveTxt = async () => {
    if (!resultText.trim()) return
    await window.narralab.transcription.saveAs(resultText)
  }

  const handleSaveToLibrary = async () => {
    if (!resultText.trim() || isSaving) return
    setIsSaving(true)
    try {
      const name = filePath?.split(/[/\\]/).pop() || 'Untitled'
      const newItem = await window.narralab.transcription.library.items.create({
        name,
        content: resultText,
        sourceFilePath: filePath
      })
      // Pre-emptively update local state so selection works immediately
      setLibraryItems(prev => [...prev, newItem])
      setSelectedItemId(newItem.id)
      setIsNewTranscription(false)
      await refreshLibrary() // Silent background refresh
    } catch (e) {
      console.error('Failed to save to library:', e)
    } finally {
      setIsSaving(false)
    }
  }

  const appendNotebook = async () => {
    if (!resultText.trim()) return
    const doc = await window.narralab.transcription.appendNotebook(resultText)
    onNotebookSynced(doc)
  }

  const catalogRows =
    setup?.catalog ??
    TRANSCRIPTION_MODEL_CATALOG.map((entry) => ({
      ...entry,
      downloaded: false,
    }))

  const ffmpegOk = setup?.ffmpegPath
  const whisperOk = setup?.whisperPath
  const setupOk = ffmpegOk && whisperOk
  const hasDownloadedModel = catalogRows.some((e) => e.downloaded)

  // File name for display
  const fileName = filePath ? filePath.split(/[/\\]/).pop() : null

  const handleNewTranscription = () => {
    setIsNewTranscription(true)
    setSelectedItemId(null)
    setResultText('')
    setFilePath(null)
    setStatus({ phase: 'idle', message: '' })
  }

  const selectedItem = libraryItems.find(i => i.id === selectedItemId)
  const hasChanges = selectedItem ? resultText !== selectedItem.content : false

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      {/* Header bar */}
      <Panel className="shrink-0">
        <div className="flex items-center justify-between border-b border-border/90 px-5 py-4">
          <div>
            <div className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
              <MicVocal className="h-4 w-4 text-accent" />
              <span>Transcribe</span>
            </div>
            {setupOk ? (
              <div className="mt-1 text-sm text-muted">
                Select a file and model to transcribe audio or video locally.
              </div>
            ) : (
              <div className="mt-1 text-sm text-amber-300">
                Engine or FFmpeg not ready.{' '}
                <button
                  type="button"
                  className="underline underline-offset-2 hover:text-amber-200"
                  onClick={onOpenTranscribeSettings}
                >
                  Open Settings → Transcribe
                </button>{' '}
                to download them.
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" type="button" onClick={onOpenTranscribeSettings}>
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </Panel>

      {/* Main content */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[260px_1fr_1fr]">
        <TranscriptionLibrarySidebar
          folders={libraryFolders}
          items={libraryItems}
          selectedItemId={selectedItemId}
          onSelectItem={handleSelectItem}
          onCreateFolder={async (name, parentPath) => {
            await window.narralab.transcription.library.folders.create(name, parentPath)
            await refreshLibrary()
          }}
          onUpdateFolder={async (currentPath, input) => {
            await window.narralab.transcription.library.folders.update(currentPath, input)
            await refreshLibrary()
          }}
          onDeleteFolder={async (currentPath) => {
            await window.narralab.transcription.library.folders.delete(currentPath)
            await refreshLibrary()
          }}
          onMoveItemsToFolder={async (itemIds, folderPath) => {
            await Promise.all(
              itemIds.map((id) =>
                window.narralab.transcription.library.items.update({ id, folder: folderPath }),
              ),
            )
            await refreshLibrary()
          }}
          onUpdateItem={async (id, name) => {
            await window.narralab.transcription.library.items.update({ id, name })
            await refreshLibrary()
          }}
          onDeleteItem={async (id) => {
            await window.narralab.transcription.library.items.delete(id)
            if (id === selectedItemId) handleNewTranscription()
            await refreshLibrary()
          }}
          onNewTranscription={handleNewTranscription}
        />

        {isNewTranscription ? (
          <Panel className="relative z-10 flex min-h-0 flex-col gap-0 overflow-hidden">
            {/* Model + Language + Timestamps selectors */}
            <div className="shrink-0 border-b border-border/60 px-5 py-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-muted">
                    Model
                  </label>
                  <select
                    className={selectCls}
                    value={modelId}
                    onChange={(event) => setModelId(event.target.value as TranscriptionModelId)}
                  >
                    {catalogRows.map((entry) => (
                      <option key={entry.id} value={entry.id} disabled={!entry.downloaded && entry.id !== modelId}>
                        {entry.label}
                        {!entry.downloaded ? ' (download in Settings)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-muted">
                    Language
                  </label>
                  <select
                    className={selectCls}
                    value={language}
                    onChange={(event) => setLanguage(event.target.value as TranscriptionLanguage)}
                  >
                    {languageOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-muted">
                    Timestamps
                  </label>
                  <div className="flex gap-2">
                    <select
                      className={selectCls}
                      value={usesCustomTimestampInterval ? 'custom' : String(timestampInterval)}
                      onChange={(event) => {
                        const v = event.target.value
                        if (v === 'none' || v === 'segment') {
                          setTimestampInterval(v)
                        } else if (v === 'custom') {
                          // Keep current if it's already a number, or default to 60
                          setTimestampInterval(typeof timestampInterval === 'number' ? timestampInterval : 60)
                        } else {
                          setTimestampInterval(Number(v))
                        }
                      }}
                    >
                      <option value="none">None</option>
                      <option value="segment">Each segment</option>
                      <option value="30">30 seconds</option>
                      <option value="60">1 minute</option>
                      <option value="120">2 minutes</option>
                      <option value="300">5 minutes</option>
                      <option value="600">10 minutes</option>
                      <option value="1800">30 minutes</option>
                      <option value="custom">Custom...</option>
                    </select>
                    {usesCustomTimestampInterval && (
                      <div className="relative w-24 shrink-0">
                        <Input
                          type="number"
                          min="1"
                          className="h-10 pr-6"
                          value={typeof timestampInterval === 'number' ? timestampInterval : ''}
                          onChange={(e) => setTimestampInterval(Number(e.target.value) || 1)}
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">s</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Drop zone */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div
                className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/90 bg-panelMuted/20 px-6 py-8 text-center transition hover:border-accent/40 hover:bg-panelMuted/30"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDropMedia}
              >
                <FileAudio className="h-9 w-9 text-muted/60" />
                <div className="mt-3 text-sm font-medium text-foreground">Drop media file here</div>
                <div className="mt-1 text-xs text-muted">or browse to select a file</div>
                {fileName ? (
                  <div className="mt-3 max-w-xs truncate rounded-lg border border-border bg-panelMuted px-3 py-1.5 text-xs text-foreground">
                    {fileName}
                  </div>
                ) : (
                  <Input
                    className="mt-3 max-w-xs text-left text-xs"
                    readOnly
                    value={filePath ?? ''}
                    placeholder="No file selected"
                  />
                )}
                <Button
                  variant="accent"
                  size="sm"
                  type="button"
                  className="mt-4"
                  onClick={() => void pickFile()}
                >
                  <FolderOpen className="h-4 w-4" />
                  Browse
                </Button>
              </div>
            </div>

            {/* Action bar */}
            <div className="shrink-0 border-t border-border/60 px-5 py-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="accent"
                  size="sm"
                  type="button"
                  disabled={!filePath || !setupOk || !hasDownloadedModel || jobActive}
                  onClick={() => void start()}
                >
                  {jobActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <MicVocal className="h-4 w-4" />}
                  Transcribe
                </Button>
                {jobActive ? (
                  <Button variant="ghost" size="sm" type="button" onClick={() => void cancel()}>
                    <CircleStop className="h-4 w-4" />
                    Cancel
                  </Button>
                ) : null}
                {jobActive ? (
                  <span className="ml-auto text-xs tabular-nums text-muted">{formatJobElapsed(elapsedSec)}</span>
                ) : null}
              </div>

              {/* Status */}
              {(status.phase !== 'idle' || status.message) ? (
                <div className="mt-3">
                  <TranscriptionProgressBar status={status} />
                  {status.message ? (
                    <div className="mt-1.5 text-xs text-muted">{status.message}</div>
                  ) : null}
                  {status.error ? (
                    <div className="mt-1 text-xs text-red-300">{status.error}</div>
                  ) : null}
                </div>
              ) : null}

              {loadError ? (
                <div className="mt-2 text-xs text-red-300">{loadError}</div>
              ) : null}

              {/* Save to Library shortcut in center panel */}
              {resultText.trim() && !jobActive && (
                <div className="mt-4 border-t border-border/40 pt-4">
                  <Button
                    variant="accent"
                    size="sm"
                    className="w-full"
                    disabled={isSaving}
                    onClick={() => void handleSaveToLibrary()}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save to Library
                  </Button>
                  <p className="mt-2 text-center text-xs text-muted">
                    Save this transcript to enable scene linking and organization.
                  </p>
                </div>
              )}
            </div>
          </Panel>
        ) : (
          <Panel className="flex flex-col overflow-hidden">
            <div className="flex shrink-0 items-center justify-between border-b border-border/90 px-5 py-4">
              <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
                Metadata
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-5 text-sm">
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted">Source File</label>
                  <div className="mt-1.5 break-all text-foreground/80">{filePath ?? 'Unknown'}</div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted">Transcription Date</label>
                  <div className="mt-1.5 text-foreground/80">
                    {selectedItem?.createdAt 
                      ? new Date(selectedItem.createdAt).toLocaleString()
                      : 'N/A'
                    }
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                    <Link className="h-3 w-3" />
                    Linked Scene
                  </label>
                  <select
                    className={cn(selectCls, "mt-2 h-9 rounded-lg")}
                    value={selectedItem?.sceneId ?? ''}
                    disabled={isSaving}
                    onChange={async (e) => {
                      if (!selectedItemId) return
                      const nextSceneId = e.target.value || null
                      setIsSaving(true)
                      try {
                        await window.narralab.transcription.library.items.update({
                          id: selectedItemId,
                          sceneId: nextSceneId
                        })
                        await refreshLibrary()
                      } catch (e) {
                        console.error('Failed to link scene:', e)
                      } finally {
                        setIsSaving(false)
                      }
                    }}
                  >
                    <option value="">(None)</option>
                    {scenes.map(scene => (
                      <option key={scene.id} value={scene.id}>{scene.title}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 pt-4">
                  <Button 
                    variant="accent" 
                    size="sm" 
                    className="w-full"
                    disabled={!resultText.trim() || !selectedItem}
                    onClick={async () => {
                      if (!selectedItem) return
                      await window.narralab.transcription.saveToArchive({
                        name: selectedItem.name,
                        content: resultText
                      })
                    }}
                  >
                    <Archive className="h-4 w-4" />
                    Save to Archive
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="w-full"
                    disabled={!filePath}
                    onClick={() => window.narralab.transcription.start({ filePath: filePath!, modelId })}
                  >
                    <MicVocal className="h-4 w-4" />
                    Transcribe Again
                  </Button>
                </div>
              </div>
            </div>
          </Panel>
        )}

        {/* Right panel: transcript */}
        <Panel className="relative z-0 flex min-h-[min(36vh,240px)] flex-col overflow-hidden lg:min-h-0">
          <div className="flex shrink-0 items-center justify-between border-b border-border/90 px-5 py-4">
            <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
              Transcript
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={!resultText}
                onClick={() => void copyResult()}
              >
                <ClipboardCopy className="h-4 w-4" />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={!resultText || !projectMeta}
                title={!projectMeta ? 'Open a project to append to notebook' : undefined}
                onClick={() => void appendNotebook()}
              >
                <NotebookPen className="h-4 w-4" />
                Notebook
              </Button>
              {selectedItemId ? (
                <Button
                  variant={hasChanges ? "accent" : "ghost"}
                  size="sm"
                  type="button"
                  disabled={!resultText || isSaving || !hasChanges}
                  onClick={async () => {
                    if (!selectedItemId) return
                    setIsSaving(true)
                    try {
                      await window.narralab.transcription.library.items.update({ id: selectedItemId, content: resultText })
                      await refreshLibrary()
                    } catch (e) {
                      console.error('Failed to save changes:', e)
                    } finally {
                      setIsSaving(false)
                    }
                  }}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className={cn("h-4 w-4", !hasChanges && "text-muted-foreground")} />
                  )}
                  {hasChanges ? "Save Changes" : "Saved"}
                </Button>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    variant="accent"
                    size="sm"
                    type="button"
                    disabled={!resultText || isSaving}
                    onClick={() => void handleSaveToLibrary()}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save to Library
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={!resultText || isSaving}
                    onClick={() => void saveTxt()}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Export to File
                  </Button>
                </div>
              )}
            </div>
          </div>
          <Textarea
            className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-sm focus:ring-0"
            value={resultText}
            onChange={(event) => {
              setResultText(event.target.value)
              if (selectedItemId) {
                // We could debounced save here, but for now just manual save button
              }
            }}
            placeholder="Transcript will appear here when the job completes…"
          />
        </Panel>
      </div>
    </div>
  )
}
