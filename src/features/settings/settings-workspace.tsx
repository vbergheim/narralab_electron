import { useEffect, useState } from 'react'

import type { AppSettings, AppSettingsUpdateInput } from '@/types/ai'
import type { ProjectSettings, ProjectSettingsUpdateInput } from '@/types/project'

import {
  AiSettingsPanel,
  AppSettingsPanel,
  ProjectSettingsPanel,
  TranscriptionSettingsPanel,
} from './settings-workspace-panels'
import { type SettingsTab, settingsTabEntries } from './settings-workspace-config'
import { Panel } from '@/components/ui/panel'

type Props = {
  settings: AppSettings
  projectSettings: ProjectSettings | null
  busy: boolean
  onSaveApp(input: AppSettingsUpdateInput): void | Promise<void>
  onSaveProject(input: ProjectSettingsUpdateInput): void
  navigateToTab?: { tab: SettingsTab; requestId: number }
}

export { type SettingsTab } from './settings-workspace-config'

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
          {settingsTabEntries.map((entry) => {
            const Icon = entry.icon
            return (
              <button
                key={entry.value}
                type="button"
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                  tab === entry.value ? 'bg-accent text-accent-foreground' : 'text-muted hover:bg-panelMuted'
                }`}
                onClick={() => setTab(entry.value)}
              >
                <Icon className="h-4 w-4" />
                {entry.label}
              </button>
            )
          })}
        </div>
      </Panel>

      {tab === 'app' ? (
        <AppSettingsPanel
          key={[
            settings.ui.restoreLastProject,
            settings.ui.restoreLastLayout,
            settings.ui.defaultBoardView,
            settings.ui.defaultSceneDensity,
            settings.ui.defaultDetachedWorkspace,
          ].join(':')}
          settings={settings}
          busy={busy}
          onSave={onSaveApp}
        />
      ) : tab === 'project' ? (
        <ProjectSettingsPanel
          key={JSON.stringify(projectSettings ?? null)}
          settings={projectSettings}
          busy={busy}
          onSave={onSaveProject}
        />
      ) : tab === 'ai' ? (
        <AiSettingsPanel
          key={[
            settings.ai.provider,
            settings.ai.openAiModel,
            settings.ai.geminiModel,
            settings.ai.responseStyle,
            settings.ai.allowPlaintextSecrets,
            settings.ai.systemPrompt,
            settings.ai.extraInstructions,
            settings.ai.hasOpenAiApiKey,
            settings.ai.hasGeminiApiKey,
            settings.ai.secretStorageMode,
          ].join(':')}
          settings={settings}
          busy={busy}
          onSave={onSaveApp}
        />
      ) : (
        <TranscriptionSettingsPanel settings={settings} busy={busy} onSave={onSaveApp} />
      )}
    </div>
  )
}
