import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { useRef, useState } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  PanelRightOpen,
  Plus,
  Plus as PlusIcon,
  X,
} from 'lucide-react'

import { SceneCard } from '@/components/cards/scene-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  InlineEditActions,
  InlineEditScope,
  InlineNameEditor,
  InlineTextareaEditor,
} from '@/components/ui/inline-name-editor'
import { KeyRatingButton } from '@/components/ui/key-rating-button'
import { Panel } from '@/components/ui/panel'
import { InlineActionButton } from '@/features/boards/outline-workspace-shared'
import { hexToRgba } from '@/features/boards/outline-workspace-utils'
import { cn } from '@/lib/cn'
import { boardBlockKinds, sceneColors } from '@/lib/constants'
import type {
  BoardItem,
  BoardTextItem,
  BoardTextItemKind,
} from '@/types/board'
import { isSceneBoardItem } from '@/types/board'
import type { Scene, SceneBeat, SceneBeatUpdateInput } from '@/types/scene'
import type { Tag } from '@/types/tag'
import type { SceneDensity } from '@/types/view'

export function OutlineDragOverlayContent({
  activeOverlay,
  activeSceneOverlay,
  scenes,
  tags,
  density,
}: {
  activeOverlay: Scene | BoardItem | null
  activeSceneOverlay: Scene | null
  scenes: Scene[]
  tags: Tag[]
  density: SceneDensity
}) {
  if (!activeOverlay) {
    return null
  }

  return (
    <div className="pointer-events-none flex w-[min(560px,80vw)] justify-center opacity-95">
      {'id' in activeOverlay && 'updatedAt' in activeOverlay && 'kind' in activeOverlay ? (
        activeSceneOverlay ? (
          <SceneCard
            scene={activeSceneOverlay}
            tags={tags.filter((tag) => activeSceneOverlay.tagIds.includes(tag.id))}
            density={density}
            overlay
          />
        ) : isSceneBoardItem(activeOverlay) ? (
          <OutlineSceneRow
            index={0}
            scene={scenes.find((entry) => entry.id === activeOverlay.sceneId) ?? null}
            tags={tags.filter((tag) =>
              (scenes.find((entry) => entry.id === activeOverlay.sceneId)?.tagIds ?? []).includes(tag.id),
            )}
            density={density}
            overlay
          />
        ) : (
          <OutlineTextRow item={activeOverlay} density={density} overlay />
        )
      ) : null}
    </div>
  )
}

