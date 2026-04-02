import type { MouseEvent, MutableRefObject, ReactNode } from 'react'
import { useRef, useState } from 'react'
import { PanelRightOpen, Plus } from 'lucide-react'

import { SceneCard } from '@/components/cards/scene-card'
import {
  InlineEditActions,
  InlineEditScope,
  InlineNameEditor,
  InlineTextareaEditor,
} from '@/components/ui/inline-name-editor'
import { KeyRatingButton } from '@/components/ui/key-rating-button'
import { sceneColors } from '@/lib/constants'
import { readSceneDragData, writeSceneDragData } from '@/lib/scene-drag'
import type { Scene } from '@/types/scene'
import type { Tag } from '@/types/tag'
import type { SceneDensity } from '@/types/view'
import { hexToRgba } from './scene-bank-utils'
import { cn } from '@/lib/cn'

export function SceneBankRow({
  scene,
  index,
  orderedScenes,
  selectionScope,
  tags,
  density,
  selectedSceneId,
  selectedSceneIds,
  selectedSceneIdSet,
  selectionAnchorByScopeRef,
  boardSceneIds,
  onSelect,
  onToggleSelection,
  onSetSelection,
  onOpenInspector,
  onInlineUpdateScene,
  onToggleKeyScene,
  onAdd,
  onContextMenu,
}: {
  scene: Scene
  index: number
  orderedScenes: Scene[]
  selectionScope: string
  tags: Tag[]
  density: SceneDensity
  selectedSceneId: string | null
  selectedSceneIds: string[]
  selectedSceneIdSet: Set<string>
  selectionAnchorByScopeRef: MutableRefObject<Map<string, number>>
  boardSceneIds: Set<string>
  onSelect(sceneId: string): void
  onToggleSelection(sceneId: string): void
  onSetSelection(sceneIds: string[]): void
  onOpenInspector(sceneId: string): void
  onInlineUpdateScene(sceneId: string, input: { title: string; synopsis: string }): void
  onToggleKeyScene(scene: Scene): void
  onAdd(sceneId: string, afterItemId?: string | null): void
  onContextMenu(state: { sceneId: string; x: number; y: number } | null): void
}) {
  const isOnBoard = boardSceneIds.has(scene.id)
  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(scene.title)
  const [draftSynopsis, setDraftSynopsis] = useState(scene.synopsis)

  const startEditing = () => {
    setDraftTitle(scene.title)
    setDraftSynopsis(scene.synopsis)
    setEditing(true)
  }

  const save = () => {
    onInlineUpdateScene(scene.id, {
      title: draftTitle.trim() || scene.title,
      synopsis: draftSynopsis.trim(),
    })
    setEditing(false)
  }

  return (
    <div
      draggable={!editing}
      onDragStart={(event) => {
        if (editing) {
          event.preventDefault()
          return
        }

        const draggedSceneIds =
          selectedSceneIdSet.has(scene.id) && selectedSceneIds.length > 1 ? selectedSceneIds : [scene.id]
        writeSceneDragData(event.dataTransfer, draggedSceneIds)
        event.dataTransfer.effectAllowed = 'copyMove'
        void window.narralab.windows.setDragSession({ kind: 'scene', sceneIds: draggedSceneIds })
      }}
      onDragEnd={() => {
        window.setTimeout(() => {
          void window.narralab.windows.setDragSession(null)
        }, 2000)
      }}
      onDragOver={(event) => {
        const draggedSceneIds = readSceneDragData(event.dataTransfer)
        if (draggedSceneIds.length === 0) return
        event.preventDefault()
        event.stopPropagation()
      }}
      className={cn(
        'relative rounded-2xl px-2 py-2 transition',
        selectedSceneIdSet.has(scene.id) && 'bg-accent/8 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]',
      )}
      role="button"
      tabIndex={0}
      onClick={(event) => {
        event.stopPropagation()
        const anchorRef = {
          get current() {
            return selectionAnchorByScopeRef.current.get(selectionScope) ?? null
          },
          set current(value: number | null) {
            if (value === null) {
              selectionAnchorByScopeRef.current.delete(selectionScope)
            } else {
              selectionAnchorByScopeRef.current.set(selectionScope, value)
            }
          },
        }
        handleSelectionGesture({
          event,
          index,
          sceneId: scene.id,
          orderedScenes,
          selectedSceneIds,
          selectionAnchorRef: anchorRef,
          onSelect,
          onToggleSelection,
          onSetSelection,
        })
      }}
      onDoubleClick={() => startEditing()}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const anchorRef = {
          get current() {
            return selectionAnchorByScopeRef.current.get(selectionScope) ?? null
          },
          set current(value: number | null) {
            if (value === null) {
              selectionAnchorByScopeRef.current.delete(selectionScope)
            } else {
              selectionAnchorByScopeRef.current.set(selectionScope, value)
            }
          },
        }
        handleSelectionGesture({
          event,
          index,
          sceneId: scene.id,
          orderedScenes,
          selectedSceneIds,
          selectionAnchorRef: anchorRef,
          onSelect,
          onToggleSelection,
          onSetSelection,
        })
        onContextMenu({ sceneId: scene.id, x: event.clientX, y: event.clientY })
      }}
    >
      {selectedSceneIdSet.has(scene.id) ? (
        <div className="absolute inset-y-2 left-0 w-1 rounded-full bg-accent/70" />
      ) : null}
      {editing ? (
        <SceneBankInlineEditor
          scene={scene}
          density={density}
          selected={selectedSceneIdSet.has(scene.id) || selectedSceneId === scene.id}
          draftTitle={draftTitle}
          draftSynopsis={draftSynopsis}
          onChangeTitle={setDraftTitle}
          onChangeSynopsis={setDraftSynopsis}
          onSave={save}
          onCancel={() => {
            setDraftTitle(scene.title)
            setDraftSynopsis(scene.synopsis)
            setEditing(false)
          }}
          onOpenInspector={() => onOpenInspector(scene.id)}
          actions={
            <>
              <KeyRatingButton value={scene.keyRating} onChange={() => onToggleKeyScene(scene)} />
              {density !== 'detailed' && !isOnBoard ? (
                <InlineActionButton label="Add to outline" onClick={() => onAdd(scene.id)}>
                  <Plus className="h-4 w-4" />
                </InlineActionButton>
              ) : null}
            </>
          }
        />
      ) : (
        <SceneCard
          scene={scene}
          tags={tags.filter((tag) => scene.tagIds.includes(tag.id))}
          density={density}
          selected={selectedSceneIdSet.has(scene.id) || selectedSceneId === scene.id}
          draggable
          onDoubleClick={() => startEditing()}
          actions={
            <>
              <KeyRatingButton value={scene.keyRating} onChange={() => onToggleKeyScene(scene)} />
              {density !== 'detailed' && !isOnBoard ? (
                <InlineActionButton label="Add to outline" onClick={() => onAdd(scene.id)}>
                  <Plus className="h-4 w-4" />
                </InlineActionButton>
              ) : null}
            </>
          }
        />
      )}
      {density === 'detailed' ? (
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm text-foreground transition hover:bg-panelMuted disabled:cursor-not-allowed disabled:opacity-50"
            onClick={(event) => {
              event.stopPropagation()
              onAdd(scene.id)
            }}
            disabled={isOnBoard}
          >
            {isOnBoard ? 'Already on board' : 'Add to board'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function InlineActionButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick(): void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted transition hover:border-border hover:bg-panelMuted hover:text-foreground"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

function SceneBankInlineEditor({
  scene,
  density,
  selected,
  draftTitle,
  draftSynopsis,
  onChangeTitle,
  onChangeSynopsis,
  onSave,
  onCancel,
  onOpenInspector,
  actions,
}: {
  scene: Scene
  density: SceneDensity
  selected?: boolean
  draftTitle: string
  draftSynopsis: string
  onChangeTitle(value: string): void
  onChangeSynopsis(value: string): void
  onSave(): void
  onCancel(): void
  onOpenInspector(): void
  actions?: ReactNode
}) {
  const synopsisInputRef = useRef<HTMLInputElement | null>(null)
  const accent = sceneColors.find((entry) => entry.value === scene.color)?.hex ?? '#7f8895'
  const cardStyle = {
    borderLeftColor: accent,
    borderLeftWidth: 4,
    backgroundImage: `linear-gradient(90deg, ${hexToRgba(accent, 0.24)} 0%, ${hexToRgba(accent, 0.08)} 18%, ${hexToRgba(accent, 0.03)} 42%, transparent 78%)`,
  }

  if (density === 'table') {
    return (
      <div
        className={cn(
          'group w-full rounded-lg border px-3 py-1.5 text-left transition',
          selected ? 'border-accent/60 bg-white/[0.035] ring-2 ring-accent/20' : 'border-transparent hover:bg-white/[0.022]',
        )}
        style={cardStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 text-[13px] leading-5">
          <InlineEditScope className="flex min-w-0 flex-1 items-center gap-2" onSubmit={onSave} onCancel={onCancel}>
            <InlineNameEditor
              value={draftTitle}
              onChange={onChangeTitle}
              onSubmit={onSave}
              onCancel={onCancel}
              onEnterKey={() => synopsisInputRef.current?.focus()}
              className="h-8 min-w-[10rem]"
              autoFocus={true}
            />
            <InlineNameEditor
              inputRef={synopsisInputRef}
              value={draftSynopsis}
              onChange={onChangeSynopsis}
              onSubmit={onSave}
              onCancel={onCancel}
              className="h-8 min-w-[14rem] flex-1"
            />
            <InlineEditActions onSave={onSave} onCancel={onCancel} />
          </InlineEditScope>
          <div className="flex shrink-0 items-center gap-1.5">
            <InlineActionButton label="Open inspector" onClick={onOpenInspector}>
              <PanelRightOpen className="h-4 w-4" />
            </InlineActionButton>
            {actions}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        density === 'compact' ? 'rounded-2xl px-4 py-3' : 'rounded-2xl px-4 py-4',
        'group w-full border text-left transition',
        selected
          ? 'border-accent/60 bg-white/[0.035] ring-2 ring-accent/20'
          : 'border-transparent hover:bg-white/[0.028]',
      )}
      style={cardStyle}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <InlineEditScope className="min-w-0 flex-1 space-y-2" onSubmit={onSave} onCancel={onCancel}>
          <div className="flex items-center gap-2">
            <InlineNameEditor
              value={draftTitle}
              onChange={onChangeTitle}
              onSubmit={onSave}
              onCancel={onCancel}
              className="h-9 flex-1"
              autoFocus={true}
            />
            <InlineEditActions onSave={onSave} onCancel={onCancel} />
          </div>
          <InlineTextareaEditor
            value={draftSynopsis}
            onChange={onChangeSynopsis}
            onSubmit={onSave}
            onCancel={onCancel}
            className={cn(density === 'compact' ? 'min-h-[72px]' : 'min-h-[88px]')}
          />
        </InlineEditScope>
        <div className="flex shrink-0 items-center gap-1.5">
          <InlineActionButton label="Open inspector" onClick={onOpenInspector}>
            <PanelRightOpen className="h-4 w-4" />
          </InlineActionButton>
          {actions}
        </div>
      </div>
    </div>
  )
}

function handleSelectionGesture({
  event,
  index,
  sceneId,
  orderedScenes,
  selectedSceneIds,
  selectionAnchorRef,
  onSelect,
  onToggleSelection,
  onSetSelection,
}: {
  event?: MouseEvent<HTMLElement>
  index: number
  sceneId: string
  orderedScenes: Scene[]
  selectedSceneIds: string[]
  selectionAnchorRef: MutableRefObject<number | null>
  onSelect(sceneId: string): void
  onToggleSelection(sceneId: string): void
  onSetSelection(sceneIds: string[]): void
}) {
  const isRangeSelection = Boolean(event?.shiftKey) && selectionAnchorRef.current !== null
  const isToggleSelection = Boolean(event?.metaKey || event?.ctrlKey)

  if (isRangeSelection) {
    const start = Math.min(selectionAnchorRef.current ?? index, index)
    const end = Math.max(selectionAnchorRef.current ?? index, index)
    onSetSelection(orderedScenes.slice(start, end + 1).map((scene) => scene.id))
    return
  }

  selectionAnchorRef.current = index

  if (isToggleSelection) {
    onToggleSelection(sceneId)
    return
  }

  if (selectedSceneIds.length > 1 || !selectedSceneIds.includes(sceneId)) {
    onSelect(sceneId)
    return
  }

  onToggleSelection(sceneId)
}
