import { Mic, Settings2, SlidersHorizontal, Sparkles } from 'lucide-react'

export type SettingsTab = 'app' | 'project' | 'ai' | 'transcribe'

export const settingsTabEntries: Array<{ value: SettingsTab; label: string; icon: typeof SlidersHorizontal }> = [
  { value: 'app', label: 'App', icon: SlidersHorizontal },
  { value: 'project', label: 'Project', icon: Settings2 },
  { value: 'ai', label: 'AI', icon: Sparkles },
  { value: 'transcribe', label: 'Transcribe', icon: Mic },
]
