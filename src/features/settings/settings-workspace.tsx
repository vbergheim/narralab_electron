import { type ReactNode, useMemo, useState } from 'react'
import { KeyRound, Save, Settings2, SlidersHorizontal, Sparkles, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { Textarea } from '@/components/ui/textarea'
import { boardBlockKinds, geminiModelOptions, openAiModelOptions } from '@/lib/constants'
import type { AppSettings, AppSettingsUpdateInput } from '@/types/ai'
import type { ProjectSettings, ProjectSettingsUpdateInput } from '@/types/project'

type Props = {
  settings: AppSettings
  projectSettings: ProjectSettings | null
  busy: boolean
  onSaveApp(input: AppSettingsUpdateInput): void
  onSaveProject(input: ProjectSettingsUpdateInput): void
}

type SettingsTab = 'app' | 'project' | 'ai'

export function SettingsWorkspace({ settings, projectSettings, busy, onSaveApp, onSaveProject }: Props) {
  const [tab, setTab] = useState<SettingsTab>('app')

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <Panel className="p-3">
        <div className="space-y-1">
          {[
            { value: 'app', label: 'App', icon: SlidersHorizontal },
            { value: 'project', label: 'Project', icon: Settings2 },
            { value: 'ai', label: 'AI', icon: Sparkles },
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
      ) : (
        <AiSettingsPanel settings={settings} busy={busy} onSave={onSaveApp} />
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
            <option value="inspector">Inspector</option>
            <option value="notebook">Notebook</option>
            <option value="archive">Archive</option>
          </select>
        </Field>
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
  'h-10 w-full rounded-xl border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20'
