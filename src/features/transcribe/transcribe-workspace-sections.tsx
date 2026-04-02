import type { DragEvent } from 'react'
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
  Save,
  Settings,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/cn'
import type { ProjectMeta } from '@/types/project'
import type { Scene } from '@/types/scene'
import type {
  TranscriptionLanguage,
  TranscriptionModelCatalogEntry,
  TranscriptionModelId,
  TranscriptionStatus,
  TranscriptionTimestampInterval,
  TranscriptionItem,
} from '@/types/transcription'

import { formatJobElapsed, languageOptions, selectCls } from './transcribe-workspace-utils'

export function TranscribeWorkspaceHeader({
  setupOk,
  onOpenTranscribeSettings,
}: {
  setupOk: boolean
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
  resultText,
  isSaving,
  onSaveToLibrary,
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
  resultText: string
  isSaving: boolean
  onSaveToLibrary(): void
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

        {resultText.trim() && !jobActive ? (
          <div className="mt-4 border-t border-border/40 pt-4">
            <Button
              variant="accent"
              size="sm"
              className="w-full"
              disabled={isSaving}
              onClick={onSaveToLibrary}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save to Library
            </Button>
            <p className="mt-2 text-center text-xs text-muted">
              Save this transcript to enable scene linking and organization.
            </p>
          </div>
        ) : null}
      </div>
    </Panel>
  )
}

export function SavedTranscriptionMetadataPanel({
  filePath,
  selectedItem,
  selectedItemId,
  scenes,
  isSaving,
  resultText,
  onLinkScene,
  onSaveToArchive,
  onTranscribeAgain,
}: {
  filePath: string | null
  selectedItem: TranscriptionItem | undefined
  selectedItemId: string | null
  scenes: Scene[]
  isSaving: boolean
  resultText: string
  onLinkScene(sceneId: string | null): void
  onSaveToArchive(): void
  onTranscribeAgain(): void
}) {
  return (
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
              {selectedItem?.createdAt ? new Date(selectedItem.createdAt).toLocaleString() : 'N/A'}
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
              <Link className="h-3 w-3" />
              Linked Scene
            </label>
            <select
              className={cn(selectCls, 'mt-2 h-9 rounded-lg')}
              value={selectedItem?.sceneId ?? ''}
              disabled={isSaving}
              onChange={(event) => onLinkScene(event.target.value || null)}
            >
              <option value="">(None)</option>
              {scenes.map((scene) => (
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

export function TranscriptPanel({
  resultText,
  projectMeta,
  selectedItemId,
  isSaving,
  hasChanges,
  onCopy,
  onAppendNotebook,
  onSaveChanges,
  onSaveToLibrary,
  onSaveTxt,
  onResultTextChange,
}: {
  resultText: string
  projectMeta: ProjectMeta | null
  selectedItemId: string | null
  isSaving: boolean
  hasChanges: boolean
  onCopy(): void
  onAppendNotebook(): void
  onSaveChanges(): void
  onSaveToLibrary(): void
  onSaveTxt(): void
  onResultTextChange(value: string): void
}) {
  return (
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
            <div className="flex items-center gap-1">
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
      </div>
      <Textarea
        className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-sm focus:ring-0"
        value={resultText}
        onChange={(event) => onResultTextChange(event.target.value)}
        placeholder="Transcript will appear here when the job completes…"
      />
    </Panel>
  )
}