export function BoardSortableItem({
  item,
  index,
  scene,
  tags,
  density,
  muted,
  selected,
  onClick,
  onDoubleClick,
  onToggleKeyScene,
  beatsExpanded,
  onToggleBeats,
  onCreateBeat,
  onUpdateBeat,
  onDeleteBeat,
  onInlineUpdateScene,
  onInlineUpdateBlock,
  onRemove,
  onContextMenu,
  afterContent,
}: {
  item: BoardItem
  index: number
  scene: Scene | null
  tags: Tag[]
  density: SceneDensity
  muted: boolean
  selected: boolean
  onClick(): void
  onDoubleClick(): void
  onToggleKeyScene(): void
  beatsExpanded: boolean
  onToggleBeats?(): void
  onCreateBeat(sceneId: string, afterBeatId?: string | null): void
  onUpdateBeat(input: SceneBeatUpdateInput): void
  onDeleteBeat(beatId: string): void
  onInlineUpdateScene(sceneId: string, input: { title: string; synopsis: string }): void
  onInlineUpdateBlock(itemId: string, input: { title: string; body: string }): void
  onRemove(): void
  onContextMenu(event: ReactMouseEvent<HTMLDivElement>): void
  afterContent?: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `item:${item.id}`,
    data: { kind: 'board-item', itemId: item.id },
  })

  return (
    <div
      ref={setNodeRef}
      data-board-item-id={item.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className="space-y-3"
    >
      <div
        onContextMenu={onContextMenu}
        className={cn(
          isSceneBoardItem(item)
            ? 'p-0'
            : density === 'detailed'
              ? 'rounded-2xl p-2'
              : density === 'compact'
                ? 'rounded-xl p-1.5'
                : 'rounded-lg p-1',
          muted && 'opacity-40',
          isDragging && 'opacity-40',
        )}
        {...(density !== 'detailed' ? attributes : {})}
        {...(density !== 'detailed' ? listeners : {})}
      >
        {isSceneBoardItem(item) ? (
          <OutlineSceneRow
            index={index}
            scene={scene}
            tags={tags}
            density={density}
            selected={selected}
            onClick={onClick}
            onOpenInspector={onDoubleClick}
            beatsExpanded={beatsExpanded}
            beatCount={scene?.beats.length ?? 0}
            onToggleBeats={onToggleBeats}
            beatsSection={
              scene && beatsExpanded ? (
                <OutlineBeatsSection
                  scene={scene}
                  onCreateBeat={onCreateBeat}
                  onUpdateBeat={onUpdateBeat}
                  onDeleteBeat={onDeleteBeat}
                />
              ) : null
            }
            onSave={(input) => scene && onInlineUpdateScene(scene.id, input)}
            actions={
              <>
                {density === 'detailed' ? (
                  <InlineActionButton label="Reorder outline row" onClick={() => undefined}>
                    <GripVertical {...attributes} {...listeners} className="h-4 w-4" />
                  </InlineActionButton>
                ) : null}
                {scene ? (
                  <KeyRatingButton value={scene.keyRating} onChange={onToggleKeyScene} />
                ) : null}
                {density === 'detailed' ? (
                  <Button variant="ghost" size="sm" onClick={onRemove}>
                    Remove
                  </Button>
                ) : (
                  <InlineActionButton label="Remove from outline" onClick={onRemove}>
                    <X className="h-4 w-4" />
                  </InlineActionButton>
                )}
              </>
            }
          />
        ) : (
          <OutlineTextRow
            item={item}
            density={density}
            selected={selected}
            onClick={onClick}
            onOpenInspector={onDoubleClick}
            onSave={(input) => onInlineUpdateBlock(item.id, input)}
            actions={
              <>
                {density === 'detailed' ? (
                  <InlineActionButton label="Reorder outline row" onClick={() => undefined}>
                    <GripVertical {...attributes} {...listeners} className="h-4 w-4" />
                  </InlineActionButton>
                ) : null}
                {density === 'detailed' ? (
                  <Button variant="ghost" size="sm" onClick={onRemove}>
                    Remove
                  </Button>
                ) : (
                  <InlineActionButton label="Remove block" onClick={onRemove}>
                    <X className="h-4 w-4" />
                  </InlineActionButton>
                )}
              </>
            }
          />
        )}
      </div>
      {afterContent}
    </div>
  )
}

