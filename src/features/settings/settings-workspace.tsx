import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { Download, KeyRound, Loader2, Mic, Save, Settings2, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { Textarea } from '@/components/ui/textarea'
import { boardBlockKinds, geminiModelOptions, openAiModelOptions } from '@/lib/constants'
import type { AppSettings, AppSettingsUpdateInput } from '@/types/ai'
import type { ProjectSettings, ProjectSettingsUpdateInput, TranscriptionSetup } from '@/types/project'
import {
  TRANSCRIPTION_MODEL_CATALOG,
  type TranscriptionEngineDownloadPart,
  type TranscriptionLanguage,
  type TranscriptionModelId,
  type TranscriptionProgressEvent,
  type TranscriptionTimestampInterval,
} from '@/types/transcription'

type Props = {
  settings: AppSettings
  projectSettings: ProjectSettings | null
  busy: boolean
  onSaveApp(input: AppSettingsUpdateInput): void
  onSaveProject(input: ProjectSettingsUpdateInput): void
  /** When requestId changes, switch to this tab (e.g. open Transcribe from the transcribe window). */
  navigateToTab?: { tab: SettingsTab; requestId: number }
}

export type SettingsTab = 'app' | 'project' | 'ai' | 'transcribe'
const presetTimestampIntervals: ReadonlyArray<TranscriptionTimestampInterval> = ['none', 'segment', 30, 60, 120, 300, 600, 1800]

export function SettingsWorkspace({
  settings,
  projectSettings,
  busy,
  onSaveApp,
  onSaveProject,
  navigateToTab,
}: Props) {
  const [tab, setTab] = useState<SettingsTab>('app')

  useEffect(() => {
    if (navigateToTab?.requestId) {
      const nextTab = navigateToTab.tab
      const timeoutId = window.setTimeout(() => {
        setTab(nextTab)
      }, 0)
      return () => {
        window.clearTimeout(timeoutId)
      }
    }
  }, [navigateToTab?.requestId, navigateToTab?.tab])

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Panel className="p-3">
        <div className="space-y-1">
          {[
            { value: 'app', label: 'App', icon: SlidersHorizontal },
            { value: 'project', label: 'Project', icon: Settings2 },
            { value: 'ai', label: 'AI', icon: Sparkles },
            { value: 'transcribe', label: 'Transcribe', icon: Mic },
          ].map((entry) => {
            const Icon = entry.icon
            return (
              <button
                key={entry.value}
                type="button"
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                  tab === entry.value ? 'bg-accent text-accent-foreground' : 'text-muted hover:bg-panelMuted'
                }`}
                onClick={() => setTab(entry.value as SettingsTab)}
              >
                <Icon className="h-4 w-4" />
                {entry.label}
              </button>
            )
          })}
        </div>
      </Panel>

      {tab === 'app' ? (
        <AppSettingsPanel settings={settings} busy={busy} onSave={onSaveApp} />
      ) : tab === 'project' ? (
        <ProjectSettingsPanel settings={projectSettings} busy={busy} onSave={onSaveProject} />
      ) : tab === 'ai' ? (
        <AiSettingsPanel settings={settings} busy={busy} onSave={onSaveApp} />
      ) : (
        <TranscriptionSettingsPanel settings={settings} busy={busy} onSave={onSaveApp} />
      )}
    </div>
  )
}

function AppSettingsPanel({
  settings,
  busy,
  onSave,
}: {
  settings: AppSettings
  busy: boolean
  onSave(input: AppSettingsUpdateInput): void
}) {
  const [restoreLastProject, setRestoreLastProject] = useState(settings.ui.restoreLastProject)
  const [restoreLastLayout, setRestoreLastLayout] = useState(settings.ui.restoreLastLayout)
  const [defaultBoardView, setDefaultBoardView] = useState(normalizeBoardView(settings.ui.defaultBoardView))
  const [defaultSceneDensity, setDefaultSceneDensity] = useState(settings.ui.defaultSceneDensity)
  const [defaultDetachedWorkspace, setDefaultDetachedWorkspace] = useState(settings.ui.defaultDetachedWorkspace)

  return (
    <Panel className="min-h-0 overflow-y-auto overscroll-contain p-5">
      <Header title="App Settings" subtitle="Global preferences for windows, layouts and default views.">
        <Button
          variant="accent"
          size="sm"
          disabled={busy}
          onClick={() =>
            onSave({
              restoreLastProject,
              restoreLastLayout,
              defaultBoardView,
              defaultSceneDensity,
              defaultDetachedWorkspace,
            })
          }
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </Header>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ToggleField
          label="Restore Last Project"
          checked={restoreLastProject}
          onChange={setRestoreLastProject}
        />
        <ToggleField
          label="Restore Last Layout"
          checked={restoreLastLayout}
          onChange={setRestoreLastLayout}
        />
        <Field label="Default View Mode">
          <select className={selectClassName} value={defaultBoardView} onChange={(event) => setDefaultBoardView(event.target.value as typeof defaultBoardView)}>
            <option value="outline">Outline</option>
            <option value="canvas">Canvas</option>
          </select>
        </Field>
        <Field label="Default Scene Density">
          <select className={selectClassName} value={defaultSceneDensity} onChange={(event) => setDefaultSceneDensity(event.target.value as typeof defaultSceneDensity)}>
            <option value="table">Table</option>
            <option value="compact">Compact</option>
            <option value="detailed">Detailed</option>
          </select>
        </Field>
        <Field label="Default Detached Window">
          <select
            className={selectClassName}
            value={defaultDetachedWorkspace}
            onChange={(event) => setDefaultDetachedWorkspace(event.target.value as typeof defaultDetachedWorkspace)}
          >
            <option value="outline">Outline</option>
            <option value="bank">Scene Bank</option>
            <option value="board-manager">Board Manager</option>
            <option value="inspector">Inspector</option>
            <option value="notebook">Notebook</option>
            <option value="archive">Archive</option>
            <option value="transcribe">Transcribe</option>
          </select>
        </Field>
      </div>
    </Panel>
  )
}

function TranscriptionSettingsPanel({
  settings,
  busy,
  onSave,
}: {
  settings: AppSettings
  busy: boolean
  onSave(input: AppSettingsUpdateInput): void
}) {
  const [modelId, setModelId] = useState<TranscriptionModelId>(settings.transcription.modelId)
  const [language, setLanguage] = useState<TranscriptionLanguage>(settings.transcription.language)
  const [timestampInterval, setTimestampInterval] = useState<TranscriptionTimestampInterval>(
    settings.transcription.timestampInterval,
  )
  const [setup, setSetup] = useState<TranscriptionSetup | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadLabel, setDownloadLabel] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<TranscriptionModelId | null>(null)
  const [downloadingEngine, setDownloadingEngine] = useState(false)
  const [downloadingFfmpeg, setDownloadingFfmpeg] = useState(false)
  const [saveFeedback, setSaveFeedback] = useState(false)

  const refreshSetup = useCallback(async () => {
    try {
      const next = await window.narralab.transcription.getSetup()
      setSetup(next)
      setDownloadError(null)
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : 'Could not fetch transcription setup')
    }
  }, [])

  useEffect(() => {
    void refreshSetup()
  }, [refreshSetup])

  useEffect(() => {
    const dispose = window.narralab.transcription.subscribe((event: TranscriptionProgressEvent) => {
      if (event.type === 'download') {
        const { bytesReceived, totalBytes } = event.payload
        const mb = (bytesReceived / (1024 * 1024)).toFixed(1)
        if (totalBytes) {
          const pct = Math.min(100, Math.round((bytesReceived / totalBytes) * 100))
          setDownloadLabel(`Model: ${pct}% (${mb} MiB)`)
        } else {
          setDownloadLabel(`Model: ${mb} MiB`)
        }
        return
      }
      if (event.type === 'engine-download') {
        const { part, bytesReceived, totalBytes } = event.payload
        const partNb: Record<TranscriptionEngineDownloadPart, string> = {
          'windows-zip': 'Windows Package',
          'whisper-cpp': 'whisper-cpp',
          ggml: 'ggml',
          libomp: 'libomp',
        }
        const mb = (bytesReceived / (1024 * 1024)).toFixed(1)
        if (totalBytes) {
          const pct = Math.min(100, Math.round((bytesReceived / totalBytes) * 100))
          setDownloadLabel(`Engine (${partNb[part]}): ${pct}% (${mb} MiB)`)
        } else {
          setDownloadLabel(`Engine (${partNb[part]}): ${mb} MiB`)
        }
        return
      }
      if (event.type === 'ffmpeg-download') {
        const { bytesReceived, totalBytes } = event.payload
        const mb = (bytesReceived / (1024 * 1024)).toFixed(1)
        if (totalBytes) {
          const pct = Math.min(100, Math.round((bytesReceived / totalBytes) * 100))
          setDownloadLabel(`FFmpeg: ${pct}% (${mb} MiB)`)
        } else {
          setDownloadLabel(`FFmpeg: ${mb} MiB`)
        }
      }
    })
    return dispose
  }, [])

  useEffect(() => {
    setModelId(settings.transcription.modelId)
    setLanguage(settings.transcription.language)
    setTimestampInterval(settings.transcription.timestampInterval)
  }, [settings.transcription])

  const downloadBusy = downloadingEngine || downloadingFfmpeg || downloadingId !== null

  const downloadEngine = async () => {
    setDownloadingEngine(true)
    setDownloadLabel('Starting engine download…')
    try {
      await window.narralab.transcription.downloadEngine()
      await refreshSetup()
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Engine download failed')
    } finally {
      setDownloadingEngine(false)
      setDownloadLabel(null)
    }
  }

  const downloadFfmpeg = async () => {
    setDownloadingFfmpeg(true)
    setDownloadLabel('Starting FFmpeg download…')
    try {
      await window.narralab.transcription.downloadFfmpeg()
      await refreshSetup()
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'FFmpeg download failed')
    } finally {
      setDownloadingFfmpeg(false)
      setDownloadLabel(null)
    }
  }

  const downloadModel = async (id: TranscriptionModelId) => {
    setDownloadingId(id)
    setDownloadLabel('Starting model download…')
    try {
      await window.narralab.transcription.downloadModel(id)
      await refreshSetup()
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Model download failed')
    } finally {
      setDownloadingId(null)
      setDownloadLabel(null)
    }
  }

  const deleteModel = async (id: TranscriptionModelId) => {
    if (!window.confirm('Delete this model? It will be removed from your disk.')) return
    try {
      await window.narralab.transcription.deleteModel(id)
      await refreshSetup()
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Could not delete model')
    }
  }

  const ffmpegOk = setup?.ffmpegPath
  const ffprobeOk = setup?.ffprobePath
  const whisperOk = setup?.whisperPath
  const engineAuto = setup?.engineAutoDownloadSupported ?? false
  const ffmpegAutoDl = setup?.ffmpegAutoDownloadSupported ?? false
  const catalogRows =
    setup?.catalog ??
    TRANSCRIPTION_MODEL_CATALOG.map((entry) => ({
      ...entry,
      downloaded: false,
    }))
  const usesCustomTimestampInterval = !presetTimestampIntervals.some((entry) => entry === timestampInterval)

  return (
    <Panel className="min-h-0 overflow-y-auto overscroll-contain p-5">
      <Header
        title="Local Transcription"
        subtitle="Everything runs locally. Models and tools are stored securely in the app's user data directory."
      >
        <Button
          variant={saveFeedback ? 'ghost' : 'accent'}
          size="sm"
          disabled={busy || saveFeedback}
          onClick={async () => {
            await onSave({
              transcriptionModelId: modelId,
              transcriptionLanguage: language,
              transcriptionTimestampInterval: timestampInterval,
            })
            setSaveFeedback(true)
            setTimeout(() => setSaveFeedback(false), 2000)
          }}
        >
          {saveFeedback ? (
            <span className="text-emerald-400">Saved!</span>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Defaults
            </>
          )}
        </Button>
      </Header>

      {downloadError ? <div className="mt-4 text-sm text-red-300">{downloadError}</div> : null}

      <div className="mt-8 border-t border-border/60 pt-6">
        <div className="text-sm font-semibold text-foreground">Downloads (Rarely needed)</div>
        <p className="mt-1 max-w-2xl text-xs text-muted">
          Download FFmpeg, transcription engine and language models here. The Transcribe workspace uses your local installations without requiring an internet connection.
        </p>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted">FFmpeg / ffprobe</span>
            <span className={(ffmpegOk && ffprobeOk) ? 'text-emerald-300' : 'text-amber-300'}>
              {ffmpegOk && ffprobeOk ? 'Ready' : !ffmpegOk ? 'FFmpeg Missing' : 'ffprobe Missing'}
            </span>
            {(!ffmpegOk || !ffprobeOk) && ffmpegAutoDl ? (
              <Button variant="accent" size="sm" type="button" disabled={downloadBusy} onClick={() => void downloadFfmpeg()}>
                {downloadingFfmpeg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {ffmpegOk ? 'Install ffprobe' : 'Download'}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted">Engine</span>
            <span className={whisperOk ? 'text-emerald-300' : 'text-amber-300'}>{whisperOk ? 'Ready' : 'Missing'}</span>
            {!whisperOk && engineAuto ? (
              <Button variant="accent" size="sm" type="button" disabled={downloadBusy} onClick={() => void downloadEngine()}>
                {downloadingEngine ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download
              </Button>
            ) : null}
          </div>
        </div>

        {downloadLabel ? <div className="mt-2 text-xs text-muted">{downloadLabel}</div> : null}

        <div className="mt-6 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Whisper Models</div>
          {catalogRows.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-panelMuted/40 px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{entry.label}</div>
                <div className="text-xs text-muted">{entry.description}</div>
                <div className="text-xs text-muted">~{entry.sizeMiB} MiB</div>
              </div>
              {entry.downloaded ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-emerald-300">Downloaded</span>
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-red-300 transition hover:bg-red-300/10 hover:text-red-200 disabled:opacity-40"
                    title="Delete model"
                    type="button"
                    disabled={downloadBusy}
                    onClick={() => void deleteModel(entry.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <Button
                  variant="accent"
                  size="sm"
                  type="button"
                  disabled={downloadBusy}
                  onClick={() => void downloadModel(entry.id)}
                >
                  {downloadingId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Download
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 border-t border-border/60 pt-6">
        <div className="text-sm font-semibold text-foreground">Workspace Defaults</div>
        <div className="mt-4 grid max-w-xl gap-4">
          <Field label="Default Model">
            <select
              className={selectClassName}
              value={modelId}
              onChange={(event) => setModelId(event.target.value as TranscriptionModelId)}
            >
              {catalogRows.map((entry) => (
                <option key={entry.id} value={entry.id} disabled={!entry.downloaded && entry.id !== modelId}>
                  {entry.label}
                  {!entry.downloaded ? ' (not downloaded)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default Language">
            <select
              className={selectClassName}
              value={language}
              onChange={(event) => setLanguage(event.target.value as TranscriptionLanguage)}
            >
              <option value="auto">Auto-detect</option>
              <option value="nb">Norwegian Bokmål</option>
              <option value="nn">Norwegian Nynorsk</option>
              <option value="en">English</option>
              <option value="sv">Swedish</option>
              <option value="da">Danish</option>
              <option value="de">German</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
            </select>
          </Field>
          <Field label="Default Timestamps">
            <div className="flex gap-2">
              <select
                className={selectClassName}
                value={usesCustomTimestampInterval ? 'custom' : String(timestampInterval)}
                onChange={(event) => {
                  const v = event.target.value
                  if (v === 'none' || v === 'segment') {
                    setTimestampInterval(v)
                  } else if (v === 'custom') {
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
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">
                    s
                  </span>
                </div>
              )}
            </div>
          </Field>
        </div>
      </div>
    </Panel>
  )
}

function ProjectSettingsPanel({
  settings,
  busy,
  onSave,
}: {
  settings: ProjectSettings | null
  busy: boolean
  onSave(input: ProjectSettingsUpdateInput): void
}) {
  const defaults = settings ?? {
    title: '',
    genre: '',
    format: '',
    targetRuntimeMinutes: 90,
    logline: '',
    defaultBoardView: 'outline' as const,
    enabledBlockKinds: ['chapter', 'voiceover', 'narration', 'text-card', 'note'] as const,
    blockKindOrder: ['chapter', 'voiceover', 'narration', 'text-card', 'note'] as const,
  }

  const [title, setTitle] = useState(defaults.title)
  const [genre, setGenre] = useState(defaults.genre)
  const [format, setFormat] = useState(defaults.format)
  const [targetRuntimeMinutes, setTargetRuntimeMinutes] = useState(String(defaults.targetRuntimeMinutes))
  const [logline, setLogline] = useState(defaults.logline)
  const [defaultBoardView, setDefaultBoardView] = useState(normalizeBoardView(defaults.defaultBoardView))
  const [enabledBlockKinds, setEnabledBlockKinds] = useState([...defaults.enabledBlockKinds])
  const [blockKindOrder, setBlockKindOrder] = useState([...defaults.blockKindOrder])

  const orderedKinds = useMemo(
    () => blockKindOrder.filter((kind) => enabledBlockKinds.includes(kind)),
    [blockKindOrder, enabledBlockKinds],
  )

  return (
    <Panel className="min-h-0 overflow-y-auto overscroll-contain p-5">
      <Header title="Project Settings" subtitle="Metadata and defaults that travel with this project file.">
        <Button
          variant="accent"
          size="sm"
          disabled={busy}
          onClick={() =>
            onSave({
              title,
              genre,
              format,
              targetRuntimeMinutes: Number.parseInt(targetRuntimeMinutes, 10) || 90,
              logline,
              defaultBoardView,
              enabledBlockKinds,
              blockKindOrder,
            })
          }
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </Header>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Field label="Film Title">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </Field>
        <Field label="Genre">
          <Input value={genre} onChange={(event) => setGenre(event.target.value)} />
        </Field>
        <Field label="Format">
          <Input value={format} onChange={(event) => setFormat(event.target.value)} placeholder="Feature documentary, series, short..." />
        </Field>
        <Field label="Target Runtime (Minutes)">
          <Input value={targetRuntimeMinutes} onChange={(event) => setTargetRuntimeMinutes(event.target.value)} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Logline">
          <Textarea className="min-h-[110px]" value={logline} onChange={(event) => setLogline(event.target.value)} />
        </Field>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Field label="Default View Mode">
          <select className={selectClassName} value={defaultBoardView} onChange={(event) => setDefaultBoardView(event.target.value as typeof defaultBoardView)}>
            <option value="outline">Outline</option>
            <option value="canvas">Canvas</option>
          </select>
        </Field>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel className="border-border bg-panelMuted/40 p-4">
          <div className="text-sm font-semibold text-foreground">Enabled Block Types</div>
          <div className="mt-3 space-y-2">
            {boardBlockKinds.map((kind) => (
              <ToggleField
                key={kind.value}
                label={kind.label}
                checked={enabledBlockKinds.includes(kind.value)}
                onChange={(checked) => {
                  setEnabledBlockKinds((current) =>
                    checked ? [...new Set([...current, kind.value])] : current.filter((entry) => entry !== kind.value),
                  )
                  setBlockKindOrder((current) =>
                    checked ? [...new Set([...current, kind.value])] : current.filter((entry) => entry !== kind.value),
                  )
                }}
              />
            ))}
          </div>
        </Panel>

        <Panel className="border-border bg-panelMuted/40 p-4">
          <div className="text-sm font-semibold text-foreground">Block Menu Order</div>
          <div className="mt-3 space-y-2">
            {orderedKinds.map((kind, index) => {
              const label = boardBlockKinds.find((entry) => entry.value === kind)?.label ?? kind
              return (
                <div key={kind} className="flex items-center justify-between rounded-xl border border-border/70 bg-panel px-3 py-2">
                  <span className="text-sm text-foreground">{label}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setBlockKindOrder((current) => swap(current, index, index - 1))
                      }
                      disabled={index === 0}
                    >
                      Up
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setBlockKindOrder((current) => swap(current, index, index + 1))
                      }
                      disabled={index === orderedKinds.length - 1}
                    >
                      Down
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>
    </Panel>
  )
}

function AiSettingsPanel({
  settings,
  busy,
  onSave,
}: {
  settings: AppSettings
  busy: boolean
  onSave(input: AppSettingsUpdateInput): void
}) {
  const [provider, setProvider] = useState(settings.ai.provider)
  const [openAiModel, setOpenAiModel] = useState(settings.ai.openAiModel)
  const [geminiModel, setGeminiModel] = useState(settings.ai.geminiModel)
  const [systemPrompt, setSystemPrompt] = useState(settings.ai.systemPrompt)
  const [extraInstructions, setExtraInstructions] = useState(settings.ai.extraInstructions)
  const [responseStyle, setResponseStyle] = useState(settings.ai.responseStyle)
  const [openAiApiKey, setOpenAiApiKey] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const openAiModelChoice = openAiModelOptions.some((option) => option.value === openAiModel) ? openAiModel : 'custom'
  const geminiModelChoice = geminiModelOptions.some((option) => option.value === geminiModel) ? geminiModel : 'custom'

  return (
    <Panel className="min-h-0 overflow-y-auto overscroll-contain p-5">
      <Header title="AI Settings" subtitle="Provider, model defaults, API keys and response behavior.">
        <Button
          variant="accent"
          size="sm"
          onClick={() =>
            onSave({
              provider,
              openAiModel,
              geminiModel,
              systemPrompt,
              extraInstructions,
              responseStyle,
              openAiApiKey: openAiApiKey || undefined,
              geminiApiKey: geminiApiKey || undefined,
            })
          }
          disabled={busy}
        >
          <Save className="h-4 w-4" />
          Save
        </Button>
      </Header>

      {settings.ai.secretStorageMode === 'plain' ? (
        <Panel className="mt-4 border-amber/40 bg-amber/10 p-4 text-sm text-foreground">
          Safe Storage er ikke tilgjengelig på denne maskinen akkurat nå. Lagrede API-nøkler faller derfor tilbake
          til base64-lagring i lokale appinnstillinger, ikke ekte kryptering.
        </Panel>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Field label="Provider">
          <select className={selectClassName} value={provider} onChange={(event) => setProvider(event.target.value as typeof provider)}>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
        </Field>
        <Field label="Response Style">
          <select className={selectClassName} value={responseStyle} onChange={(event) => setResponseStyle(event.target.value as typeof responseStyle)}>
            <option value="structured">Structured</option>
            <option value="concise">Concise</option>
            <option value="exploratory">Exploratory</option>
          </select>
        </Field>
        <Field label="Default OpenAI Model">
          <div className="space-y-2">
            <select className={selectClassName} value={openAiModelChoice} onChange={(event) => setOpenAiModel(event.target.value === 'custom' ? '' : event.target.value)}>
              {openAiModelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            {openAiModelChoice === 'custom' ? (
              <Input value={openAiModel} onChange={(event) => setOpenAiModel(event.target.value)} placeholder="Enter OpenAI model name" />
            ) : null}
          </div>
        </Field>
        <Field label="Default Gemini Model">
          <div className="space-y-2">
            <select className={selectClassName} value={geminiModelChoice} onChange={(event) => setGeminiModel(event.target.value === 'custom' ? '' : event.target.value)}>
              {geminiModelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            {geminiModelChoice === 'custom' ? (
              <Input value={geminiModel} onChange={(event) => setGeminiModel(event.target.value)} placeholder="Enter Gemini model name" />
            ) : null}
          </div>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Consultant System Prompt">
          <Textarea className="min-h-[180px]" value={systemPrompt} onChange={(event) => setSystemPrompt(event.target.value)} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Extra Instructions">
          <Textarea className="min-h-[120px]" value={extraInstructions} onChange={(event) => setExtraInstructions(event.target.value)} />
        </Field>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel className="border-border bg-panelMuted/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <KeyRound className="h-4 w-4 text-accent" />
            OpenAI API Key
          </div>
          <div className="mt-2 text-xs text-muted">
            {settings.ai.hasOpenAiApiKey ? 'A key is already saved.' : 'No key saved yet.'}
          </div>
          <Input
            className="mt-3"
            type="password"
            value={openAiApiKey}
            onChange={(event) => setOpenAiApiKey(event.target.value)}
            placeholder={settings.ai.hasOpenAiApiKey ? 'Leave blank to keep existing key' : 'sk-...'}
          />
          <div className="mt-3 flex items-center gap-2">
            <Button variant="default" size="sm" onClick={() => onSave({ openAiApiKey })} disabled={busy}>
              Save
            </Button>
            {settings.ai.hasOpenAiApiKey ? (
              <Button variant="ghost" size="sm" onClick={() => onSave({ clearOpenAiApiKey: true })} disabled={busy}>
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>
        </Panel>

        <Panel className="border-border bg-panelMuted/60 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-accent" />
            Gemini API Key
          </div>
          <div className="mt-2 text-xs text-muted">
            {settings.ai.hasGeminiApiKey ? 'A key is already saved.' : 'No key saved yet.'}
          </div>
          <Input
            className="mt-3"
            type="password"
            value={geminiApiKey}
            onChange={(event) => setGeminiApiKey(event.target.value)}
            placeholder={settings.ai.hasGeminiApiKey ? 'Leave blank to keep existing key' : 'AIza...'}
          />
          <div className="mt-3 flex items-center gap-2">
            <Button variant="default" size="sm" onClick={() => onSave({ geminiApiKey })} disabled={busy}>
              Save
            </Button>
            {settings.ai.hasGeminiApiKey ? (
              <Button variant="ghost" size="sm" onClick={() => onSave({ clearGeminiApiKey: true })} disabled={busy}>
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            ) : null}
          </div>
        </Panel>
      </div>
    </Panel>
  )
}

function Header({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-display text-xl font-semibold text-foreground">{title}</div>
        <div className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</div>
      </div>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</div>
      {children}
    </label>
  )
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange(value: boolean): void
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-border/70 bg-panel px-3 py-2.5">
      <span className="text-sm text-foreground">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

function normalizeBoardView(value: 'outline' | 'timeline' | 'canvas' | 'board') {
  if (value === 'timeline') return 'outline'
  if (value === 'board') return 'canvas'
  return value
}

function swap<T>(items: T[], fromIndex: number, toIndex: number) {
  if (toIndex < 0 || toIndex >= items.length) {
    return items
  }
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next
}

const selectClassName =
  'h-10 w-full appearance-none rounded-xl border border-border bg-panel pl-3 pr-10 text-sm text-foreground outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20 bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20fill%3D%27none%27%20viewBox%3D%270%200%2020%2020%27%3E%3Cpath%20stroke%3D%27%236b7280%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%20stroke-width%3D%271.5%27%20d%3D%27m6%208%204%204%204-4%27%2F%3E%3C%2Fsvg%3E")] bg-[position:right_0.5rem_center] bg-[length:1.25rem_1.25rem] bg-no-repeat'
