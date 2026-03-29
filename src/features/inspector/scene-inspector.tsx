import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Clock3, PanelRightClose, Plus, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InlineNameEditor } from '@/components/ui/inline-name-editor'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { StarRating } from '@/components/ui/star-rating'
import { Textarea } from '@/components/ui/textarea'
import { InspectorEmptyState } from '@/features/inspector/inspector-empty-state'
import { formatDateTime } from '@/lib/dates'
import { sceneColors, sceneStatuses } from '@/lib/constants'
import { minutesToSeconds, secondsToMinutes } from '@/lib/durations'
import type { Scene, SceneBeat, SceneBeatUpdateInput } from '@/types/scene'
import type { Tag } from '@/types/tag'

type Draft = {
  id: string
  sortOrder: number
  title: string
  synopsis: string
  notes: string
  color: Scene['color']
  status: Scene['status']
  keyRating: number
  folder: string
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
  onCollapse?(): void
  onSave(scene: {
    id: string
    sortOrder: number
    title: string
    synopsis: string
    notes: string
    color: Scene['color']
    status: Scene['status']
    keyRating: number
    folder: string
    category: string
    estimatedDuration: number
    actualDuration: number
    location: string
    characters: string[]
    function: string
    sourceReference: string
    tagNames: string[]
  }): void
  onCreateBeat(sceneId: string, afterBeatId?: string | null): void
  onUpdateBeat(input: SceneBeatUpdateInput): void
  onDeleteBeat(beatId: string): void
  onReorderBeats(sceneId: string, beatIds: string[]): void
  onDelete(sceneId: string): void
}

export function SceneInspector({
  scene,
  tags,
  onCollapse,
  onSave,
  onCreateBeat,
  onUpdateBeat,
  onDeleteBeat,
  onReorderBeats,
  onDelete,
}: Props) {
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
      <InspectorEmptyState
        title="Inspector"
        description="Autosaves locally while you work."
        body="Select a scene in the bank or outline to edit metadata and notes."
        onCollapse={onCollapse}
      />
    )
  }

  return (
    <Panel className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/90 px-4 py-4">
        <div>
          <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
            Inspector
          </div>
          <div className="mt-1 text-sm text-muted">Autosaves locally while you work.</div>
        </div>
        {onCollapse ? (
          <Button variant="ghost" size="sm" onClick={onCollapse} title="Collapse inspector" aria-label="Collapse inspector">
            <PanelRightClose className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
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

        <InspectorField label="Beats">
          <div className="space-y-2">
            {scene.beats.map((beat, index) => (
              <BeatInspectorRow
                key={`${beat.id}:${beat.updatedAt}`}
                beat={beat}
                canMoveUp={index > 0}
                canMoveDown={index < scene.beats.length - 1}
                onUpdate={onUpdateBeat}
                onDelete={onDeleteBeat}
                onMoveUp={() => {
                  const next = arrayMoveIds(scene.beats.map((entry) => entry.id), index, index - 1)
                  onReorderBeats(scene.id, next)
                }}
                onMoveDown={() => {
                  const next = arrayMoveIds(scene.beats.map((entry) => entry.id), index, index + 1)
                  onReorderBeats(scene.id, next)
                }}
              />
            ))}
            <Button variant="ghost" size="sm" onClick={() => onCreateBeat(scene.id, scene.beats.at(-1)?.id ?? null)}>
              <Plus className="h-4 w-4" />
              Add Beat
            </Button>
          </div>
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

        <InspectorField label="Key Rating">
          <div className="rounded-xl border border-border bg-panel px-3 py-3">
            <div className="flex items-center justify-between gap-4">
              <StarRating value={draft.keyRating} size="md" interactive onChange={(value) => updateDraft(setDraft, 'keyRating', value)} />
              <button
                type="button"
                className="text-xs uppercase tracking-[0.16em] text-muted transition hover:text-foreground"
                onClick={() => updateDraft(setDraft, 'keyRating', 0)}
              >
                Clear
              </button>
            </div>
          </div>
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

        <div className="mt-6 border-t border-border/90 pt-4">
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
      </div>
    </Panel>
  )
}

function toDraft(scene: Scene, tags: Tag[]): Draft {
  return {
    id: scene.id,
    sortOrder: scene.sortOrder,
    title: scene.title,
    synopsis: scene.synopsis,
    notes: scene.notes,
    color: scene.color,
    status: scene.status,
    keyRating: scene.keyRating,
    folder: scene.folder,
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
    sortOrder: draft.sortOrder,
    title: draft.title.trim() || 'Untitled scene',
    synopsis: draft.synopsis,
    notes: draft.notes,
    color: draft.color,
    status: draft.status,
    keyRating: draft.keyRating,
    folder: draft.folder,
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
  value: string | number,
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

function BeatInspectorRow({
  beat,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  beat: SceneBeat
  canMoveUp: boolean
  canMoveDown: boolean
  onUpdate(input: SceneBeatUpdateInput): void
  onDelete(beatId: string): void
  onMoveUp(): void
  onMoveDown(): void
}) {
  const [draft, setDraft] = useState(() => beat.text)

  useEffect(() => {
    if (draft === beat.text) {
      return
    }

    const timer = window.setTimeout(() => {
      onUpdate({ id: beat.id, text: draft })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [beat.id, beat.text, draft, onUpdate])

  return (
    <div className="rounded-xl border border-border/80 bg-panel px-3 py-2">
      <div className="flex items-center gap-2">
        <InlineNameEditor
          value={draft}
          onChange={setDraft}
          onSubmit={() => onUpdate({ id: beat.id, text: draft })}
          placeholder="New beat"
          className="h-9 flex-1"
        />
        <InlineBeatAction label="Move beat up" disabled={!canMoveUp} onClick={onMoveUp}>
          <ArrowUp className="h-4 w-4" />
        </InlineBeatAction>
        <InlineBeatAction label="Move beat down" disabled={!canMoveDown} onClick={onMoveDown}>
          <ArrowDown className="h-4 w-4" />
        </InlineBeatAction>
        <InlineBeatAction label="Delete beat" onClick={() => onDelete(beat.id)}>
          <Trash2 className="h-4 w-4" />
        </InlineBeatAction>
      </div>
    </div>
  )
}

function InlineBeatAction({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick(): void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-muted transition hover:border-border hover:bg-panelMuted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function arrayMoveIds(items: string[], fromIndex: number, toIndex: number) {
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}
