import { useEffect, useMemo, useRef } from 'react'
import { BookText } from 'lucide-react'

import { Panel } from '@/components/ui/panel'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/dates'
import type { NotebookDocument } from '@/types/project'

type Props = {
  notebook: NotebookDocument
  onChange(content: string): void
  onSave(content: string): void
}

export function NotebookEditor({ notebook, onChange, onSave }: Props) {
  const lastPersistedContentRef = useRef(notebook.content)
  const lastPersistedUpdatedAtRef = useRef(notebook.updatedAt)
  const stats = useMemo(() => {
    const trimmed = notebook.content.trim()
    const words = trimmed ? trimmed.split(/\s+/).length : 0
    return { words, characters: notebook.content.length }
  }, [notebook.content])

  useEffect(() => {
    if (notebook.updatedAt && notebook.updatedAt !== lastPersistedUpdatedAtRef.current) {
      lastPersistedContentRef.current = notebook.content
      lastPersistedUpdatedAtRef.current = notebook.updatedAt
    }
  }, [notebook.content, notebook.updatedAt])

  useEffect(() => {
    if (notebook.content === lastPersistedContentRef.current) {
      return
    }

    const timer = window.setTimeout(() => {
      onSave(notebook.content)
    }, 400)

    return () => window.clearTimeout(timer)
  }, [notebook.content, onSave])

  const flushIfDirty = () => {
    if (notebook.content !== lastPersistedContentRef.current) {
      onSave(notebook.content)
    }
  }

  return (
    <Panel className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-border/90 px-5 py-4">
        <div>
          <div className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
            <BookText className="h-4 w-4 text-accent" />
            Notebook
          </div>
          <div className="mt-1 text-sm text-muted">
            Freeform project notes. Autosaves to the local project file.
          </div>
        </div>
        <div className="text-right text-xs text-muted">
          <div>{stats.words} words</div>
          <div>{stats.characters} characters</div>
          <div className="mt-1">
            {notebook.updatedAt ? `Saved ${formatDateTime(notebook.updatedAt)}` : 'Not saved yet'}
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-4">
        <Textarea
          className="min-h-0 flex-1 resize-none rounded-2xl border-border/80 bg-black/10 px-4 py-4 font-medium leading-7"
          placeholder="Keep beat notes, open questions, archival ideas, voiceover fragments, chapter thoughts, and rough story logic here..."
          value={notebook.content}
          onChange={(event) => onChange(event.target.value)}
          onBlur={flushIfDirty}
        />
      </div>
    </Panel>
  )
}
