import type { Dispatch, DragEvent, ReactNode, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Clock3, FileText, Folder, PanelRightClose, Plus, Search, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { InlineNameEditor } from '@/components/ui/inline-name-editor'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { StarRating } from '@/components/ui/star-rating'
import { Textarea } from '@/components/ui/textarea'
import { InspectorEmptyState } from '@/features/inspector/inspector-empty-state'
import { formatDateTime } from '@/lib/dates'
import { sceneColors } from '@/lib/constants'
import { minutesToSeconds, secondsToMinutes } from '@/lib/durations'
import type { Scene, SceneBeat, SceneBeatUpdateInput } from '@/types/scene'
import type { Tag } from '@/types/tag'
import type { TranscriptionItem } from '@/types/transcription'

type Draft = {
  id: string
  sortOrder: number
  title: string
  synopsis: string
  shootDate: string
  shootBlock: string
  notes: string
  cameraNotes: string
  audioNotes: string
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
  quoteMoment: string
  quality: string
  sourcePaths: string[]
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
    shootDate: string
    shootBlock: string
    notes: string
    cameraNotes: string
    audioNotes: string
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
    quoteMoment: string
    quality: string
    sourcePaths: string[]
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
  const [transcriptions, setTranscriptions] = useState<TranscriptionItem[]>([])
  const [previewTranscription, setPreviewTranscription] = useState<TranscriptionItem | null>(null)
  const [previewSearchQuery, setPreviewSearchQuery] = useState('')
  const [previewMatchIndex, setPreviewMatchIndex] = useState(0)
  const [sourceCollapsed, setSourceCollapsed] = useState(false)
  const [sourceDragActive, setSourceDragActive] = useState(false)
  const previewContentRef = useRef<HTMLDivElement | null>(null)

  const payload = useMemo(() => (draft ? toPayload(draft) : null), [draft])
  const sourceFingerprint = scene ? JSON.stringify(toDraft(scene, tags)) : null
  const draftFingerprint = draft ? JSON.stringify(draft) : null

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const items = await window.narralab.transcription.library.items.list()
        if (!cancelled) {
          setTranscriptions(items)
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load transcriptions:', error)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [scene?.id])

  useEffect(() => {
    if (!previewTranscription) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewTranscription(null)
        return
      }

      if (event.key === 'Enter' && previewSearchQuery.trim()) {
        event.preventDefault()
        setPreviewMatchIndex((current) =>
          event.shiftKey ? current - 1 : current + 1,
        )
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewSearchQuery, previewTranscription])

  useEffect(() => {
    if (!previewTranscription) {
      setPreviewSearchQuery('')
      setPreviewMatchIndex(0)
      return
    }
    setPreviewSearchQuery('')
    setPreviewMatchIndex(0)
  }, [previewTranscription?.id])

  const linkedTranscriptions = useMemo(() => {
    if (!scene) return []
    return transcriptions.filter((t) => t.sceneId === scene.id)
  }, [transcriptions, scene])

  const previewMatches = useMemo(
    () => findTranscriptMatchRanges(previewTranscription?.content ?? '', previewSearchQuery),
    [previewSearchQuery, previewTranscription?.content],
  )

  const normalizedPreviewMatchIndex = useMemo(() => {
    if (previewMatches.length === 0) return -1
    const remainder = previewMatchIndex % previewMatches.length
    return remainder >= 0 ? remainder : remainder + previewMatches.length
  }, [previewMatchIndex, previewMatches.length])

  const previewHighlightedContent = useMemo(
    () =>
      renderHighlightedTranscript(
        previewTranscription?.content ?? '',
        previewMatches,
        normalizedPreviewMatchIndex,
      ),
    [normalizedPreviewMatchIndex, previewMatches, previewTranscription?.content],
  )

  useEffect(() => {
    if (previewMatches.length === 0) {
      if (previewMatchIndex !== 0) {
        setPreviewMatchIndex(0)
      }
      return
    }

    if (previewMatchIndex !== normalizedPreviewMatchIndex) {
      setPreviewMatchIndex(normalizedPreviewMatchIndex)
    }
  }, [normalizedPreviewMatchIndex, previewMatchIndex, previewMatches.length])

  useEffect(() => {
    if (!previewTranscription || normalizedPreviewMatchIndex < 0 || !previewContentRef.current) return
    const target = previewContentRef.current.querySelector<HTMLElement>(
      `[data-transcript-match="${normalizedPreviewMatchIndex}"]`,
    )
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [normalizedPreviewMatchIndex, previewTranscription, previewHighlightedContent])

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

  const handleSourceDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setSourceDragActive(false)
    const paths = window.narralab.archive.items.resolveDroppedPaths(Array.from(event.dataTransfer.files))
    if (paths.length === 0) {
      return
    }
    updateDraft(setDraft, 'sourcePaths', normalizeSourcePaths([...draft.sourcePaths, ...paths]))
  }

  return (
    <>
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

        <InspectorSection title="Shoot Log">
          <MetaGrid>
            <InspectorField label="Shoot date" compact>
              <Input
                value={draft.shootDate}
                onChange={(event) => updateDraft(setDraft, 'shootDate', event.target.value)}
                placeholder="2026-04-03"
              />
            </InspectorField>
            <InspectorField label="Shoot block" compact>
              <Input
                value={draft.shootBlock}
                onChange={(event) => updateDraft(setDraft, 'shootBlock', event.target.value)}
                placeholder="Morning"
              />
            </InspectorField>
            <InspectorField label="Folder" compact>
              <Input
                value={draft.folder}
                onChange={(event) => updateDraft(setDraft, 'folder', event.target.value)}
              />
            </InspectorField>
            <InspectorField label="Category" compact>
              <Input
                value={draft.category}
                onChange={(event) => updateDraft(setDraft, 'category', event.target.value)}
              />
            </InspectorField>
            <InspectorField label="Est. length (min)" compact>
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
            <InspectorField label="Location" compact>
              <Input
                value={draft.location}
                onChange={(event) => updateDraft(setDraft, 'location', event.target.value)}
              />
            </InspectorField>
            <InspectorField label="Quality" compact>
              <Input
                value={draft.quality}
                onChange={(event) => updateDraft(setDraft, 'quality', event.target.value)}
              />
            </InspectorField>
          </MetaGrid>

          <InspectorField label="Characters / contributors">
            <Input
              value={draft.characters}
              onChange={(event) => updateDraft(setDraft, 'characters', event.target.value)}
              placeholder="Person A, Person B"
            />
          </InspectorField>

          <InspectorField label="Function">
            <Input
              value={draft.function}
              onChange={(event) => updateDraft(setDraft, 'function', event.target.value)}
            />
          </InspectorField>

          <InspectorField label="Camera notes">
            <Textarea
              value={draft.cameraNotes}
              onChange={(event) => updateDraft(setDraft, 'cameraNotes', event.target.value)}
            />
          </InspectorField>

          <InspectorField label="Audio notes">
            <Textarea
              value={draft.audioNotes}
              onChange={(event) => updateDraft(setDraft, 'audioNotes', event.target.value)}
            />
          </InspectorField>

          <InspectorField label="Notes">
            <Textarea
              className="min-h-[180px]"
              value={draft.notes}
              onChange={(event) => updateDraft(setDraft, 'notes', event.target.value)}
            />
          </InspectorField>
        </InspectorSection>

        <InspectorSection title="Editorial">
          <InspectorField label="Key rating">
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

          <InspectorField label="Quote / moment">
            <Textarea
              value={draft.quoteMoment}
              onChange={(event) => updateDraft(setDraft, 'quoteMoment', event.target.value)}
            />
          </InspectorField>
        </InspectorSection>

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

        <InspectorField label="Source Files">
          <div className="rounded-xl border border-border/80 bg-panel/40">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
              onClick={() => setSourceCollapsed((current) => !current)}
            >
              <div>
                <div className="text-sm font-medium text-foreground">
                  {draft.sourcePaths.length === 0
                    ? 'No linked files yet'
                    : `${draft.sourcePaths.length} linked item${draft.sourcePaths.length === 1 ? '' : 's'}`}
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  Primary source: {draft.sourceReference || 'None'}
                </div>
              </div>
              {sourceCollapsed ? (
                <ChevronRight className="h-4 w-4 text-muted" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted" />
              )}
            </button>

            {!sourceCollapsed ? (
              <div
                className={`border-t px-3 py-3 transition ${
                  sourceDragActive
                    ? 'border-accent/50 bg-accent/10'
                    : 'border-border/70 bg-transparent'
                }`}
                onDragOver={(event) => {
                  event.preventDefault()
                  setSourceDragActive(true)
                }}
                onDragEnter={(event) => {
                  event.preventDefault()
                  setSourceDragActive(true)
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  setSourceDragActive(false)
                }}
                onDrop={handleSourceDrop}
              >
                <div className="rounded-xl border border-dashed border-border/80 px-4 py-4 text-center text-xs text-muted">
                  Drop files or folders here
                </div>

                <div className="mt-3 space-y-2">
                  {draft.sourcePaths.map((path) => (
                    <div
                      key={path}
                      className="group flex items-start gap-3 rounded-xl border border-border/70 bg-panel px-3 py-3 transition hover:border-accent/40 hover:bg-panelMuted/50"
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                        onClick={() => {
                          void window.narralab.project.revealPath(path)
                        }}
                        title={path}
                      >
                        <Folder className="mt-0.5 h-4 w-4 shrink-0 text-accent/80" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground transition group-hover:text-accent">
                            {pathLabel(path)}
                          </div>
                          <div className="mt-0.5 break-all text-xs text-muted">{path}</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-panelMuted hover:text-foreground"
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          updateDraft(
                            setDraft,
                            'sourcePaths',
                            draft.sourcePaths.filter((entry) => entry !== path),
                          )
                        }}
                        aria-label={`Remove ${pathLabel(path)}`}
                        title="Remove source"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {draft.sourcePaths.length === 0 ? (
                    <div className="rounded-xl border border-border/60 bg-panel px-4 py-4 text-center text-xs text-muted">
                      No source references yet.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </InspectorField>

        <InspectorField label="Transcriptions">
          <div className="space-y-1.5">
            {linkedTranscriptions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPreviewTranscription(item)}
                className="group flex w-full items-center gap-2 rounded-lg border border-border/60 bg-panel/40 px-3 py-2 text-left transition hover:border-accent/40 hover:bg-panelMuted/50"
              >
                <FileText className="h-4 w-4 shrink-0 text-accent/80" />
                <span className="flex-1 truncate text-xs font-medium text-foreground/90">
                  {item.name}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted opacity-0 transition group-hover:opacity-100" />
              </button>
            ))}
            {linkedTranscriptions.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/80 px-4 py-6 text-center">
                <div className="text-xs text-muted">No linked transcriptions.</div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 text-[10px]"
                  onClick={() => window.narralab.windows.openWorkspace('transcribe')}
                >
                  Open Transcribe →
                </Button>
              </div>
            )}
          </div>
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
    {previewTranscription && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[220] bg-black/50 backdrop-blur-sm"
            onClick={() => setPreviewTranscription(null)}
          >
            <div
              className="fixed inset-4 z-[221] flex items-center justify-center"
              onClick={(event) => event.stopPropagation()}
            >
              <Panel className="flex h-[min(84vh,860px)] w-full max-w-5xl min-h-0 flex-col overflow-hidden">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 px-5 py-4">
                  <div className="min-w-0">
                    <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
                      Transcript
                    </div>
                    <div className="mt-1 truncate text-sm text-muted">
                      {previewTranscription.name}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={async () => {
                        await window.narralab.windows.updateGlobalUiState({
                          selectedTranscriptionItemId: previewTranscription.id,
                        })
                        await window.narralab.windows.openWorkspace('transcribe')
                        setPreviewTranscription(null)
                      }}
                    >
                      Open in Transcribe
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setPreviewTranscription(null)}
                      aria-label="Close transcript preview"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="shrink-0 border-b border-border/60 px-5 py-3 text-xs text-muted">
                  {previewTranscription.sourceFilePath ? (
                    <div className="truncate">{previewTranscription.sourceFilePath}</div>
                  ) : (
                    <div>No source file</div>
                  )}
                </div>
                <div className="shrink-0 border-b border-border/60 px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                      <Input
                        value={previewSearchQuery}
                        onChange={(event) => {
                          setPreviewSearchQuery(event.target.value)
                          setPreviewMatchIndex(0)
                        }}
                        className="pl-9"
                        placeholder="Search transcript…"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={previewMatches.length === 0}
                      onClick={() => setPreviewMatchIndex((current) => current - 1)}
                      aria-label="Previous match"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={previewMatches.length === 0}
                      onClick={() => setPreviewMatchIndex((current) => current + 1)}
                      aria-label="Next match"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <div className="w-20 text-right text-xs text-muted">
                      {previewMatches.length > 0 ? `${normalizedPreviewMatchIndex + 1} / ${previewMatches.length}` : '0 / 0'}
                    </div>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto bg-panelMuted/10 px-5 py-4">
                  <div
                    ref={previewContentRef}
                    className="whitespace-pre-wrap rounded-2xl border border-border/70 bg-panel/85 px-4 py-4 font-mono text-sm leading-6 text-foreground/90"
                  >
                    {previewTranscription.content ? previewHighlightedContent : 'Empty transcript.'}
                  </div>
                </div>
              </Panel>
            </div>
          </div>,
          document.body,
        )
      : null}
    </>
  )
}

function findTranscriptMatchRanges(text: string, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery || !text) return []

  const normalizedText = text.toLocaleLowerCase()
  const ranges: Array<{ start: number; end: number }> = []
  let startIndex = 0

  while (startIndex < normalizedText.length) {
    const matchIndex = normalizedText.indexOf(normalizedQuery, startIndex)
    if (matchIndex === -1) break
    ranges.push({ start: matchIndex, end: matchIndex + normalizedQuery.length })
    startIndex = matchIndex + normalizedQuery.length
  }

  return ranges
}

