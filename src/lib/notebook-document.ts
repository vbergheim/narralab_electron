import type { NotebookDocument, NotebookTab } from '@/types/project'

export function createNotebookTabId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `tab_${Math.random().toString(36).slice(2, 12)}`
}

export function emptyNotebookDocument(): NotebookDocument {
  const id = createNotebookTabId()
  return {
    tabs: [{ id, title: 'Notes', contentHtml: '', updatedAt: null }],
    activeTabId: id,
    updatedAt: null,
  }
}

export function aggregateNotebookUpdatedAt(tabs: NotebookTab[]): string | null {
  const times = tabs.map((t) => t.updatedAt).filter(Boolean) as string[]
  if (times.length === 0) return null
  return times.sort().at(-1) ?? null
}

export function stripHtmlToText(html: string): string {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const el = document.createElement('div')
  el.innerHTML = html
  return (el.textContent || '').replace(/\s+/g, ' ').trim()
}

export function wordCountFromHtml(html: string): number {
  const text = stripHtmlToText(html)
  return text ? text.split(/\s+/).length : 0
}
