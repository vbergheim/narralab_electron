import type { MouseEvent, MutableRefObject, ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'
import { Plus, Star } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Panel } from '@/components/ui/panel'
import { SceneCard } from '@/components/cards/scene-card'
import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import type { Board } from '@/types/board'
import { isSceneBoardItem } from '@/types/board'
import type { Scene } from '@/types/scene'
import type { Tag } from '@/types/tag'
import type { SceneDensity } from '@/types/view'

type Props = {
  scenes: Scene[]
  tags: Tag[]
  board: Board | null
  density: SceneDensity
  selectedSceneId: string | null
  selectedSceneIds: string[]
  onSelect(sceneId: string): void
  onToggleSelection(sceneId: string): void
  onSelectAllVisible(sceneIds: string[]): void
  onClearSelection(): void
  onOpenInspector(sceneId: string): void
  onToggleKeyScene(scene: Scene): void
  onDuplicate(sceneId: string): void
  onDelete(sceneId: string): void
  onAdd(sceneId: string, afterItemId?: string | null): void
}

export function SceneBankView({
  scenes,
  tags,
  board,
  density,
  selectedSceneId,
  selectedSceneIds,
  onSelect,
  onToggleSelection,
  onSelectAllVisible,
  onClearSelection,
  onOpenInspector,
  onToggleKeyScene,
  onDuplicate,
  onDelete,
  onAdd,
}: Props) {
  const boardSceneIds = useMemo(
    () => new Set(board?.items.filter(isSceneBoardItem).map((item) => item.sceneId) ?? []),
    [board],
  )
  const selectionAnchorRef = useRef<number | null>(null)
  const selectedSceneIdSet = useMemo(() => new Set(selectedSceneIds), [selectedSceneIds])
  const [menuState, setMenuState] = useState<{ sceneId: string; x: number; y: number } | null>(null)
  const menuItems = useMemo<ContextMenuItem[]>(() => {
    if (!menuState) return []
    const scene = scenes.find((entry) => entry.id === menuState.sceneId)
    if (!scene) return []

    return [
      { label: 'Open Inspector', onSelect: () => onOpenInspector(scene.id) },
      {
        label: boardSceneIds.has(scene.id) ? 'Already on Outline' : 'Add to Outline',
        onSelect: () => onAdd(scene.id),
        disabled: boardSceneIds.has(scene.id),
      },
      { label: 'Duplicate Scene', onSelect: () => onDuplicate(scene.id) },
      {
        label: scene.isKeyScene ? 'Unmark Key Scene' : 'Mark Key Scene',
        onSelect: () => onToggleKeyScene(scene),
      },
      {
        label: 'Delete Scene',
        danger: true,
        onSelect: () => {
          if (window.confirm(`Delete "${scene.title}"? This removes it from every board.`)) {
            onDelete(scene.id)
          }
        },
      },
    ]
  }, [boardSceneIds, menuState, onAdd, onDelete, onDuplicate, onOpenInspector, onToggleKeyScene, scenes])

  return (
    <Panel className="h-full overflow-hidden">
      <div className="border-b border-border/90 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
              Scene Bank
            </div>
            <div className="mt-1 text-sm text-muted">
              Browse the full scene pool and add candidates to the active outline.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onSelectAllVisible(scenes.map((scene) => scene.id))}>
              Select All
            </Button>
            {selectedSceneIds.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={onClearSelection}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        {selectedSceneIds.length > 0 ? (
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-accent/25 bg-accent/10 px-3 py-2 text-sm text-foreground">
            <div>{selectedSceneIds.length} scenes selected</div>
            <div className="text-xs uppercase tracking-[0.16em] text-muted">Click selects, Shift for range, Cmd/Ctrl for toggle</div>
          </div>
        ) : null}
      </div>
      <div
        className={cn(
          'h-[calc(100%-72px)] overflow-y-auto p-4',
          density === 'detailed' ? 'grid gap-4 md:grid-cols-2 xl:grid-cols-3' : 'space-y-2',
        )}
      >
        {scenes.map((scene, index) => (
          <div
            key={scene.id}
            className={cn(
              'relative rounded-2xl px-2 py-2 transition',
              selectedSceneIdSet.has(scene.id) && 'bg-accent/8 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]',
            )}
            role="button"
            tabIndex={0}
            onClick={(event) =>
              handleSelectionGesture({
                event,
                index,
                sceneId: scene.id,
                scenes,
                selectedSceneIds,
                selectionAnchorRef,
                onSelect,
                onToggleSelection,
                onSetSelection: onSelectAllVisible,
              })
            }
            onDoubleClick={() => onOpenInspector(scene.id)}
            onContextMenu={(event) => {
              event.preventDefault()
              handleSelectionGesture({
                event,
                index,
                sceneId: scene.id,
                scenes,
                selectedSceneIds,
                selectionAnchorRef,
                onSelect,
                onToggleSelection,
                onSetSelection: onSelectAllVisible,
              })
              setMenuState({ sceneId: scene.id, x: event.clientX, y: event.clientY })
            }}
          >
            {selectedSceneIdSet.has(scene.id) ? (
              <div className="absolute inset-y-2 left-0 w-1 rounded-full bg-accent/70" />
            ) : null}
            <SceneCard
              scene={scene}
              tags={tags.filter((tag) => scene.tagIds.includes(tag.id))}
              density={density}
              selected={selectedSceneIdSet.has(scene.id) || selectedSceneId === scene.id}
              actions={
                density !== 'detailed' ? (
                  <>
                    <InlineActionButton
                      label={scene.isKeyScene ? 'Unmark key scene' : 'Mark key scene'}
                      onClick={() => onToggleKeyScene(scene)}
                    >
                      <Star className={cn('h-4 w-4', scene.isKeyScene && 'fill-amber-400 text-amber-400')} />
                    </InlineActionButton>
                    {!boardSceneIds.has(scene.id) ? (
                      <InlineActionButton label="Add to outline" onClick={() => onAdd(scene.id)}>
                        <Plus className="h-4 w-4" />
                      </InlineActionButton>
                    ) : null}
                  </>
                ) : undefined
              }
            />
            {density === 'detailed' ? (
              <div className="mt-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation()
                    onAdd(scene.id)
                  }}
                  disabled={boardSceneIds.has(scene.id)}
                >
                  {boardSceneIds.has(scene.id) ? 'Already on board' : 'Add to board'}
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <ContextMenu
        open={Boolean(menuState)}
        x={menuState?.x ?? 0}
        y={menuState?.y ?? 0}
        items={menuItems}
        onClose={() => setMenuState(null)}
      />
    </Panel>
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

function handleSelectionGesture({
  event,
  index,
  sceneId,
  scenes,
  selectedSceneIds,
  selectionAnchorRef,
  onSelect,
  onToggleSelection,
  onSetSelection,
}: {
  event?: MouseEvent<HTMLElement>
  index: number
  sceneId: string
  scenes: Scene[]
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
    onSetSelection(scenes.slice(start, end + 1).map((scene) => scene.id))
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
