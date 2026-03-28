import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { FileStack, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { Textarea } from '@/components/ui/textarea'
import { boardBlockKinds } from '@/lib/constants'
import { formatDateTime } from '@/lib/dates'
import type { BoardTextItem, BoardTextItemKind } from '@/types/board'

type Draft = Pick<BoardTextItem, 'id' | 'kind' | 'title' | 'body'>

type Props = {
  item: BoardTextItem | null
  onSave(input: Draft): void
  onDelete(itemId: string): void
}

export function BoardItemInspector({ item, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<Draft | null>(() => (item ? toDraft(item) : null))

  const payload = useMemo(() => (draft ? toPayload(draft) : null), [draft])
  const sourceFingerprint = item ? JSON.stringify(toDraft(item)) : null
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

  if (!item || !draft) {
    return (
      <Panel className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <div className="font-display text-lg font-semibold text-foreground">Inspector</div>
          <div className="mt-2 text-sm text-muted">
            Select a structure block in the outline to edit chapter, VO, narration, or note text.
          </div>
        </div>
      </Panel>
    )
  }

  const kindMeta = boardBlockKinds.find((entry) => entry.value === draft.kind)

  return (
    <Panel className="h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/90 px-4 py-4">
        <div>
          <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
            Structure Block
          </div>
          <div className="mt-1 text-sm text-muted">Autosaves locally while you work.</div>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (window.confirm(`Delete this ${kindMeta?.shortLabel.toLowerCase() ?? 'block'} from the outline?`)) {
              onDelete(item.id)
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <div className="h-[calc(100%-78px)] overflow-y-auto p-4">
        <InspectorField label="Type">
          <select
            className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-sm text-foreground outline-none"
            value={draft.kind}
            onChange={(event) => updateDraft(setDraft, 'kind', event.target.value as BoardTextItemKind)}
          >
            {boardBlockKinds.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </InspectorField>

        <InspectorField label={draft.kind === 'voiceover' || draft.kind === 'narration' ? 'Cue / Label' : 'Title'}>
          <Input value={draft.title} onChange={(event) => updateDraft(setDraft, 'title', event.target.value)} />
        </InspectorField>

        <InspectorField label="Text">
          <Textarea
            className="min-h-[180px]"
            value={draft.body}
            onChange={(event) => updateDraft(setDraft, 'body', event.target.value)}
          />
        </InspectorField>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border/90 pt-4 text-xs text-muted">
          <Badge>
            <FileStack className="mr-1.5 h-3 w-3" />
            {kindMeta?.label ?? 'Block'}
          </Badge>
          <Badge>Created {formatDateTime(item.createdAt)}</Badge>
          <Badge>Updated {formatDateTime(item.updatedAt)}</Badge>
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

function toDraft(item: BoardTextItem): Draft {
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    body: item.body,
  }
}

function toPayload(draft: Draft): Draft {
  return {
    ...draft,
    title: draft.title.trim(),
    body: draft.body,
  }
}

function updateDraft<K extends keyof Draft>(
  setDraft: Dispatch<SetStateAction<Draft | null>>,
  key: K,
  value: Draft[K],
) {
  setDraft((current) => (current ? { ...current, [key]: value } : current))
}