function renderHighlightedTranscript(
  text: string,
  matches: Array<{ start: number; end: number }>,
  activeMatchIndex: number,
) {
  if (matches.length === 0) return text

  const nodes: ReactNode[] = []
  let cursor = 0

  matches.forEach((match, index) => {
    if (cursor < match.start) {
      nodes.push(text.slice(cursor, match.start))
    }
    nodes.push(
      <mark
        key={`match:${match.start}:${match.end}`}
        data-transcript-match={index}
        className={index === activeMatchIndex ? 'rounded bg-accent px-0.5 text-accent-foreground' : 'rounded bg-accent/25 px-0.5 text-foreground'}
      >
        {text.slice(match.start, match.end)}
      </mark>,
    )
    cursor = match.end
  })

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }

  return nodes
}

function toDraft(scene: Scene, tags: Tag[]): Draft {
  return {
    id: scene.id,
    sortOrder: scene.sortOrder,
    title: scene.title,
    synopsis: scene.synopsis,
    shootDate: scene.shootDate,
    shootBlock: scene.shootBlock,
    notes: scene.notes,
    cameraNotes: scene.cameraNotes,
    audioNotes: scene.audioNotes,
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
    quoteMoment: scene.quoteMoment,
    quality: scene.quality,
    sourcePaths: normalizeSourcePaths(scene.sourcePaths),
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
    shootDate: draft.shootDate,
    shootBlock: draft.shootBlock,
    notes: draft.notes,
    cameraNotes: draft.cameraNotes,
    audioNotes: draft.audioNotes,
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
    sourceReference: draft.sourcePaths[0] ?? draft.sourceReference,
    quoteMoment: draft.quoteMoment,
    quality: draft.quality,
    sourcePaths: normalizeSourcePaths(draft.sourcePaths),
    tagNames: draft.tags
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  }
}

