import { randomUUID } from 'node:crypto'

import type { NotebookDocument, NotebookTab } from '@/types/project'

import { ProjectMetadataRepository } from './db/repositories/project-metadata-repository'

function notebookTabId(): string {
  return randomUUID()
}

function emptyNotebookDocument(): NotebookDocument {
  const id = notebookTabId()
  return {
    tabs: [{ id, title: 'Notes', contentHtml: '', updatedAt: null }],
    activeTabId: id,
    updatedAt: null,
  }
}

function plainTextToHtml(text: string): string {
  if (!text.trim()) return ''
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .split(/\n/)
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('')
}

function aggregateNotebookTabTimes(tabs: NotebookTab[]): string | null {
  const times = tabs.map((t) => t.updatedAt).filter(Boolean) as string[]
  if (times.length === 0) return null
  return [...times].sort().at(-1) ?? null
}

function migrateLegacyNotebookContent(content: string, updatedAt: string | null): NotebookDocument {
  const id = notebookTabId()
  return {
    tabs: [{ id, title: 'Notes', contentHtml: plainTextToHtml(content), updatedAt }],
    activeTabId: id,
    updatedAt,
  }
}

function sanitizeNotebookDocument(doc: NotebookDocument): NotebookDocument {
  if (!doc.tabs || doc.tabs.length === 0) {
    return emptyNotebookDocument()
  }
  const tabs = doc.tabs.map((t) => ({
    id: typeof t.id === 'string' ? t.id : notebookTabId(),
    title: typeof t.title === 'string' && t.title.trim() ? t.title.trim().slice(0, 200) : 'Untitled',
    contentHtml: typeof t.contentHtml === 'string' ? t.contentHtml : '',
    updatedAt: typeof t.updatedAt === 'string' ? t.updatedAt : null,
  }))
  let activeTabId = typeof doc.activeTabId === 'string' ? doc.activeTabId : null
  if (!activeTabId || !tabs.some((t) => t.id === activeTabId)) {
    activeTabId = tabs[0].id
  }
  const updatedAt = aggregateNotebookTabTimes(tabs)
  return { tabs, activeTabId, updatedAt }
}

export function normalizeNotebookFromSnapshot(notebook: unknown): NotebookDocument {
  if (
    notebook &&
    typeof notebook === 'object' &&
    Array.isArray((notebook as NotebookDocument).tabs) &&
    (notebook as NotebookDocument).tabs!.length > 0
  ) {
    return sanitizeNotebookDocument(notebook as NotebookDocument)
  }
  if (notebook && typeof notebook === 'object' && typeof (notebook as { content?: unknown }).content === 'string') {
    return migrateLegacyNotebookContent(
      (notebook as { content: string }).content,
      (notebook as { updatedAt?: string | null }).updatedAt ?? null,
    )
  }
  return emptyNotebookDocument()
}

export class NotebookService {
  private readonly metadata: ProjectMetadataRepository

  constructor(metadata: ProjectMetadataRepository) {
    this.metadata = metadata
  }

  get(): NotebookDocument {
    const json = this.metadata.getNotebook()
    if (json) {
      try {
        const parsed = JSON.parse(json) as NotebookDocument
        return sanitizeNotebookDocument(parsed)
      } catch {
        // fall through to legacy
      }
    }

    const { content, updatedAt } = this.metadata.getLegacyNotebook()

    if (content || updatedAt) {
      return migrateLegacyNotebookContent(content, updatedAt)
    }

    return emptyNotebookDocument()
  }

  update(document: NotebookDocument): NotebookDocument {
    const normalized = sanitizeNotebookDocument(document)
    normalized.updatedAt = aggregateNotebookTabTimes(normalized.tabs)
    this.metadata.setNotebook(JSON.stringify(normalized))
    return normalized
  }

  appendPlainText(text: string): NotebookDocument {
    const trimmed = text.trim()
    if (!trimmed) {
      return this.get()
    }

    const doc = this.get()
    const activeId = doc.activeTabId ?? doc.tabs[0]?.id
    if (!activeId) {
      return doc
    }

    const now = new Date().toISOString()
    const activeTab = doc.tabs.find((tab) => tab.id === activeId)
    const hasBody =
      !!activeTab &&
      activeTab.contentHtml.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim().length > 0
    const prefix = hasBody ? '\n\n' : ''
    const addition = plainTextToHtml(prefix + trimmed)

    const nextTabs = doc.tabs.map((tab) =>
      tab.id === activeId ? { ...tab, contentHtml: `${tab.contentHtml}${addition}`, updatedAt: now } : tab,
    )

    return this.update({ ...doc, tabs: nextTabs, activeTabId: activeId })
  }
}
