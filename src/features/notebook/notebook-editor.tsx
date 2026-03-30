import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bold,
  BookText,
  Italic,
  List,
  ListOrdered,
  Plus,
  Strikethrough,
  Underline,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import { cn } from '@/lib/cn'
import { aggregateNotebookUpdatedAt, createNotebookTabId, stripHtmlToText, wordCountFromHtml } from '@/lib/notebook-document'
import { formatDateTime } from '@/lib/dates'
import type { NotebookDocument, NotebookTab } from '@/types/project'

type Props = {
  notebook: NotebookDocument
  onChange(doc: NotebookDocument): void
  onSave(doc: NotebookDocument): void
}

export function NotebookEditor({ notebook, onChange, onSave }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const lastPersistedJsonRef = useRef(JSON.stringify(notebook))
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [titleDraft, setTitleDraft] = useState('')

  const activeTab = useMemo(
    () => notebook.tabs.find((t) => t.id === notebook.activeTabId) ?? notebook.tabs[0] ?? null,
    [notebook.activeTabId, notebook.tabs],
  )

  const syncEditorHtml = useCallback(
    (html: string) => {
      const el = editorRef.current
      if (!el) return
      if (el.innerHTML !== html) {
        el.innerHTML = html
      }
    },
    [],
  )

  useEffect(() => {
    if (!activeTab) return
    const el = editorRef.current
    if (el && document.activeElement === el) {
      return
    }
    syncEditorHtml(activeTab.contentHtml || '')
  }, [activeTab?.id, activeTab?.contentHtml, syncEditorHtml])

  useEffect(() => {
    lastPersistedJsonRef.current = JSON.stringify(notebook)
  }, [notebook])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (JSON.stringify(notebook) === lastPersistedJsonRef.current) return
      onSave(notebook)
    }, 500)
    return () => window.clearTimeout(timer)
  }, [notebook, onSave])

  const flushIfDirty = () => {
    if (JSON.stringify(notebook) !== lastPersistedJsonRef.current) {
      onSave(notebook)
    }
  }

  const patchNotebook = (next: NotebookDocument) => {
    next.updatedAt = aggregateNotebookUpdatedAt(next.tabs)
    onChange(next)
  }

  const updateActiveTabHtml = (html: string) => {
    if (!notebook.activeTabId) return
    const now = new Date().toISOString()
    const tabs = notebook.tabs.map((t) =>
      t.id === notebook.activeTabId ? { ...t, contentHtml: html, updatedAt: now } : t,
    )
    patchNotebook({ ...notebook, tabs, updatedAt: aggregateNotebookUpdatedAt(tabs) })
  }

  const handleInput = () => {
    const el = editorRef.current
    if (!el) return
    updateActiveTabHtml(el.innerHTML)
  }

  const setActiveTab = (id: string) => {
    const el = editorRef.current
    const html = el?.innerHTML ?? ''
    let base = notebook
    if (notebook.activeTabId && el) {
      const now = new Date().toISOString()
      const tabs = notebook.tabs.map((t) =>
        t.id === notebook.activeTabId ? { ...t, contentHtml: html, updatedAt: now } : t,
      )
      base = { ...notebook, tabs }
    }
    patchNotebook({ ...base, activeTabId: id })
  }

  const addTab = () => {
    const el = editorRef.current
    const html = el?.innerHTML ?? ''
    let tabs = notebook.tabs
    if (notebook.activeTabId && el) {
      const now = new Date().toISOString()
      tabs = notebook.tabs.map((t) =>
        t.id === notebook.activeTabId ? { ...t, contentHtml: html, updatedAt: now } : t,
      )
    }
    const id = createNotebookTabId()
    const nextTitle = `Notes ${tabs.length + 1}`
    const newTab: NotebookTab = { id, title: nextTitle, contentHtml: '', updatedAt: null }
    patchNotebook({
      ...notebook,
      tabs: [...tabs, newTab],
      activeTabId: id,
    })
  }

  const removeTab = (id: string) => {
    if (notebook.tabs.length <= 1) return
    const ok = window.confirm('Delete this notebook tab?')
    if (!ok) return
    const nextTabs = notebook.tabs.filter((t) => t.id !== id)
    let activeTabId = notebook.activeTabId
    if (activeTabId === id) {
      activeTabId = nextTabs[0]?.id ?? null
    }
    patchNotebook({ ...notebook, tabs: nextTabs, activeTabId })
  }

  const beginRename = (tab: NotebookTab) => {
    setEditingTitleId(tab.id)
    setTitleDraft(tab.title)
  }

  const commitRename = () => {
    if (!editingTitleId) return
    const title = titleDraft.trim() || 'Untitled'
    const tabs = notebook.tabs.map((t) => (t.id === editingTitleId ? { ...t, title } : t))
    patchNotebook({ ...notebook, tabs })
    setEditingTitleId(null)
    setTitleDraft('')
  }

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus()
    try {
      document.execCommand(command, false, value)
    } catch {
      // ignore
    }
    handleInput()
  }

  const totalWords = useMemo(
    () => notebook.tabs.reduce((sum, t) => sum + wordCountFromHtml(t.contentHtml), 0),
    [notebook.tabs],
  )
  const totalChars = useMemo(
    () => notebook.tabs.reduce((sum, t) => sum + stripHtmlToText(t.contentHtml).length, 0),
    [notebook.tabs],
  )

  return (
    <Panel className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/90 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
            <BookText className="h-4 w-4 text-accent" />
            Notebook
          </div>
          <div className="mt-1 text-sm text-muted">
            Rich notes with several tabs. Autosaves to the project file.
          </div>
        </div>
        <div className="text-right text-xs text-muted">
          <div>{totalWords} words</div>
          <div>{totalChars} characters</div>
          <div className="mt-1">
            {notebook.updatedAt ? `Saved ${formatDateTime(notebook.updatedAt)}` : 'Not saved yet'}
          </div>
        </div>
      </div>

      <div className="flex min-h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-border/60 px-2 py-1.5">
        {notebook.tabs.map((tab) => {
          const isActive = tab.id === notebook.activeTabId
          return (
            <div
              key={tab.id}
              className={cn(
                'flex min-w-0 max-w-[200px] items-center gap-0.5 rounded-lg border px-1.5 py-1 text-sm transition',
                isActive ? 'border-accent/50 bg-accent/10 text-foreground' : 'border-transparent text-muted hover:bg-panelMuted/60',
              )}
            >
              {editingTitleId === tab.id ? (
                <input
                  autoFocus
                  className="min-w-0 flex-1 rounded bg-panel px-1 py-0.5 text-sm text-foreground outline-none ring-1 ring-accent/40"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      commitRename()
                    }
                    if (e.key === 'Escape') {
                      setEditingTitleId(null)
                    }
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left font-medium"
                  onClick={() => setActiveTab(tab.id)}
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    beginRename(tab)
                  }}
                >
                  {tab.title}
                </button>
              )}
              {notebook.tabs.length > 1 ? (
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 text-muted hover:bg-panelMuted hover:text-foreground"
                  title="Close tab"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTab(tab.id)
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          )
        })}
        <Button type="button" variant="ghost" size="sm" className="shrink-0 gap-1" onClick={addTab}>
          <Plus className="h-4 w-4" />
          Tab
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-border/50 px-3 py-2">
        <ToolbarIconButton label="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('bold')}>
          <Bold className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton label="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand('italic')}>
          <Italic className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="Underline"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCommand('underline')}
        >
          <Underline className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="Strikethrough"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCommand('strikeThrough')}
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarIconButton>
        <span className="mx-1 h-5 w-px bg-border/80" />
        <ToolbarIconButton
          label="Bullet list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCommand('insertUnorderedList')}
        >
          <List className="h-4 w-4" />
        </ToolbarIconButton>
        <ToolbarIconButton
          label="Numbered list"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => runCommand('insertOrderedList')}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarIconButton>
        <span className="mx-1 h-5 w-px bg-border/80" />
        <select
          className="h-8 rounded-lg border border-border/70 bg-panel px-2 text-xs text-foreground"
          aria-label="Text size"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            const v = e.target.value
            editorRef.current?.focus()
            if (v === 'p' || v === 'h2' || v === 'h3') {
              const tag = v === 'p' ? '<p>' : v === 'h2' ? '<h2>' : '<h3>'
              try {
                document.execCommand('formatBlock', false, tag)
              } catch {
                // ignore
              }
            } else if (v) {
              try {
                document.execCommand('fontSize', false, v)
              } catch {
                // ignore
              }
            }
            handleInput()
            e.target.selectedIndex = 0
          }}
          defaultValue=""
        >
          <option value="" disabled>
            Size / style
          </option>
          <option value="1">Small</option>
          <option value="3">Normal</option>
          <option value="5">Large</option>
          <option value="7">Extra large</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
          <option value="p">Paragraph</option>
        </select>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div
          ref={editorRef}
          className="notebook-editor-content min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border border-border/80 bg-black/10 px-4 py-4 text-[15px] leading-7 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline
          aria-label="Notebook content"
          onInput={handleInput}
          onBlur={flushIfDirty}
        />
      </div>
    </Panel>
  )
}

function ToolbarIconButton({
  label,
  children,
  onClick,
  onMouseDown,
}: {
  label: string
  children: ReactNode
  onClick(): void
  onMouseDown(e: React.MouseEvent): void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-panelMuted hover:text-foreground"
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
