import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { PanelRightOpen } from 'lucide-react'

import { SceneCard } from '@/components/cards/scene-card'
import { InlineEditActions, InlineEditScope, InlineNameEditor, InlineTextareaEditor } from '@/components/ui/inline-name-editor'
import { KeyRatingButton } from '@/components/ui/key-rating-button'
import { InlineActionButton } from '@/features/boards/outline-workspace-shared'
import { hexToRgba } from '@/features/boards/outline-workspace-utils'
import { cn } from '@/lib/cn'
import { boardBlockKinds, sceneColors } from '@/lib/constants'
import type { BoardItem } from '@/types/board'
import { isSceneBoardItem } from '@/types/board'
import type { Scene } from '@/types/scene'
import type { Tag } from '@/types/tag'

export function BoardCanvasCard({
  item,
  scene,
  tags,
  selected,
  muted,
  overridePosition,
  onSelect,
  onOpenInspector,
  onToggleKeyScene,
  onUpdatePosition,
  onInlineUpdateScene,
  onInlineUpdateBlock,
  onContextMenu,
  onStartGroupDrag,
  shouldIgnoreDragTarget,
  zoom,
}: {
  item: BoardItem
  scene: Scene | null
  tags: Tag[]
  selected: boolean
  muted: boolean
  overridePosition?: { x: number; y: number } | null
  onSelect(sceneId: string | null, boardItemId?: string): void
  onOpenInspector(sceneId: string | null, boardItemId?: string): void
  onToggleKeyScene(scene: Scene): void
  onUpdatePosition(itemId: string, boardX: number, boardY: number): void
  onInlineUpdateScene(sceneId: string, input: { title: string; synopsis: string }): void
  onInlineUpdateBlock(itemId: string, input: { title: string; body: string }): void
  onContextMenu(item: BoardItem, event: ReactMouseEvent<HTMLDivElement>): void
  onStartGroupDrag?(event: ReactPointerEvent<HTMLDivElement>, itemId: string): boolean
  shouldIgnoreDragTarget(target: EventTarget | null): boolean
  zoom: number
}) {
  const [position, setPosition] = useState({ x: item.boardX, y: item.boardY })
  const [dragging, setDragging] = useState(false)
  const [settling, setSettling] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftBody, setDraftBody] = useState('')
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const positionRef = useRef(position)
  const settlingTimerRef = useRef<number | null>(null)
  const displayPosition = overridePosition ?? (dragging || settling ? position : { x: item.boardX, y: item.boardY })

  useEffect(() => {
    positionRef.current = position
  }, [position])

  const startEditing = () => {
    if (isSceneBoardItem(item)) {
      setDraftTitle(scene?.title ?? '')
      setDraftBody(scene?.synopsis ?? '')
    } else {
      setDraftTitle(item.title)
      setDraftBody(item.body)
    }
    setEditing(true)
  }

  useEffect(
    () => () => {
      if (settlingTimerRef.current) {
        window.clearTimeout(settlingTimerRef.current)
      }
    },
    [],
  )

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!dragRef.current) return
      const next = {
        x: Math.max(24, dragRef.current.originX + (event.clientX - dragRef.current.startX) / zoom),
        y: Math.max(24, dragRef.current.originY + (event.clientY - dragRef.current.startY) / zoom),
      }
      positionRef.current = next
      setPosition(next)
    }

    const onUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      setDragging(false)
      setSettling(true)
      if (settlingTimerRef.current) {
        window.clearTimeout(settlingTimerRef.current)
      }
      settlingTimerRef.current = window.setTimeout(() => {
        setSettling(false)
        settlingTimerRef.current = null
      }, 220)
      onUpdatePosition(item.id, positionRef.current.x, positionRef.current.y)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [item.id, onUpdatePosition, zoom])

  return (
    <div
      data-board-card="true"
      className={cn(
        'absolute cursor-grab active:cursor-grabbing',
        muted && 'opacity-40',
        editing && 'z-20',
        (dragging || overridePosition) && 'z-10',
      )}
      style={{
        left: displayPosition.x,
        top: displayPosition.y,
        width: item.boardW,
        willChange: dragging || Boolean(overridePosition) ? 'left, top' : undefined,
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }}
      onContextMenu={(event) => onContextMenu(item, event)}
      onPointerDown={(event) => {
        if (editing) {
          return
        }

        if (onStartGroupDrag?.(event, item.id)) {
          return
        }

        if (shouldIgnoreDragTarget(event.target)) {
          return
        }

        event.preventDefault()
        setDragging(true)
        dragRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          originX: displayPosition.x,
          originY: displayPosition.y,
        }
      }}
    >
      {editing ? (
        isSceneBoardItem(item) ? (
          <BoardCanvasSceneEditor
            scene={scene}
            selected={selected}
            title={draftTitle}
            synopsis={draftBody}
            onChangeTitle={setDraftTitle}
            onChangeSynopsis={setDraftBody}
            onSave={() => {
              if (scene) {
                onInlineUpdateScene(scene.id, {
                  title: draftTitle.trim() || scene.title,
                  synopsis: draftBody.trim(),
                })
              }
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
            onOpenInspector={() => onOpenInspector(scene?.id ?? null, item.id)}
            action={scene ? <KeyRatingButton value={scene.keyRating} onChange={() => onToggleKeyScene(scene)} /> : null}
          />
        ) : (
          <BoardCanvasTextEditor
            item={item}
            selected={selected}
            title={draftTitle}
            body={draftBody}
            onChangeTitle={setDraftTitle}
            onChangeBody={setDraftBody}
            onSave={() => {
              onInlineUpdateBlock(item.id, {
                title: draftTitle.trim() || item.title,
                body: draftBody.trim(),
              })
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
            onOpenInspector={() => onOpenInspector(null, item.id)}
          />
        )
      ) : isSceneBoardItem(item) ? (
        <SceneCard
          scene={scene ?? makeMissingSceneFallback(item.id)}
          tags={tags}
          density="compact"
          selected={selected}
          onClick={() => onSelect(scene?.id ?? null, item.id)}
          onDoubleClick={startEditing}
          actions={scene ? <KeyRatingButton value={scene.keyRating} onChange={() => onToggleKeyScene(scene)} /> : null}
        />
      ) : (
        <BoardCanvasTextDisplay
          item={item}
          selected={selected}
          onClick={() => onSelect(null, item.id)}
          onDoubleClick={startEditing}
        />
      )}
    </div>
  )
}

function BoardCanvasTextDisplay({
  item,
  selected,
  onClick,
  onDoubleClick,
}: {
  item: Exclude<BoardItem, { kind: 'scene' }>
  selected: boolean
  onClick(): void
  onDoubleClick(): void
}) {
  const kindMeta = boardBlockKinds.find((entry) => entry.value === item.kind)
  const accent = sceneColors.find((entry) => entry.value === kindMeta?.defaultColor)?.hex ?? '#7f8895'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className={cn(
        'rounded-2xl border px-4 py-3 text-left shadow-none transition',
        selected ? 'border-accent/60 ring-2 ring-accent/20' : 'border-border/70 hover:border-accent/35',
      )}
      style={{
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
      }}
    >
      <div className={cn('min-w-0', item.kind !== 'note' && 'text-center')}>
        <div
          className={cn(
            'text-[15px] font-semibold text-foreground',
            item.kind === 'voiceover' && 'font-mono uppercase tracking-[0.08em]',
            item.kind === 'chapter' && 'uppercase tracking-[0.12em]',
            item.kind === 'text-card' && 'uppercase tracking-[0.08em]',
          )}
        >
          {item.title || kindMeta?.defaultTitle}
        </div>
        {item.body?.trim() ? (
          <div
            className={cn(
              'mt-2 text-sm leading-6 text-foreground/84',
              item.kind !== 'note' && 'text-center',
              item.kind === 'voiceover' && 'font-mono italic',
            )}
          >
            {item.body}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function makeMissingSceneFallback(itemId: string): Scene {
  const now = new Date().toISOString()

  return {
    id: `missing-${itemId}`,
    sortOrder: 0,
    title: 'Missing scene',
    synopsis: 'Referenced scene no longer exists.',
    shootDate: '',
    shootBlock: '',
    notes: '',
    cameraNotes: '',
    audioNotes: '',
    color: 'slate',
    status: 'candidate',
    keyRating: 0,
    folder: '',
    category: '',
    estimatedDuration: 0,
    actualDuration: 0,
    location: '',
    characters: [],
    function: '',
    sourceReference: '',
    quoteMoment: '',
    quality: '',
    sourcePaths: [],
    createdAt: now,
    updatedAt: now,
    tagIds: [],
    beats: [],
  }
}

function BoardCanvasSceneEditor({
  scene,
  selected,
  title,
  synopsis,
  onChangeTitle,
  onChangeSynopsis,
  onSave,
  onCancel,
  onOpenInspector,
  action,
}: {
  scene: Scene | null
  selected: boolean
  title: string
  synopsis: string
  onChangeTitle(value: string): void
  onChangeSynopsis(value: string): void
  onSave(): void
  onCancel(): void
  onOpenInspector(): void
  action?: ReactNode
}) {
  const synopsisRef = useRef<HTMLTextAreaElement | null>(null)

  if (!scene) {
    return null
  }

  const accent = sceneColors.find((entry) => entry.value === scene.color)?.hex ?? '#7f8895'

  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-4 shadow-panel',
        selected ? 'border-accent/60 bg-panel ring-2 ring-accent/20' : 'border-border/80 bg-panel',
      )}
      style={{
        borderLeftColor: accent,
        borderLeftWidth: 4,
        backgroundImage: `linear-gradient(90deg, ${hexToRgba(accent, 0.16)} 0%, ${hexToRgba(accent, 0.04)} 18%, rgba(17,21,31,0.96) 56%)`,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <InlineEditScope className="min-w-0 flex-1 space-y-2" onSubmit={onSave} onCancel={onCancel}>
          <div className="flex items-center gap-2">
            <InlineNameEditor
              value={title}
              onChange={onChangeTitle}
              onSubmit={onSave}
              onEnterKey={() => synopsisRef.current?.focus()}
              onCancel={onCancel}
              className="h-9 flex-1"
              autoFocus={true}
            />
            <InlineEditActions onSave={onSave} onCancel={onCancel} />
          </div>
          <InlineTextareaEditor
            textareaRef={synopsisRef}
            value={synopsis}
            onChange={onChangeSynopsis}
            onSubmit={onSave}
            onCancel={onCancel}
            className="min-h-[96px]"
          />
        </InlineEditScope>
        <div className="flex shrink-0 items-center gap-1.5">
          <InlineActionButton label="Open inspector" onClick={onOpenInspector}>
            <PanelRightOpen className="h-4 w-4" />
          </InlineActionButton>
          {action}
        </div>
      </div>
    </div>
  )
}

function BoardCanvasTextEditor({
  item,
  selected,
  title,
  body,
  onChangeTitle,
  onChangeBody,
  onSave,
  onCancel,
  onOpenInspector,
}: {
  item: Exclude<BoardItem, { kind: 'scene' }>
  selected: boolean
  title: string
  body: string
  onChangeTitle(value: string): void
  onChangeBody(value: string): void
  onSave(): void
  onCancel(): void
  onOpenInspector(): void
}) {
  const kindMeta = boardBlockKinds.find((entry) => entry.value === item.kind)
  const accent = sceneColors.find((entry) => entry.value === kindMeta?.defaultColor)?.hex ?? '#7f8895'
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)

  return (
    <div
      className={cn(
        'rounded-2xl border px-4 py-4 shadow-panel',
        selected ? 'border-accent/60 bg-panel ring-2 ring-accent/20' : 'border-border/80 bg-panel',
      )}
      style={{
        borderLeftColor: accent,
        borderLeftWidth: item.kind === 'chapter' ? 8 : 6,
        backgroundColor: 'rgba(17,21,31,0.97)',
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <InlineEditScope className="min-w-0 flex-1 space-y-2" onSubmit={onSave} onCancel={onCancel}>
          <div className="flex items-center gap-2">
            <InlineNameEditor
              value={title}
              onChange={onChangeTitle}
              onSubmit={onSave}
              onEnterKey={() => bodyRef.current?.focus()}
              onCancel={onCancel}
              className="h-9 flex-1"
              autoFocus={true}
            />
            <InlineEditActions onSave={onSave} onCancel={onCancel} />
          </div>
          <InlineTextareaEditor
            textareaRef={bodyRef}
            value={body}
            onChange={onChangeBody}
            onSubmit={onSave}
            onCancel={onCancel}
            className="min-h-[96px]"
          />
        </InlineEditScope>
        <div className="flex shrink-0 items-center gap-1.5">
          <InlineActionButton label="Open inspector" onClick={onOpenInspector}>
            <PanelRightOpen className="h-4 w-4" />
          </InlineActionButton>
        </div>
      </div>
    </div>
  )
}