function OutlineSceneRow({
  index,
  scene,
  tags,
  density,
  selected,
  overlay,
  beatCount = 0,
  beatsExpanded = false,
  beatsSection,
  actions,
  onClick,
  onDoubleClick,
  onOpenInspector,
  onToggleBeats,
  onSave,
}: {
  index: number
  scene: Scene | null
  tags: Tag[]
  density: SceneDensity
  selected?: boolean
  overlay?: boolean
  beatCount?: number
  beatsExpanded?: boolean
  beatsSection?: ReactNode
  actions?: ReactNode
  onClick?: () => void
  onDoubleClick?: () => void
  onOpenInspector?: () => void
  onToggleBeats?: () => void
  onSave?: (input: { title: string; synopsis: string }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftSynopsis, setDraftSynopsis] = useState('')
  const synopsisInputRef = useRef<HTMLInputElement | null>(null)

  if (!scene) {
    return (
      <Panel className="border-danger/40 bg-danger/5 px-4 py-3 text-sm text-muted">
        Referenced scene no longer exists.
      </Panel>
    )
  }

  const accent = sceneColors.find((entry) => entry.value === scene.color)?.hex ?? '#7f8895'
  const startEditing = () => {
    setDraftTitle(scene.title)
    setDraftSynopsis(scene.synopsis)
    setEditing(true)
  }

  const save = () => {
    onSave?.({
      title: draftTitle.trim() || scene.title,
      synopsis: draftSynopsis.trim(),
    })
    setEditing(false)
  }

  if (density === 'table') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onDoubleClick={onDoubleClick ?? startEditing}
        className={cn(
          'w-full rounded-lg border px-3 py-1.5 text-left transition',
          overlay ? 'rotate-1 shadow-panel' : 'shadow-none',
          selected
            ? 'border-accent/60 bg-white/[0.035] ring-2 ring-accent/20'
            : 'border-transparent hover:bg-white/[0.022]',
        )}
        style={{
          borderLeftColor: accent,
          borderLeftWidth: 4,
          backgroundImage: `linear-gradient(90deg, ${hexToRgba(accent, 0.18)} 0%, ${hexToRgba(accent, 0.05)} 18%, transparent 62%)`,
        }}
      >
        <div className="flex items-center justify-between gap-3 text-[13px] leading-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="w-7 shrink-0 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              {index + 1}.
            </div>
            {editing ? (
              <InlineEditScope
                className="flex min-w-0 flex-1 items-center gap-2"
                stopPropagation
                onSubmit={save}
                onCancel={() => setEditing(false)}
              >
                <InlineNameEditor
                  value={draftTitle}
                  onChange={setDraftTitle}
                  onSubmit={save}
                  onCancel={() => setEditing(false)}
                  onEnterKey={() => synopsisInputRef.current?.focus()}
                  className="h-8 min-w-[10rem]"
                  autoFocus={true}
                />
                <InlineNameEditor
                  inputRef={synopsisInputRef}
                  value={draftSynopsis}
                  onChange={setDraftSynopsis}
                  onSubmit={save}
                  onCancel={() => setEditing(false)}
                  className="h-8 min-w-[14rem] flex-1"
                />
                <InlineEditActions onSave={save} onCancel={() => setEditing(false)} />
              </InlineEditScope>
            ) : (
              <>
                <div className="min-w-0 truncate font-medium text-foreground">{scene.title}</div>
                <div className="min-w-0 truncate text-muted">{scene.synopsis || 'No synopsis yet'}</div>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onToggleBeats ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted transition hover:bg-panelMuted hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation()
                  onToggleBeats()
                }}
                aria-label={beatCount === 0 ? 'Add beat' : beatsExpanded ? 'Collapse beats' : 'Expand beats'}
                title={beatCount === 0 ? 'Add beat' : beatsExpanded ? 'Collapse beats' : 'Expand beats'}
              >
                {beatCount === 0 ? (
                  <PlusIcon className="h-3.5 w-3.5" />
                ) : beatsExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
                {beatCount > 0 ? <span>{beatCount}</span> : null}
              </button>
            ) : null}
            {editing && onOpenInspector ? (
              <InlineActionButton label="Open inspector" onClick={onOpenInspector}>
                <PanelRightOpen className="h-4 w-4" />
              </InlineActionButton>
            ) : null}
            {actions}
          </div>
        </div>
        {beatsSection ? (
          <div className="mt-3 border-t border-border/70 pt-3" onPointerDown={(event) => event.stopPropagation()}>
            {beatsSection}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick ?? startEditing}
      className={cn(
        'w-full rounded-2xl border px-4 text-left transition',
        density === 'compact' ? 'py-3' : 'py-4',
        overlay ? 'rotate-1 shadow-panel' : 'shadow-none',
        selected
          ? 'border-accent/60 bg-white/[0.035] ring-2 ring-accent/20'
          : 'border-transparent hover:bg-white/[0.028]',
      )}
      style={{
        borderLeftColor: accent,
        borderLeftWidth: 4,
        backgroundImage: `linear-gradient(90deg, ${hexToRgba(accent, 0.24)} 0%, ${hexToRgba(accent, 0.08)} 22%, transparent 68%)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="w-8 shrink-0 pt-0.5 text-right text-xs font-semibold uppercase tracking-[0.12em] text-muted">
            {index + 1}.
          </div>
          <div className="min-w-0">
            {editing ? (
              <InlineEditScope
                className="space-y-2"
                stopPropagation
                onSubmit={save}
                onCancel={() => setEditing(false)}
              >
                <div className="flex items-center gap-2">
                  <InlineNameEditor
                    value={draftTitle}
                    onChange={setDraftTitle}
                    onSubmit={save}
                    onCancel={() => setEditing(false)}
                    className="h-9 flex-1"
                    autoFocus={true}
                  />
                  <InlineEditActions onSave={save} onCancel={() => setEditing(false)} />
                </div>
                <InlineTextareaEditor
                  value={draftSynopsis}
                  onChange={setDraftSynopsis}
                  onSubmit={save}
                  onCancel={() => setEditing(false)}
                  className="min-h-[88px] resize-none"
                />
              </InlineEditScope>
            ) : (
              <>
                <div className="flex items-center gap-2 font-display text-[15px] font-semibold text-foreground">
                  {scene.title}
                </div>
                <div className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                  {scene.synopsis || 'No synopsis yet'}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {onToggleBeats ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted transition hover:bg-panelMuted hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation()
                onToggleBeats()
              }}
              aria-label={beatCount === 0 ? 'Add beat' : beatsExpanded ? 'Collapse beats' : 'Expand beats'}
              title={beatCount === 0 ? 'Add beat' : beatsExpanded ? 'Collapse beats' : 'Expand beats'}
            >
              {beatCount === 0 ? (
                <PlusIcon className="h-3.5 w-3.5" />
              ) : beatsExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              {beatCount > 0 ? <span>{beatCount}</span> : null}
            </button>
          ) : null}
          {editing && onOpenInspector ? (
            <InlineActionButton label="Open inspector" onClick={onOpenInspector}>
              <PanelRightOpen className="h-4 w-4" />
            </InlineActionButton>
          ) : null}
          {actions}
        </div>
      </div>
      {density === 'detailed' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag.id}>{tag.name}</Badge>
          ))}
          {scene.status !== 'candidate' ? <Badge className="capitalize">{scene.status}</Badge> : null}
        </div>
      ) : null}
      {beatsSection ? (
        <div className="mt-3 border-t border-border/70 pt-3" onPointerDown={(event) => event.stopPropagation()}>
          {beatsSection}
        </div>
      ) : null}
    </div>
  )
}

function OutlineBeatsSection({
  scene,
  onCreateBeat,
  onUpdateBeat,
  onDeleteBeat,
}: {
  scene: Scene
  onCreateBeat(sceneId: string, afterBeatId?: string | null): void
  onUpdateBeat(input: SceneBeatUpdateInput): void
  onDeleteBeat(beatId: string): void
}) {
  return (
    <SortableContext items={scene.beats.map((beat) => `beat:${scene.id}:${beat.id}`)} strategy={verticalListSortingStrategy}>
      <div className="space-y-1.5 border-l border-border/60 pl-4">
        {scene.beats.map((beat) => (
          <OutlineBeatRow
            key={`${beat.id}:${beat.updatedAt}`}
            sceneId={scene.id}
            beat={beat}
            onUpdateBeat={onUpdateBeat}
            onDeleteBeat={onDeleteBeat}
          />
        ))}
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-8 justify-start px-0 text-xs uppercase tracking-[0.14em] text-muted"
          onClick={() => onCreateBeat(scene.id, scene.beats.at(-1)?.id ?? null)}
        >
          <Plus className="h-4 w-4" />
          Add Beat
        </Button>
      </div>
    </SortableContext>
  )
}

function OutlineBeatRow({
  sceneId,
  beat,
  onUpdateBeat,
  onDeleteBeat,
}: {
  sceneId: string
  beat: SceneBeat
  onUpdateBeat(input: SceneBeatUpdateInput): void
  onDeleteBeat(beatId: string): void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `beat:${sceneId}:${beat.id}`,
    data: { kind: 'scene-beat', sceneId, beatId: beat.id },
  })
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => beat.text)

  const save = () => {
    onUpdateBeat({ id: beat.id, text: draft.trim() })
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex items-start gap-2 rounded-none border-0 bg-transparent px-0 py-1.5',
        isDragging && 'opacity-40',
      )}
      onDoubleClick={(event) => {
        event.stopPropagation()
        setEditing(true)
      }}
    >
      <button
        type="button"
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 cursor-grab items-center justify-center rounded-full text-muted transition hover:bg-panelMuted/60 hover:text-foreground active:cursor-grabbing"
        aria-label="Reorder beat"
        title="Reorder beat"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
      {editing ? (
        <InlineNameEditor
          value={draft}
          onChange={setDraft}
          onSubmit={save}
          onCancel={() => {
            setDraft(beat.text)
            setEditing(false)
          }}
          className="h-8 flex-1 text-sm"
          autoFocus={true}
        />
      ) : (
        <button
          type="button"
          className="min-w-0 flex-1 py-0.5 text-left text-[13px] leading-5 text-foreground/90"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => {
            event.stopPropagation()
            setEditing(true)
          }}
        >
          {beat.text || 'Untitled beat'}
        </button>
      )}
      <button
        type="button"
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-panelMuted/60 hover:text-foreground"
        aria-label="Delete beat"
        title="Delete beat"
        onClick={(event) => {
          event.stopPropagation()
          onDeleteBeat(beat.id)
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function OutlineTextRow({
  item,
  density,
  selected,
  overlay,
  actions,
  onClick,
  onDoubleClick,
  onOpenInspector,
  onSave,
}: {
  item: BoardTextItem
  density: SceneDensity
  selected?: boolean
  overlay?: boolean
  actions?: ReactNode
  onClick?: () => void
  onDoubleClick?: () => void
  onOpenInspector?: () => void
  onSave?: (input: { title: string; body: string }) => void
}) {
  const kindMeta = boardBlockKinds.find((entry) => entry.value === item.kind)
  const accent = sceneColors.find((entry) => entry.value === kindMeta?.defaultColor)?.hex ?? '#7f8895'
  const blockTitle = item.title || kindMeta?.defaultTitle
  const blockBody = item.body?.trim()
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')

  const kindClasses: Record<BoardTextItemKind, string> = {
    chapter:
      'mx-auto max-w-3xl border-foreground/30 py-4 text-center shadow-none',
    voiceover:
      density === 'table'
        ? 'mx-auto max-w-[34rem] border-foreground/30 py-1.5 shadow-none'
        : density === 'compact'
          ? 'mx-auto max-w-[38rem] border-foreground/30 py-2.5 shadow-none'
          : 'mx-auto max-w-[42rem] border-foreground/30 py-3 shadow-none',
    narration:
      density === 'table'
        ? 'mx-auto max-w-[32rem] border-foreground/25 py-1.5 shadow-none'
        : density === 'compact'
          ? 'mx-auto max-w-[36rem] border-foreground/25 py-2.5 shadow-none'
          : 'mx-auto max-w-[40rem] border-foreground/25 py-3 shadow-none',
    'text-card':
      density === 'table'
        ? 'mx-auto max-w-[30rem] border-foreground/35 py-1.5 text-center shadow-none'
        : density === 'compact'
          ? 'mx-auto max-w-[34rem] border-foreground/35 py-2.5 text-center shadow-none'
          : 'mx-auto max-w-[38rem] border-foreground/35 py-3 text-center shadow-none',
    note:
      density === 'table'
        ? 'mx-auto max-w-[32rem] border-foreground/25 py-1.5 shadow-none'
        : density === 'compact'
          ? 'mx-auto max-w-[36rem] border-foreground/25 py-2.5 shadow-none'
          : 'mx-auto max-w-[40rem] border-foreground/25 py-3 shadow-none',
  }

  const wrapperStyle: React.CSSProperties = {
    borderLeftColor: accent,
    borderLeftWidth: item.kind === 'chapter' ? 8 : 6,
    backgroundColor:
      item.kind === 'chapter'
        ? hexToRgba(accent, 0.68)
        : item.kind === 'text-card'
          ? hexToRgba(accent, 0.58)
          : item.kind === 'note'
            ? hexToRgba(accent, 0.48)
            : hexToRgba(accent, 0.54),
  }

  const startEditing = () => {
    setDraftTitle(item.title)
    setDraftBody(item.body)
    setEditing(true)
  }

  const save = () => {
    onSave?.({
      title: draftTitle.trim() || item.title,
      body: draftBody.trim(),
    })
    setEditing(false)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick ?? startEditing}
      className={cn(
        'w-full rounded-2xl border px-4 text-left transition',
        kindClasses[item.kind],
        overlay ? 'rotate-1 shadow-panel' : 'shadow-none',
        item.kind === 'note' ? 'border-dashed' : 'border-solid',
        selected
          ? 'border-accent/70 ring-2 ring-accent/20'
          : item.kind === 'chapter'
            ? 'hover:border-accent/35'
            : 'hover:border-accent/45',
      )}
      style={wrapperStyle}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn('min-w-0', item.kind !== 'note' && 'text-center')}>
          {editing ? (
            <InlineEditScope
              className="space-y-2"
              stopPropagation
              onSubmit={save}
              onCancel={() => setEditing(false)}
            >
              <div className="flex items-center gap-2">
                <InlineNameEditor
                  value={draftTitle}
                  onChange={setDraftTitle}
                  onSubmit={save}
                  onCancel={() => setEditing(false)}
                  className="h-9 flex-1"
                  autoFocus={true}
                />
                <InlineEditActions onSave={save} onCancel={() => setEditing(false)} />
              </div>
              <InlineTextareaEditor
                value={draftBody}
                onChange={setDraftBody}
                onSubmit={save}
                onCancel={() => setEditing(false)}
                className="min-h-[84px] resize-none"
              />
            </InlineEditScope>
          ) : (
            <>
              <div
                className={cn(
                  'flex items-center gap-2',
                  item.kind === 'chapter' || item.kind === 'text-card'
                    ? 'justify-center'
                    : item.kind === 'voiceover' || item.kind === 'narration'
                      ? 'justify-center'
                      : 'justify-start',
                )}
              >
                {item.kind === 'chapter' ? (
                  <div className="font-display text-xl font-semibold uppercase tracking-[0.16em] text-foreground">
                    {blockTitle}
                  </div>
                ) : item.kind === 'voiceover' ? (
                  <div className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-foreground/90">
                    {blockTitle}
                  </div>
                ) : item.kind === 'narration' ? (
                  <div className="font-display text-[15px] font-semibold tracking-[0.05em] text-foreground">
                    {blockTitle}
                  </div>
                ) : item.kind === 'text-card' ? (
                  <div className="font-display text-lg font-semibold uppercase tracking-[0.14em] text-foreground">
                    {blockTitle}
                  </div>
                ) : (
                  <div className="font-medium italic text-[15px] text-foreground/95">
                    {blockTitle}
                  </div>
                )}
              </div>
              {blockBody ? (
                <div
                  className={cn(
                    'mt-2 text-sm leading-6 text-muted',
                    density !== 'detailed' && 'line-clamp-2',
                    item.kind === 'chapter' && 'mx-auto max-w-2xl text-center text-foreground/78',
                    item.kind === 'voiceover' && 'mx-auto max-w-2xl text-center font-mono italic text-foreground/84',
                    item.kind === 'narration' && 'mx-auto max-w-2xl text-center text-foreground/76',
                    item.kind === 'text-card' && 'mx-auto max-w-xl text-center uppercase tracking-[0.08em] text-foreground/86',
                    item.kind === 'note' && 'italic text-foreground/74',
                  )}
                >
                  {blockBody}
                </div>
              ) : null}
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {editing && onOpenInspector ? (
            <InlineActionButton label="Open inspector" onClick={onOpenInspector}>
              <PanelRightOpen className="h-4 w-4" />
            </InlineActionButton>
          ) : null}
          {actions}
        </div>
      </div>
    </div>
  )
}
