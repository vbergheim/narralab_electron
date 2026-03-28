import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Clock3, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { Textarea } from '@/components/ui/textarea'
import { formatDateTime } from '@/lib/dates'
import { sceneColors, sceneStatuses } from '@/lib/constants'
import { minutesToSeconds, secondsToMinutes } from '@/lib/durations'
import type { Scene } from '@/types/scene'
import type { Tag } from '@/types/tag'

type Draft = {
  id: string
  title: string
  synopsis: string
  notes: string
  color: Scene['color']
  status: Scene['status']
  isKeyScene: boolean
  category: string
  estimatedDurationMinutes: number
  actualDurationMinutes: number
  location: string
  characters: string
  function: string
  sourceReference: string
  tags: string
}

type Props = {
  scene: Scene | null
  tags: Tag[]
  onSave(scene: {
    id: string
    title: string
    synopsis: string
    notes: string
    color: Scene['color']
    status: Scene['status']
    isKeyScene: boolean
    category: string
    estimatedDuration: number
    actualDuration: number
    location: string
    characters: string[]
    function: string
    sourceReference: string
    tagNames: string[]
  }): void
  onDelete(sceneId: string): void
}

export function SceneInspector({ scene, tags, onSave, onDelete }: Props) {
  const [draft, setDraft] = useState<Draft | null>(() => (scene ? toDraft(scene, tags) : null))

  const payload = useMemo(() => (draft ? toPayload(draft) : null), [draft])
  const sourceFingerprint = scene ? JSON.stringify(toDraft(scene, tags)) : null
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

  if (!scene || !draft) {
    return (
      <Panel className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <div className="font-display text-lg font-semibold text-foreground">Inspector</div>
          <div className="mt-2 text-sm text-muted">
            Select a scene in the bank or outline to edit metadata and notes.
          </div>
        </div>
      </Panel>
    )
  }

  return (
    <Panel className="h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/90 px-4 py-4">
        <div>
          <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
            Inspector
          </div>
          <div className="mt-1 text-sm text-muted">Autosaves locally while you work.</div>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            if (window.confirm(`Delete "${scene.title}"? This removes it from every board.`)) {
              onDelete(scene.id)
            }
          }}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      <div className="h-[calc(100%-78px)] overflow-y-auto p-4">
        <InspectorField label="Title">
          <Input value={draft.title} onChange={(event) => updateDraft(setDraft, 'title', event.target.value)} />
        </InspectorField>

        <InspectorField label="Synopsis">
          <Textarea
            value={draft.synopsis}
            onChange={(event) => updateDraft(setDraft, 'synopsis', event.target.value)}
          />
        </InspectorField>

        <InspectorField label="Notes">
          <Textarea
            className="min-h-[180px]"
            value={draft.notes}
            onChange={(event) => updateDraft(setDraft, 'notes', event.target.value)}
          />
        </InspectorField>

        <InspectorField label="Tags">
          <Input
            value={draft.tags}
            onChange={(event) => updateDraft(setDraft, 'tags', event.target.value)}
            placeholder="truth, archive, @contributor"
          />
        </InspectorField>

        <Grid>
          <InspectorField label="Category">
            <Input
              value={draft.category}
              onChange={(event) => updateDraft(setDraft, 'category', event.target.value)}
            />
          </InspectorField>
          <InspectorField label="Status">
            <select
              className="h-10 w-full rounded-xl border border-border bg-panel px-3 text-sm text-foreground outline-none"
              value={draft.status}
              onChange={(event) =>
                updateDraft(setDraft, 'status', event.target.value as Scene['status'])
              }
            >
              {sceneStatuses.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </InspectorField>
        </Grid>

        <InspectorField label="Scene Flags">
          <label className="flex items-center gap-3 rounded-xl border border-border bg-panel px-3 py-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={draft.isKeyScene}
              onChange={(event) => updateDraft(setDraft, 'isKeyScene', event.target.checked)}
            />
            Mark as key scene
          </label>
        </InspectorField>

        <InspectorField label="Color">
          <div className="flex flex-wrap gap-2">
            {sceneColors.map((color) => (
              <button
                key={color.value}
                type="button"
                aria-label={color.label}
                title={color.label}
                onClick={() => updateDraft(setDraft, 'color', color.value)}
                className={`h-9 w-9 rounded-full border transition ${
                  draft.color === color.value
                    ? 'border-accent/70 ring-2 ring-accent/30'
                    : 'border-border/80 hover:border-foreground/30'
                }`}
                style={{ backgroundColor: color.hex }}
              >
                <span className="sr-only">{color.label}</span>
              </button>
            ))}
          </div>
        </InspectorField>

        <Grid>
          <InspectorField label="Estimated Length (min)">
            <Input
              type="number"
              min={0}
              step="0.5"
              value={draft.estimatedDurationMinutes}
              onChange={(event) =>
                updateDraft(setDraft, 'estimatedDurationMinutes', Number(event.target.value))
              }
            />
          </InspectorField>
          <InspectorField label="Actual Length (min)">
            <Input
              type="number"
              min={0}
              step="0.5"
              value={draft.actualDurationMinutes}
              onChange={(event) =>
                updateDraft(setDraft, 'actualDurationMinutes', Number(event.target.value))
              }
            />
          </InspectorField>
        </Grid>

        <InspectorField label="Location">
          <Input
            value={draft.location}
            onChange={(event) => updateDraft(setDraft, 'location', event.target.value)}
          />
        </InspectorField>

        <InspectorField label="Characters / Contributors">
          <Input
            value={draft.characters}
            onChange={(event) => updateDraft(setDraft, 'characters', event.target.value)}
            placeholder="Person A, Person B"
          />
        </InspectorField>

        <InspectorField label="Dramaturgical Function">
          <Input
            value={draft.function}
            onChange={(event) => updateDraft(setDraft, 'function', event.target.value)}
          />
        </InspectorField>

        <InspectorField label="Source / Reference">
          <Input
            value={draft.sourceReference}
            onChange={(event) => updateDraft(setDraft, 'sourceReference', event.target.value)}
          />
        </InspectorField>

        <div className="mt-6 flex flex-wrap gap-2 border-t border-border/90 pt-4 text-xs text-muted">
          <Badge>
            <Clock3 className="mr-1.5 h-3 w-3" />
            Created {formatDateTime(scene.createdAt)}
          </Badge>
          <Badge>Updated {formatDateTime(scene.updatedAt)}</Badge>
        </div>
      </div>
    </Panel>
  )
}

