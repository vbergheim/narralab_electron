import type { BoardTextItemKind } from '@/types/board'
import type { SceneColor, SceneStatus } from '@/types/scene'

export const openAiModelOptions = [
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
  { value: 'gpt-5', label: 'GPT-5' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
] as const

export const geminiModelOptions = [
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
] as const

export const sceneStatuses: Array<{ value: SceneStatus; label: string }> = [
  { value: 'candidate', label: 'Candidate' },
  { value: 'selected', label: 'Selected' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'omitted', label: 'Omitted' },
  { value: 'locked', label: 'Locked' },
]

export const sceneColors: Array<{ value: SceneColor; label: string; hex: string }> = [
  { value: 'charcoal', label: 'Charcoal', hex: '#7f8895' },
  { value: 'slate', label: 'Slate', hex: '#607086' },
  { value: 'amber', label: 'Amber', hex: '#cb8d45' },
  { value: 'ochre', label: 'Ochre', hex: '#a7783d' },
  { value: 'crimson', label: 'Crimson', hex: '#af5b64' },
  { value: 'rose', label: 'Rose', hex: '#b46b82' },
  { value: 'olive', label: 'Olive', hex: '#7d9161' },
  { value: 'moss', label: 'Moss', hex: '#5f7f57' },
  { value: 'teal', label: 'Teal', hex: '#4f8d8d' },
  { value: 'cyan', label: 'Cyan', hex: '#4e9aaa' },
  { value: 'blue', label: 'Blue', hex: '#688db2' },
  { value: 'indigo', label: 'Indigo', hex: '#5f6fa8' },
  { value: 'violet', label: 'Violet', hex: '#8c78b5' },
  { value: 'plum', label: 'Plum', hex: '#7f5d8f' },
]

export const defaultBoardCloneName = 'Alt Outline'

export const boardBlockKinds: Array<{
  value: BoardTextItemKind
  label: string
  shortLabel: string
  defaultTitle: string
  defaultBody: string
  defaultColor: SceneColor
}> = [
  {
    value: 'chapter',
    label: 'Chapter Header',
    shortLabel: 'Chapter',
    defaultTitle: 'New chapter',
    defaultBody: '',
    defaultColor: 'plum',
  },
  {
    value: 'voiceover',
    label: 'Voiceover',
    shortLabel: 'VO',
    defaultTitle: 'Voiceover',
    defaultBody: '',
    defaultColor: 'blue',
  },
  {
    value: 'narration',
    label: 'Narration',
    shortLabel: 'Narration',
    defaultTitle: 'Narration',
    defaultBody: '',
    defaultColor: 'teal',
  },
  {
    value: 'text-card',
    label: 'Text Card',
    shortLabel: 'Text',
    defaultTitle: 'Text card',
    defaultBody: '',
    defaultColor: 'amber',
  },
  {
    value: 'note',
    label: 'Note',
    shortLabel: 'Note',
    defaultTitle: 'Outline note',
    defaultBody: '',
    defaultColor: 'slate',
  },
]