function updateDraft<K extends keyof Draft>(
  setDraft: Dispatch<SetStateAction<Draft | null>>,
  key: K,
  value: Draft[K],
) {
  setDraft((current) => {
    if (!current) {
      return current
    }

    const next = { ...current, [key]: value }
    if (key === 'sourcePaths') {
      next.sourcePaths = normalizeSourcePaths(value as Draft['sourcePaths'])
      next.sourceReference = next.sourcePaths[0] ?? ''
    }
    return next
  })
}

function normalizeSourcePaths(paths: string[]) {
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const path of paths) {
    const trimmed = path.trim()
    if (!trimmed) continue
    const display = trimmed.replace(/\\/g, '/')
    const key = display.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push(display)
  }

  return normalized
}

function pathLabel(path: string) {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/').filter(Boolean)
  return parts.at(-1) ?? normalized
}

function InspectorSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="mb-6">
      <div className="mb-4 border-t border-border/70 pt-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{title}</div>
      </div>
      {children}
    </section>
  )
}

function InspectorField({
  label,
  compact = false,
  children,
}: {
  label: string
  compact?: boolean
  children: ReactNode
}) {
  return (
    <div className={compact ? 'mb-3' : 'mb-4'}>
      <div
        className={`mb-2 font-medium text-muted ${
          compact
            ? 'text-[11px] uppercase tracking-[0.14em]'
            : 'text-[11px] uppercase tracking-[0.16em]'
        }`}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function MetaGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">{children}</div>
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
