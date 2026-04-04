import { AlignJustify, LayoutGrid, Rows3 } from 'lucide-react'

import type { WindowWorkspace } from '@/types/ai'
import type { SceneDensity } from '@/types/view'

export function isTextInputTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable
}

export function detachedLabel(workspace: WindowWorkspace) {
  if (workspace === 'bank') return 'Scene Bank Window'
  if (workspace === 'board-manager') return 'Board Manager Window'
  if (workspace === 'inspector') return 'Inspector Window'
  if (workspace === 'notebook') return 'Notebook Window'
  if (workspace === 'archive') return 'Archive Window'
  if (workspace === 'pro-player') return 'Media Player Window'
  if (workspace === 'transcribe') return 'Transcribe Window'
  return 'Outline Window'
}

export function detachedTitle(workspace: WindowWorkspace) {
  if (workspace === 'bank') return 'Scene Bank'
  if (workspace === 'board-manager') return 'Board Manager'
  if (workspace === 'inspector') return 'Inspector'
  if (workspace === 'notebook') return 'Notebook'
  if (workspace === 'archive') return 'Archive'
  if (workspace === 'pro-player') return 'Media Player'
  if (workspace === 'transcribe') return 'Transcribe'
  return 'Outline'
}

export const densityOptions: Array<{
  value: SceneDensity
  label: string
  icon: typeof Rows3
}> = [
  { value: 'table', label: 'Table', icon: AlignJustify },
  { value: 'compact', label: 'Compact', icon: Rows3 },
  { value: 'detailed', label: 'Detailed', icon: LayoutGrid },
]
