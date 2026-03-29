import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Clapperboard } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { Textarea } from '@/components/ui/textarea'
import { sceneColors } from '@/lib/constants'
import { formatDateTime } from '@/lib/dates'
import type { Board, BoardUpdateInput } from '@/types/board'

type Draft = Pick<Board, 'id' | 'name' | 'description' | 'color' | 'folder'>

type Props = {
  board: Board | null
  onSave(input: BoardUpdateInput): void
}

export function BoardInspector({ board, onSave }: Props) {
  const [draft, setDraft] = useState<Draft | null>(() => (board ? toDraft(board) : null))

  const payload = useMemo(() => (draft ? toPayload(draft) : null), [draft])
  const sourceFingerprint = board ? JSON.stringify(toDraft(board)) : null
  const draftFingerprint = draft ? JSON.stringify(draft) : null

  useEffect(() => {
    if (!payload || sourceFingerprint === draftFingerprint) {
      return
    }

    const timer = window.setTimeout(() => {
      onSave(payload)
    }, 400)

    return () => window.clearTimeout(timer)
  }, [draftFingerprint, onSave, payload, sourceFingerprint])

  if (!board || !draft) {
    return (
      <Panel className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <div className="font-display text-lg font-semibold text-foreground">Board Inspector</div>
          <div className="mt-2 text-sm text-muted">
            Select a board to edit its name, description, and outline color.
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel className="h-full overflow-hidden">
      <div className="border-b border-border/90 px-4 py-4">
        <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
          Board
        </div>
        <div className="mt-1 text-sm text-muted">Outline settings autosave while you work.</div>
      </div>

      <div className="h-[calc(100%-78px)] overflow-y-auto p-4">
        <InspectorField label="Name">
          <Input value={draft.name} onChange={(event) => updateDraft(setDraft, 'name', event.target.value)} />
        </InspectorField>

        <InspectorField label="Folder">
          <Input
            value={draft.folder}
            onChange={(event) => updateDraft(setDraft, 'folder', event.target.value)}
            placeholder="Development, Main Film, Archive"
          />
        </InspectorField>

        <InspectorField label="Description">
          <Textarea
            className="min-h-[120px]"
            value={draft.description}
            onChange={(event) => updateDraft(setDraft, 'description', event.target.value)}
          />
        </InspectorField>

        <InspectorField label="Color">
          <div className="flex flex-wrap gap-2">
            {sceneColors.map((color) => {
              const active = draft.color === color.value
              return (
                <button
                  key={color.value}
                  type="button"
                  aria-label={color.label}
                  title={color.label}
                  className={`h-8 w-8 rounded-full border transition ${active ? 'border-white/90 ring-2 ring-white/20' : 'border-white/10 hover:border-white/40'}`}
                  style={{ backgroundColor: color.hex }}
                  onClick={() => updateDraft(setDraft, 'color', color.value)}
                />
              )
            })}
          </div>
        </InspectorField>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border/90 pt-4 text-xs text-muted">
          <Badge>
            <Clapperboard className="mr-1.5 h-3 w-3" />
            {board.items.length} rows
          </Badge>
          <Badge>Created {formatDateTime(board.createdAt)}</Badge>
          <Badge>Updated {formatDateTime(board.updatedAt)}</Badge>
        </div>
      </div>
    </Panel>
  )
}

function InspectorField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</div>
      {children}
    </div>
  )
}

function toDraft(board: Board): Draft {
  return {
    id: board.id,
    name: board.name,
    folder: board.folder,
    description: board.description,
    color: board.color,
  }
}

function toPayload(draft: Draft): BoardUpdateInput {
  return {
    ...draft,
    name: draft.name.trim(),
    description: draft.description,
  }
}

function updateDraft<K extends keyof Draft>(
  setDraft: Dispatch<SetStateAction<Draft | null>>,
  key: K,
  value: Draft[K],
) {
  setDraft((current) => (current ? { ...current, [key]: value } : current))
}
