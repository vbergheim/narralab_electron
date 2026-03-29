import { type ReactNode, useState } from 'react'
import { KeyRound, Save, Sparkles, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { Textarea } from '@/components/ui/textarea'
import { geminiModelOptions, openAiModelOptions } from '@/lib/constants'
import type { AppSettings, AppSettingsUpdateInput } from '@/types/ai'

type Props = {
  settings: AppSettings
  busy: boolean
  onSave(input: AppSettingsUpdateInput): void
}

export function SettingsWorkspace({ settings, busy, onSave }: Props) {
  const [provider, setProvider] = useState(settings.ai.provider)
  const [openAiModel, setOpenAiModel] = useState(settings.ai.openAiModel)
  const [geminiModel, setGeminiModel] = useState(settings.ai.geminiModel)
  const [systemPrompt, setSystemPrompt] = useState(settings.ai.systemPrompt)
  const [extraInstructions, setExtraInstructions] = useState(settings.ai.extraInstructions)
  const [responseStyle, setResponseStyle] = useState(settings.ai.responseStyle)
  const [openAiApiKey, setOpenAiApiKey] = useState('')
  const [geminiApiKey, setGeminiApiKey] = useState('')
  const openAiModelChoice = openAiModelOptions.some((option) => option.value === openAiModel)
    ? openAiModel
    : 'custom'
  const geminiModelChoice = geminiModelOptions.some((option) => option.value === geminiModel)
    ? geminiModel
    : 'custom'

  const save = () => {
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

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.25fr)_360px]">
      <Panel className="min-h-0 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-display text-xl font-semibold text-foreground">Settings</div>
            <div className="mt-1 max-w-2xl text-sm text-muted">
              Configure a local AI consultant for story notes, structure feedback and scene-level advice.
              API keys stay on this machine and are not stored in the project file.
            </div>
          </div>
          <Button variant="accent" size="sm" onClick={save} disabled={busy}>
            <Save className="h-4 w-4" />
            Save
          </Button>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Field label="Provider">
            <select
              className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
              value={provider}
              onChange={(event) => setProvider(event.target.value as typeof provider)}
            >
              <option value="openai">OpenAI</option>
              <option value="gemini">Gemini</option>
            </select>
          </Field>

          <Field label="Default OpenAI Model">
            <div className="space-y-2">
              <select
                className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
                value={openAiModelChoice}
                onChange={(event) => {
                  const next = event.target.value
                  setOpenAiModel(next === 'custom' ? '' : next)
                }}
              >
                {openAiModelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              {openAiModelChoice === 'custom' ? (
                <Input
                  value={openAiModel}
                  onChange={(event) => setOpenAiModel(event.target.value)}
                  placeholder="Enter OpenAI model name"
                />
              ) : null}
              <div className="text-xs text-muted">
                Recommended if you want cleaner answers: `GPT-5 Mini` or `GPT-5.2`.
              </div>
            </div>
          </Field>

          <Field label="Default Gemini Model">
            <div className="space-y-2">
              <select
                className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
                value={geminiModelChoice}
                onChange={(event) => {
                  const next = event.target.value
                  setGeminiModel(next === 'custom' ? '' : next)
                }}
              >
                {geminiModelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
              {geminiModelChoice === 'custom' ? (
                <Input
                  value={geminiModel}
                  onChange={(event) => setGeminiModel(event.target.value)}
                  placeholder="Enter Gemini model name"
                />
              ) : null}
              <div className="text-xs text-muted">
                Newer Gemini preview names change often, so `Custom…` is useful if Google updates them again.
              </div>
            </div>
          </Field>

          <Field label="Response Style">
            <select
              className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-sm text-foreground outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
              value={responseStyle}
              onChange={(event) => setResponseStyle(event.target.value as typeof responseStyle)}
            >
              <option value="structured">Structured</option>
              <option value="concise">Concise</option>
              <option value="exploratory">Exploratory</option>
            </select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Consultant System Prompt">
            <Textarea
              className="min-h-[180px]"
              value={systemPrompt}
              onChange={(event) => setSystemPrompt(event.target.value)}
              placeholder="How should the consultant think and respond?"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Extra Instructions">
            <Textarea
              className="min-h-[120px]"
              value={extraInstructions}
              onChange={(event) => setExtraInstructions(event.target.value)}
              placeholder="For example: always start with a short diagnosis, compare current board to classical chapter structure, be tougher on weak scenes..."
            />
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
              <Button variant="default" size="sm" onClick={save} disabled={busy}>
                Save
              </Button>
              {settings.ai.hasOpenAiApiKey ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSave({ clearOpenAiApiKey: true })}
                  disabled={busy}
                >
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
              <Button variant="default" size="sm" onClick={save} disabled={busy}>
                Save
              </Button>
              {settings.ai.hasGeminiApiKey ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSave({ clearGeminiApiKey: true })}
                  disabled={busy}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              ) : null}
            </div>
          </Panel>
        </div>
      </Panel>

      <Panel className="p-5">
        <div className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">How It Works</div>
        <div className="mt-4 space-y-4 text-sm text-muted">
          <p>The consultant sees the active board, current notebook excerpt and scene bank summary.</p>
          <p>You can shape its voice with a response style and extra instructions, almost like a lightweight custom Gem.</p>
          <p>Scene and board data stay local. Only the prompt, your chat history and the extracted project context are sent to the provider you choose.</p>
          <p>Switch provider whenever you want. The app remembers one default model per provider.</p>
        </div>
      </Panel>
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
