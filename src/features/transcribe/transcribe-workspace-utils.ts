import type {
  TranscriptionLanguage,
  TranscriptionStatus,
  TranscriptionTimestampInterval,
} from '@/types/transcription'

export const presetTimestampIntervals: ReadonlyArray<TranscriptionTimestampInterval> = ['none', 'segment', 30, 60, 120, 300, 600, 1800]

export const languageOptions: Array<{ value: TranscriptionLanguage; label: string }> = [
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

export const selectCls =
  'h-10 w-full appearance-none rounded-xl border border-border bg-panel pl-3 pr-10 text-sm text-foreground outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20 bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20fill%3D%27none%27%20viewBox%3D%270%200%2020%2020%27%3E%3Cpath%20stroke%3D%27%236b7280%27%20stroke-linecap%3D%27round%27%20stroke-linejoin%3D%27round%27%20stroke-width%3D%271.5%27%20d%3D%27m6%208%204%204%204-4%27%2F%3E%3C%2Fsvg%3E")] bg-[position:right_0.5rem_center] bg-[length:1.25rem_1.25rem] bg-no-repeat'

export function formatJobElapsed(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  const m = Math.floor(seconds / 60)
  const r = seconds % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function isTranscriptionJobActive(status: TranscriptionStatus) {
  return status.phase === 'preparing' || status.phase === 'transcribing'
}