function toDraft(scene: Scene, tags: Tag[]): Draft {
  return {
    id: scene.id,
    title: scene.title,
    synopsis: scene.synopsis,
    notes: scene.notes,
    color: scene.color,
    status: scene.status,
    isKeyScene: scene.isKeyScene,
    category: scene.category,
    estimatedDurationMinutes: secondsToMinutes(scene.estimatedDuration),
    actualDurationMinutes: secondsToMinutes(scene.actualDuration),
    location: scene.location,
    characters: scene.characters.join(', '),
    function: scene.function,
    sourceReference: scene.sourceReference,
    tags: tags
      .filter((tag) => scene.tagIds.includes(tag.id))
      .map((tag) => tag.name)
      .join(', '),
  }
}

function toPayload(draft: Draft) {
  return {
    id: draft.id,
    title: draft.title.trim() || 'Untitled scene',
    synopsis: draft.synopsis,
    notes: draft.notes,
    color: draft.color,
    status: draft.status,
    isKeyScene: draft.isKeyScene,
    category: draft.category,
    estimatedDuration: minutesToSeconds(draft.estimatedDurationMinutes || 0),
    actualDuration: minutesToSeconds(draft.actualDurationMinutes || 0),
    location: draft.location,
    characters: draft.characters
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
    function: draft.function,
    sourceReference: draft.sourceReference,
    tagNames: draft.tags
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  }
}

function updateDraft(
  setDraft: Dispatch<SetStateAction<Draft | null>>,
  key: keyof Draft,
  value: string | number | boolean,
) {
  setDraft((current) => (current ? { ...current, [key]: value } : current))
}

function InspectorField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</div>
      {children}
    </div>
  )
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>
}
