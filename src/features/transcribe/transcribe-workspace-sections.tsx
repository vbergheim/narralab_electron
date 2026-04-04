import { useEffect, useMemo, useState, type CSSProperties, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import {
  Archive,
  CircleStop,
  ClipboardCopy,
  FileAudio,
  FolderOpen,
  Link,
  Loader2,
  MicVocal,
  NotebookPen,
  PanelRightClose,
  PanelRightOpen,
  Radio,
  Save,
  Search,
  Settings,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { ResizeHandle } from '@/features/boards/outline-workspace-shared'
import { usePanelResize } from '@/hooks/use-panel-resize'
import { cn } from '@/lib/cn'
import type { ProjectMeta } from '@/types/project'
import type { Scene } from '@/types/scene'
import type {
  TranscriptHighlight,
  TranscriptionLanguage,
  TranscriptionModelCatalogEntry,
  TranscriptionModelId,
  TranscriptionStatus,
  TranscriptionTimestampInterval,
  TranscriptionItem,
} from '@/types/transcription'

import { TranscriptViewerPanel } from './components/transcript-viewer-panel'
import {
  formatJobElapsed,
  languageOptions,
  selectCls,
  type TranscribeWorkspaceView,
} from './transcribe-workspace-utils'

export function TranscribeWorkspaceHeader({
  activeView,
  setupOk,
  onChangeView,
  onOpenTranscribeSettings,
}: {
  activeView: TranscribeWorkspaceView
  setupOk: boolean
  onChangeView(view: TranscribeWorkspaceView): void
  onOpenTranscribeSettings(): void
}) {
  return (
    <Panel className="shrink-0">
      <div className="flex items-center justify-between border-b border-border/90 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
            <MicVocal className="h-4 w-4 text-accent" />
            <span>Transcribe</span>
          </div>
          {activeView === 'library' ? (
            <div className="mt-1 text-sm text-muted">
              Browse saved transcripts, revise the text, and link each transcript to scenes.
            </div>
          ) : setupOk ? (
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
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-border/70 bg-panelMuted/30 p-1">
            {(['library', 'transcribe'] as const).map((view) => (
              <button
                key={view}
                type="button"
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition',
                  activeView === view
                    ? 'bg-accent text-accent-foreground shadow-sm'
                    : 'text-muted hover:text-foreground',
                )}
                onClick={() => onChangeView(view)}
              >
                {view === 'transcribe' ? 'Transcribe' : 'Library'}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" type="button" onClick={onOpenTranscribeSettings}>
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>
    </Panel>
  )
}

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

export function NewTranscriptionPanel({
  catalogRows,
  modelId,
  language,
  timestampInterval,
  usesCustomTimestampInterval,
  onModelIdChange,
  onLanguageChange,
  onTimestampIntervalChange,
  fileName,
  filePath,
  onDropMedia,
  onPickFile,
  onStart,
  onCancel,
  setupOk,
  hasDownloadedModel,
  jobActive,
  elapsedSec,
  status,
  loadError,
}: {
  catalogRows: Array<TranscriptionModelCatalogEntry & { downloaded: boolean }>
  modelId: TranscriptionModelId
  language: TranscriptionLanguage
  timestampInterval: TranscriptionTimestampInterval
  usesCustomTimestampInterval: boolean
  onModelIdChange(value: TranscriptionModelId): void
  onLanguageChange(value: TranscriptionLanguage): void
  onTimestampIntervalChange(value: TranscriptionTimestampInterval): void
  fileName: string | null
  filePath: string | null
  onDropMedia(event: DragEvent): void
  onPickFile(): void
  onStart(): void
  onCancel(): void
  setupOk: boolean
  hasDownloadedModel: boolean
  jobActive: boolean
  elapsedSec: number
  status: TranscriptionStatus
  loadError: string | null
}) {
  return (
    <Panel className="relative z-10 flex min-h-0 flex-col gap-0 overflow-hidden">
      <div className="shrink-0 border-b border-border/60 px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-muted">
              Model
            </label>
            <select
              className={selectCls}
              value={modelId}
              onChange={(event) => onModelIdChange(event.target.value as TranscriptionModelId)}
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
              onChange={(event) => onLanguageChange(event.target.value as TranscriptionLanguage)}
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
                  const value = event.target.value
                  if (value === 'none' || value === 'segment') {
                    onTimestampIntervalChange(value)
                  } else if (value === 'custom') {
                    onTimestampIntervalChange(typeof timestampInterval === 'number' ? timestampInterval : 60)
                  } else {
                    onTimestampIntervalChange(Number(value))
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
              {usesCustomTimestampInterval ? (
                <div className="relative w-24 shrink-0">
                  <Input
                    type="number"
                    min="1"
                    className="h-10 pr-6"
                    value={typeof timestampInterval === 'number' ? timestampInterval : ''}
                    onChange={(event) => onTimestampIntervalChange(Number(event.target.value) || 1)}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">s</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div
          className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/90 bg-panelMuted/20 px-6 py-8 text-center transition hover:border-accent/40 hover:bg-panelMuted/30"
          onDragOver={(event) => event.preventDefault()}
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
            onClick={onPickFile}
          >
            <FolderOpen className="h-4 w-4" />
            Browse
          </Button>
        </div>
      </div>

      <div className="shrink-0 border-t border-border/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="accent"
            size="sm"
            type="button"
            disabled={!filePath || !setupOk || !hasDownloadedModel || jobActive}
            onClick={onStart}
          >
            {jobActive ? <Loader2 className="h-4 w-4 animate-spin" /> : <MicVocal className="h-4 w-4" />}
            Transcribe
          </Button>
          {jobActive ? (
            <Button variant="ghost" size="sm" type="button" onClick={onCancel}>
              <CircleStop className="h-4 w-4" />
              Cancel
            </Button>
          ) : null}
          {jobActive ? (
            <span className="ml-auto text-xs tabular-nums text-muted">{formatJobElapsed(elapsedSec)}</span>
          ) : null}
        </div>

        {status.phase !== 'idle' || status.message ? (
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
      </div>
    </Panel>
  )
}

export function LibraryEmptyState() {
  return (
    <Panel className="flex h-full min-h-[min(36vh,240px)] flex-col overflow-hidden lg:min-h-0">
      <div className="flex shrink-0 items-center justify-between border-b border-border/90 px-5 py-4">
        <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
          Transcript Details
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
        <div className="max-w-sm text-sm text-muted">
          Select a saved transcript from the library to inspect metadata, revise text, and link it to a scene.
        </div>
      </div>
    </Panel>
  )
}

export function SavedTranscriptionMetadataPanel({
  filePath,
  selectedItem,
  selectedItemId,
  selectedSceneId,
  scenes,
  isSaving,
  resultText,
  onCollapse,
  onLinkScene,
  onSaveToArchive,
  onTranscribeAgain,
}: {
  filePath: string | null
  selectedItem: TranscriptionItem | undefined
  selectedItemId: string | null
  selectedSceneId: string | null
  scenes: Scene[]
  isSaving: boolean
  resultText: string
  onCollapse?(): void
  onLinkScene(sceneId: string | null): void
  onSaveToArchive(): void
  onTranscribeAgain(): void
}) {
  return (
    <Panel className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border/90 px-5 py-4">
        <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
          Metadata
        </div>
        {onCollapse ? (
          <Button variant="ghost" size="sm" type="button" onClick={onCollapse} title="Collapse metadata" aria-label="Collapse metadata">
            <PanelRightClose className="h-4 w-4" />
          </Button>
        ) : null}
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
              {selectedItem?.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : 'N/A'}
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              <Link className="h-3 w-3" />
              Linked Scene
            </label>
            <div className="mt-2">
              <LinkedScenePicker
                scenes={scenes}
                selectedSceneId={selectedSceneId}
                disabled={isSaving}
                onSelectScene={onLinkScene}
              />
            </div>
          </div>

          <div className="space-y-2 pt-4">
            <Button
              variant="accent"
              size="sm"
              className="w-full"
              disabled={!resultText.trim() || !selectedItem}
              onClick={onSaveToArchive}
            >
              <Archive className="h-4 w-4" />
              Save to Archive
            </Button>
            <Button
              variant="default"
              size="sm"
              className="w-full"
              disabled={!filePath || !selectedItemId}
              onClick={onTranscribeAgain}
            >
              <MicVocal className="h-4 w-4" />
              Transcribe Again
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  )
}

function LinkedScenePicker({
  scenes,
  selectedSceneId,
  disabled,
  onSelectScene,
}: {
  scenes: Scene[]
  selectedSceneId: string | null
  disabled: boolean
  onSelectScene(sceneId: string | null): void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const pickerResize = usePanelResize({
    initial: 720,
    min: 420,
    max: 1100,
    storageKey: 'narralab:transcribe-linked-scene-picker-width',
  })

  const selectedScene = useMemo(
    () => scenes.find((scene) => scene.id === selectedSceneId) ?? null,
    [scenes, selectedSceneId],
  )

  const filteredScenes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return scenes
    return scenes.filter((scene) => {
      const haystacks = [
        scene.title,
        scene.synopsis,
        scene.folder,
        scene.category,
        scene.location,
      ]
      return haystacks.some((value) => value.toLowerCase().includes(normalizedQuery))
    })
  }, [query, scenes])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const selectScene = (sceneId: string | null) => {
    onSelectScene(sceneId)
    setIsOpen(false)
    setQuery('')
  }

  const pickerStyle = {
    '--transcribe-scene-picker-width': `${pickerResize.size}px`,
  } as CSSProperties

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-border/80 bg-panelMuted/20 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={cn('truncate text-sm font-medium', selectedScene ? 'text-foreground' : 'text-muted')}>
              {selectedScene ? selectedScene.title : 'No scene linked'}
            </div>
            <div className="mt-1 text-xs text-muted">
              {selectedScene ? formatScenePickerMeta(selectedScene) : `${scenes.length} scenes available`}
            </div>
          </div>
          {selectedSceneId ? (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={disabled}
              onClick={() => selectScene(null)}
            >
              <X className="h-4 w-4" />
              Clear
            </Button>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="default"
            size="sm"
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen(true)}
          >
            <PanelRightOpen className="h-4 w-4" />
            Browse Scenes
          </Button>
        </div>
      </div>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] bg-black/45 backdrop-blur-sm"
              onClick={() => {
                setIsOpen(false)
                setQuery('')
              }}
            >
              <div
                className="fixed inset-4 z-[201] flex min-h-0 items-center justify-center"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex min-h-0 max-h-full max-w-full items-stretch" style={pickerStyle}>
                  <div className="hidden sm:flex sm:h-full sm:items-stretch">
                    <ResizeHandle
                      label="Resize linked scene picker"
                      active={pickerResize.isResizing}
                      onPointerDown={pickerResize.startResize(-1)}
                    />
                  </div>
                  <Panel className="flex h-[min(78vh,720px)] min-h-0 w-[min(var(--transcribe-scene-picker-width),calc(100vw-3rem))] min-w-[min(26rem,calc(100vw-3rem))] max-w-[calc(100vw-3rem)] flex-col overflow-hidden">
                    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 truncate font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
                          <Radio className="h-4 w-4 text-accent" />
                          <span>Link Scene</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {selectedSceneId ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            disabled={disabled}
                            onClick={() => selectScene(null)}
                          >
                            Clear
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setIsOpen(false)
                            setQuery('')
                          }}
                          aria-label="Close scene picker"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="shrink-0 border-b border-border/60 px-4 py-3">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                        <Input
                          autoFocus
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          className="pl-9"
                          placeholder="Search scenes by title, folder, category…"
                        />
                      </div>
                      <div className="mt-2 text-xs text-muted">
                        {filteredScenes.length === scenes.length
                          ? `${scenes.length} scenes`
                          : `${filteredScenes.length} of ${scenes.length} scenes`}
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto bg-panelMuted/10 px-3 py-3">
                      {filteredScenes.length > 0 ? (
                        <div className="space-y-2">
                          {filteredScenes.map((scene) => {
                            const active = scene.id === selectedSceneId
                            return (
                              <button
                                key={scene.id}
                                type="button"
                                className={cn(
                                  'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition',
                                  active
                                    ? 'border-accent/55 bg-accent/12 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]'
                                    : 'border-border/60 bg-panel/80 hover:border-accent/30 hover:bg-panelMuted/70',
                                )}
                                onClick={() => selectScene(scene.id)}
                              >
                                <div
                                  className={cn(
                                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                                    active
                                      ? 'border-accent bg-accent text-accent-foreground'
                                      : 'border-border/80 bg-panel text-transparent',
                                  )}
                                >
                                  <div className="h-2.5 w-2.5 rounded-full bg-current" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="truncate font-medium text-foreground">{scene.title}</div>
                                    {active ? (
                                      <div className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                                        Linked
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="mt-1 text-xs text-muted">{formatScenePickerMeta(scene)}</div>
                                  {scene.synopsis.trim() ? (
                                    <div className="mt-1.5 line-clamp-2 text-sm text-foreground/75">{scene.synopsis}</div>
                                  ) : null}
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="px-4 py-10 text-sm text-muted">
                          No scenes match the current search.
                        </div>
                      )}
                    </div>
                  </Panel>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

function formatScenePickerMeta(scene: Scene) {
  const parts = [scene.folder || null, scene.category || null, scene.location || null].filter(
    (value): value is string => Boolean(value && value.trim()),
  )
  return parts.length > 0 ? parts.join(' · ') : 'No folder or category'
}

export function TranscriptPanel({
  resultText,
  highlights,
  projectMeta,
  selectedItemId,
  subtitle,
  isSaving,
  hasChanges,
  onCopy,
  onAppendNotebook,
  onSaveChanges,
  onSaveToLibrary,
  onSaveTxt,
  onDetach,
  onResultTextChange,
  onHighlightsChange,
}: {
  resultText: string
  highlights?: TranscriptHighlight[]
  projectMeta: ProjectMeta | null
  selectedItemId: string | null
  subtitle?: string | null
  isSaving: boolean
  hasChanges: boolean
  onCopy(): void
  onAppendNotebook(): void
  onSaveChanges(): void
  onSaveToLibrary(): void
  onSaveTxt(): void
  onDetach?(): void
  onResultTextChange(value: string): void
  onHighlightsChange?(value: TranscriptHighlight[]): void
}) {
  return (
    <TranscriptViewerPanel
      title="Transcript"
      subtitle={subtitle ?? null}
      text={resultText}
      editable
      highlights={highlights}
      onTextChange={onResultTextChange}
      onHighlightsChange={onHighlightsChange}
      placeholder="Transcript will appear here when the job completes…"
      onDetach={selectedItemId ? onDetach : undefined}
      toolbarActions={
        <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            type="button"
            disabled={!resultText}
            onClick={onCopy}
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
            onClick={onAppendNotebook}
          >
            <NotebookPen className="h-4 w-4" />
            Notebook
          </Button>
          {selectedItemId ? (
            <Button
              variant={hasChanges ? 'accent' : 'ghost'}
              size="sm"
              type="button"
              disabled={!resultText || isSaving || !hasChanges}
              onClick={onSaveChanges}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className={cn('h-4 w-4', !hasChanges && 'text-muted-foreground')} />
              )}
              {hasChanges ? 'Save Changes' : 'Saved'}
            </Button>
          ) : (
            <div className="flex max-w-full flex-wrap items-center justify-end gap-1">
              <Button
                variant="accent"
                size="sm"
                type="button"
                disabled={!resultText || isSaving}
                onClick={onSaveToLibrary}
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
                onClick={onSaveTxt}
              >
                <FolderOpen className="h-4 w-4" />
                Export to File
              </Button>
            </div>
          )}
        </div>
      }
    />
  )
}
