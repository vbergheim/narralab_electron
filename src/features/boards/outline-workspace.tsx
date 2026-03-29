import type { Dispatch, MouseEvent as ReactMouseEvent, PointerEventHandler, ReactNode, RefObject, SetStateAction } from 'react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  GripVertical,
  LayoutPanelTop,
  Plus,
  X,
} from 'lucide-react'

import { SceneCard } from '@/components/cards/scene-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { KeyRatingButton } from '@/components/ui/key-rating-button'
import { Panel } from '@/components/ui/panel'
import { usePersistedStringArray } from '@/hooks/use-persisted-string-array'
import { usePanelResize } from '@/hooks/use-panel-resize'
import { cn } from '@/lib/cn'
import { boardBlockKinds, sceneColors } from '@/lib/constants'
import { formatDuration } from '@/lib/durations'
import type { BlockTemplate, Board, BoardItem, BoardTextItemKind } from '@/types/board'
import { isSceneBoardItem } from '@/types/board'
import type { Scene, SceneFolder } from '@/types/scene'
import type { Tag } from '@/types/tag'
import type { SceneDensity } from '@/types/view'

type Props = {
  board: Board
  allBoards: Board[]
  scenes: Scene[]
  sceneFolders: SceneFolder[]
  blockTemplates: BlockTemplate[]
  filteredSceneIds: string[]
  tags: Tag[]
  density: SceneDensity
  selectedSceneId: string | null
  selectedBoardItemId: string | null
  onSelect(sceneId: string | null, boardItemId?: string): void
  onOpenInspector(sceneId: string | null, boardItemId?: string): void
  onToggleKeyScene(scene: Scene): void
  onDuplicateScene(sceneId: string, afterItemId?: string | null): void
  onAddScene(sceneId: string, afterItemId?: string | null): void
  onAddBlock(kind: BoardTextItemKind, afterItemId?: string | null): void
  onAddTemplate(templateId: string, afterItemId?: string | null): void
  onSaveTemplate(input: { kind: BoardTextItemKind; name: string; title: string; body: string }): void
  onDeleteTemplate(templateId: string): void
  onCopyBlockToBoard(itemId: string, boardId: string): void
  onDuplicateBlock(itemId: string): void
  onRemoveBoardItem(itemId: string): void
  onReorder(itemIds: string[]): void
}

type DragPayload =
  | { kind: 'scene'; sceneId: string }
  | { kind: 'board-item'; itemId: string }
  | null

export function OutlineWorkspace({
  board,
  allBoards,
  scenes,
  sceneFolders,
  blockTemplates,
  filteredSceneIds,
  tags,
  density,
  selectedSceneId,
  selectedBoardItemId,
  onSelect,
  onOpenInspector,
  onToggleKeyScene,
  onDuplicateScene,
  onAddScene,
  onAddBlock,
  onAddTemplate,
  onSaveTemplate,
  onDeleteTemplate,
  onCopyBlockToBoard,
  onDuplicateBlock,
  onRemoveBoardItem,
  onReorder,
}: Props) {
  const [activeDrag, setActiveDrag] = useState<DragPayload>(null)
  const [menuState, setMenuState] = useState<{ itemId: string; x: number; y: number } | null>(null)
  const [copyMenuState, setCopyMenuState] = useState<{ itemId: string; x: number; y: number } | null>(null)
  const outlineScrollRef = useRef<HTMLDivElement | null>(null)
  const bankResize = usePanelResize({ initial: 320, min: 240, max: 520 })
  const [collapsedBankFolders, setCollapsedBankFolders] = usePersistedStringArray('docudoc:collapsed:scene-folders')
  const filteredSceneIdSet = useMemo(() => new Set(filteredSceneIds), [filteredSceneIds])
  const boardSceneIds = board.items.filter(isSceneBoardItem).map((item) => item.sceneId)
  const bankScenes = scenes.filter((scene) => filteredSceneIdSet.has(scene.id))
  const groupedBankScenes = useMemo(() => groupScenesByFolder(bankScenes, sceneFolders), [bankScenes, sceneFolders])
  const totalDuration = board.items.reduce((sum, item) => {
    if (!isSceneBoardItem(item)) return sum
    const scene = scenes.find((entry) => entry.id === item.sceneId)
    return sum + (scene?.estimatedDuration ?? 0)
  }, 0)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const activeOverlay = useMemo(() => {
    if (!activeDrag) return null
    if (activeDrag.kind === 'scene') {
      return scenes.find((scene) => scene.id === activeDrag.sceneId) ?? null
    }

    return board.items.find((item) => item.id === activeDrag.itemId) ?? null
  }, [activeDrag, board.items, scenes])
  const menuItems = useMemo<ContextMenuItem[]>(() => {
    if (!menuState) return []
    const item = board.items.find((entry) => entry.id === menuState.itemId)
    if (!item) return []

    if (isSceneBoardItem(item)) {
      const scene = scenes.find((entry) => entry.id === item.sceneId)
      if (!scene) return []
      return [
        { label: 'Open Inspector', onSelect: () => onOpenInspector(scene.id, item.id) },
        { label: 'Duplicate Scene', onSelect: () => onDuplicateScene(scene.id, item.id) },
        {
          label: scene.keyRating >= 5 ? 'Reset Key Rating' : 'Increase Key Rating',
          onSelect: () => onToggleKeyScene(scene),
        },
        { label: 'Remove from Outline', onSelect: () => onRemoveBoardItem(item.id) },
      ]
    }

    return [
      { label: 'Edit Block', onSelect: () => onOpenInspector(null, item.id) },
      {
        label: 'Copy To Board...',
        onSelect: () => {
          if (!menuState) return
          setCopyMenuState({ itemId: item.id, x: menuState.x, y: menuState.y })
        },
      },
      {
        label: 'Save as Template',
        onSelect: () =>
          onSaveTemplate({
            kind: item.kind,
            name: item.title.trim() || `${item.kind} template`,
            title: item.title,
            body: item.body,
          }),
      },
      { label: 'Duplicate Block', onSelect: () => onDuplicateBlock(item.id) },
      { label: 'Remove Block', danger: true, onSelect: () => onRemoveBoardItem(item.id) },
    ]
  }, [board.items, menuState, onDuplicateBlock, onDuplicateScene, onOpenInspector, onRemoveBoardItem, onSaveTemplate, onToggleKeyScene, scenes])

  const copyMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!copyMenuState) return []
    const item = board.items.find((entry) => entry.id === copyMenuState.itemId)
    if (!item || isSceneBoardItem(item)) return []

    return allBoards
      .filter((entry) => entry.id !== board.id)
      .map((targetBoard) => ({
        label: targetBoard.name,
        onSelect: () => onCopyBlockToBoard(item.id, targetBoard.id),
      }))
  }, [allBoards, board.id, board.items, copyMenuState, onCopyBlockToBoard])

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragStart={(event) => handleDragStart(event, setActiveDrag)}
      onDragEnd={(event) =>
        handleDragEnd(event, {
          board,
          onAddScene,
          onRemoveBoardItem,
          onReorder,
          setActiveDrag,
        })
      }
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="flex h-full min-w-0 gap-4">
        <div className="shrink-0" style={{ width: bankResize.size }}>
          <DropPanel id="bank-dropzone" title="Scene Bank" description="Drag scenes into the outline">
            <div className="space-y-3">
              {groupedBankScenes.groups.map((group) => (
                <div
                  key={group.folderPath}
                  className={cn(
                    'rounded-xl border border-border/50 bg-panelMuted/20 px-2 py-1.5',
                    hasCollapsedAncestor(group.folderPath, collapsedBankFolders) && 'hidden',
                  )}
                >
                  <button
                    type="button"
                    className="flex min-h-8 w-full items-center justify-between gap-2 px-1 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted transition hover:text-foreground"
                    style={{ paddingLeft: `${group.depth * 14 + 4}px` }}
                    onClick={() =>
                      setCollapsedBankFolders((current) =>
                        current.includes(group.folderPath)
                          ? current.filter((entry) => entry !== group.folderPath)
                          : [...current, group.folderPath],
                      )
                    }
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      {collapsedBankFolders.includes(group.folderPath) ? (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: colorHex(group.color) }} />
                      <span className="truncate">{formatFolderLabel(group.label)}</span>
                    </div>
                    <span className="min-w-4 text-right text-[10px] text-muted/80">{group.scenes.length}</span>
                  </button>
                  {!collapsedBankFolders.includes(group.folderPath) ? (
                    <div className="mt-1.5 space-y-3 pl-5">
                      {group.scenes.map((scene) => (
                        <BankSceneDraggable
                          key={scene.id}
                          scene={scene}
                          boardSceneIds={boardSceneIds}
                          tags={tags}
                          density={density}
                          selectedSceneId={selectedSceneId}
                          selectedBoardItemId={selectedBoardItemId}
                          onSelect={onSelect}
                          onOpenInspector={onOpenInspector}
                          onToggleKeyScene={onToggleKeyScene}
                          onAddScene={onAddScene}
                          outlineScrollRef={outlineScrollRef}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}

              {groupedBankScenes.rootScenes.length > 0 ? (
                <div className={cn(groupedBankScenes.groups.length > 0 && 'pt-1')}>
                  {groupedBankScenes.groups.length > 0 ? (
                    <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                      Loose Scenes
                    </div>
                  ) : null}
                  <div className="space-y-3">
                    {groupedBankScenes.rootScenes.map((scene) => (
                      <BankSceneDraggable
                        key={scene.id}
                        scene={scene}
                        boardSceneIds={boardSceneIds}
                        tags={tags}
                        density={density}
                        selectedSceneId={selectedSceneId}
                        selectedBoardItemId={selectedBoardItemId}
                        onSelect={onSelect}
                        onOpenInspector={onOpenInspector}
                        onToggleKeyScene={onToggleKeyScene}
                        onAddScene={onAddScene}
                        outlineScrollRef={outlineScrollRef}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </DropPanel>
        </div>

        <ResizeHandle
          label="Resize scene bank"
          active={bankResize.isResizing}
          onPointerDown={bankResize.startResize(1)}
        />

        <div className="min-w-0 flex-1">
          <DropPanel
            id="board-dropzone"
            title={board.name}
            description={`${board.items.length} rows · ${formatDuration(totalDuration)}`}
            headingAction={
              <div className="flex shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <AddBlockMenu
                  templates={blockTemplates}
                  onAddBlock={onAddBlock}
                  onAddTemplate={onAddTemplate}
                  onDeleteTemplate={onDeleteTemplate}
                  getInsertAfterItemId={() => resolveInsertAfterItemId(outlineScrollRef.current, selectedBoardItemId)}
                />
              </div>
            }
            bodyRef={outlineScrollRef}
          >
            <SortableContext items={board.items.map((item) => `item:${item.id}`)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {board.items.map((item, index) => (
                  <BoardSortableItem
                    key={item.id}
                    item={item}
                    index={index}
                    scene={isSceneBoardItem(item) ? scenes.find((entry) => entry.id === item.sceneId) ?? null : null}
                    tags={isSceneBoardItem(item) ? tags.filter((tag) => (scenes.find((entry) => entry.id === item.sceneId)?.tagIds ?? []).includes(tag.id)) : []}
                    density={density}
                    muted={isSceneBoardItem(item) ? !filteredSceneIdSet.has(item.sceneId) : false}
                    selected={selectedBoardItemId === item.id}
                    onClick={() => onSelect(isSceneBoardItem(item) ? item.sceneId : null, item.id)}
                    onDoubleClick={() => onOpenInspector(isSceneBoardItem(item) ? item.sceneId : null, item.id)}
                    onToggleKeyScene={() => {
                      if (isSceneBoardItem(item)) {
                        const scene = scenes.find((entry) => entry.id === item.sceneId)
                        if (scene) onToggleKeyScene(scene)
                      }
                    }}
                    onRemove={() => onRemoveBoardItem(item.id)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      onSelect(isSceneBoardItem(item) ? item.sceneId : null, item.id)
                      setMenuState({ itemId: item.id, x: event.clientX, y: event.clientY })
                    }}
                  />
                ))}
              </div>
            </SortableContext>
          </DropPanel>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeOverlay ? (
          <div className="max-w-[420px] opacity-95">
            {'id' in activeOverlay && 'updatedAt' in activeOverlay && 'kind' in activeOverlay ? (
              isSceneBoardItem(activeOverlay) ? (
                <OutlineSceneRow
                  index={0}
                  scene={scenes.find((entry) => entry.id === activeOverlay.sceneId) ?? null}
                  tags={tags.filter((tag) => (scenes.find((entry) => entry.id === activeOverlay.sceneId)?.tagIds ?? []).includes(tag.id))}
                  density={density}
                  overlay
                />
              ) : (
                <OutlineTextRow item={activeOverlay} density={density} overlay />
              )
            ) : (
              <SceneCard
                scene={activeOverlay}
                tags={tags.filter((tag) => activeOverlay.tagIds.includes(tag.id))}
                density={density}
                overlay
              />
            )}
          </div>
        ) : null}
      </DragOverlay>
      <ContextMenu
        open={Boolean(menuState)}
        x={menuState?.x ?? 0}
        y={menuState?.y ?? 0}
        items={menuItems}
        onClose={() => setMenuState(null)}
      />
      <ContextMenu
        open={Boolean(copyMenuState)}
        x={copyMenuState?.x ?? 0}
        y={copyMenuState?.y ?? 0}
        items={copyMenuItems}
        onClose={() => setCopyMenuState(null)}
      />
    </DndContext>
  )
}

function handleDragStart(
  event: DragStartEvent,
  setActiveDrag: Dispatch<SetStateAction<DragPayload>>,
) {
  const id = String(event.active.id)
  if (id.startsWith('scene:')) {
    setActiveDrag({ kind: 'scene', sceneId: id.replace('scene:', '') })
    return
  }
  if (id.startsWith('item:')) {
    setActiveDrag({ kind: 'board-item', itemId: id.replace('item:', '') })
  }
}

function handleDragEnd(
  event: DragEndEvent,
  {
    board,
    onAddScene,
    onRemoveBoardItem,
    onReorder,
    setActiveDrag,
  }: {
    board: Board
    onAddScene(sceneId: string, afterItemId?: string | null): void
    onRemoveBoardItem(itemId: string): void
    onReorder(itemIds: string[]): void
    setActiveDrag: Dispatch<SetStateAction<DragPayload>>
  },
) {
  const activeId = String(event.active.id)
  const overId = event.over ? String(event.over.id) : null

  if (!overId) {
    setActiveDrag(null)
    return
  }

  if (activeId.startsWith('scene:') && (overId === 'board-dropzone' || overId.startsWith('item:'))) {
    onAddScene(activeId.replace('scene:', ''), overId.startsWith('item:') ? overId.replace('item:', '') : null)
    setActiveDrag(null)
    return
  }

  if (activeId.startsWith('item:') && overId === 'bank-dropzone') {
    onRemoveBoardItem(activeId.replace('item:', ''))
    setActiveDrag(null)
    return
  }

  if (activeId.startsWith('item:') && (overId.startsWith('item:') || overId === 'board-dropzone')) {
    const currentIds = board.items.map((item) => `item:${item.id}`)
    const fromIndex = currentIds.indexOf(activeId)
    const toIndex = overId === 'board-dropzone' ? currentIds.length - 1 : currentIds.indexOf(overId)

    if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
      const next = arrayMove(currentIds, fromIndex, toIndex).map((itemId) => itemId.replace('item:', ''))
      onReorder(next)
    }
  }

  setActiveDrag(null)
}

function DropPanel({
  id,
  title,
  description,
  children,
  headingAction,
  bodyRef,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
  headingAction?: ReactNode
  bodyRef?: RefObject<HTMLDivElement | null>
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <Panel
      ref={setNodeRef}
      className={cn(
        'flex h-full flex-col',
        isOver && 'border-accent/60 bg-accent/5',
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/90 px-4 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
            <LayoutPanelTop className="h-4 w-4 text-accent" />
            <span className="truncate">{title}</span>
          </div>
          <div className="mt-1 truncate text-sm text-muted">{description}</div>
        </div>
        {headingAction}
      </div>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </Panel>
  )
}

function AddBlockMenu({
  templates,
  onAddBlock,
  onAddTemplate,
  onDeleteTemplate,
  getInsertAfterItemId,
}: {
  templates: BlockTemplate[]
  onAddBlock(kind: BoardTextItemKind, afterItemId?: string | null): void
  onAddTemplate(templateId: string, afterItemId?: string | null): void
  onDeleteTemplate(templateId: string): void
  getInsertAfterItemId(): string | null
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open || !rootRef.current) return
    const rect = rootRef.current.getBoundingClientRect()
    setPosition({ left: rect.right - 256, top: rect.bottom + 8 })
  }, [open])

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return

    const rect = menuRef.current.getBoundingClientRect()
    const margin = 12
    setPosition((current) => ({
      left: Math.max(margin, Math.min(current.left, window.innerWidth - rect.width - margin)),
      top: Math.max(margin, Math.min(current.top, window.innerHeight - rect.height - margin)),
    }))
  }, [open, templates.length])

  return (
    <div ref={rootRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((current) => !current)}
        title="Add Block"
        aria-label="Add Block"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden xl:inline">Add Block</span>
      </Button>
      {open
        ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-50 w-64 rounded-2xl border border-border/90 bg-panel/95 p-2 shadow-panel backdrop-blur"
          style={{ left: position.left, top: position.top }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {boardBlockKinds.map((kind) => (
            <button
              key={kind.value}
              type="button"
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-foreground transition hover:bg-panelMuted"
              onClick={() => {
                onAddBlock(kind.value, getInsertAfterItemId())
                setOpen(false)
              }}
            >
              <span>{kind.label}</span>
              <Badge>{kind.shortLabel}</Badge>
            </button>
          ))}
          {templates.length > 0 ? (
            <>
              <div className="my-2 h-px bg-border/80" />
              <div className="px-3 pb-1 pt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Templates
              </div>
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition hover:bg-panelMuted"
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl px-1 py-1 text-left text-sm text-foreground"
                    onClick={() => {
                      onAddTemplate(template.id, getInsertAfterItemId())
                      setOpen(false)
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{template.name}</span>
                      <span className="block truncate text-xs text-muted">{template.title || 'Saved block template'}</span>
                    </span>
                    <Badge>{boardBlockKinds.find((entry) => entry.value === template.kind)?.shortLabel ?? 'Block'}</Badge>
                  </button>
                  <InlineActionButton label="Delete template" onClick={() => onDeleteTemplate(template.id)}>
                    <X className="h-4 w-4" />
                  </InlineActionButton>
                </div>
              ))}
            </>
          ) : null}
        </div>,
        document.body,
      )
        : null}
    </div>
  )
}

function BankSceneDraggable({
  scene,
  boardSceneIds,
  tags,
  density,
  selectedSceneId,
  selectedBoardItemId,
  onSelect,
  onOpenInspector,
  onToggleKeyScene,
  onAddScene,
  outlineScrollRef,
}: {
  scene: Scene
  boardSceneIds: string[]
  tags: Tag[]
  density: SceneDensity
  selectedSceneId: string | null
  selectedBoardItemId: string | null
  onSelect(sceneId: string | null, boardItemId?: string): void
  onOpenInspector(sceneId: string | null, boardItemId?: string): void
  onToggleKeyScene(scene: Scene): void
  onAddScene(sceneId: string, afterItemId?: string | null): void
  outlineScrollRef: RefObject<HTMLDivElement | null>
}) {
  const isOnBoard = boardSceneIds.includes(scene.id)

  return (
    <SceneDraggable
      id={`scene:${scene.id}`}
      scene={scene}
      tags={tags.filter((tag) => scene.tagIds.includes(tag.id))}
      density={density}
      selected={selectedSceneId === scene.id && !selectedBoardItemId}
      onClick={() => onSelect(scene.id)}
      onDoubleClick={() => onOpenInspector(scene.id)}
      onToggleKeyScene={() => onToggleKeyScene(scene)}
      onAdd={() => onAddScene(scene.id, resolveInsertAfterItemId(outlineScrollRef.current, selectedBoardItemId))}
      showAdd={!isOnBoard}
      footer={
        isOnBoard ? (
          <Badge className="border-accent/40 bg-accent/10 text-accent">On outline</Badge>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => onAddScene(scene.id)}>
            Add
          </Button>
        )
      }
    />
  )
}

function SceneDraggable({
  id,
  scene,
  tags,
  selected,
  onClick,
  onDoubleClick,
  onToggleKeyScene,
  onAdd,
  showAdd,
  footer,
  density,
}: {
  id: string
  scene: Scene
  tags: Tag[]
  density: SceneDensity
  selected: boolean
  onClick(): void
  onDoubleClick(): void
  onToggleKeyScene(): void
  onAdd(): void
  showAdd: boolean
  footer: ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: { kind: 'scene', sceneId: scene.id },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && 'opacity-40')}
      {...(density !== 'detailed' ? attributes : {})}
      {...(density !== 'detailed' ? listeners : {})}
    >
      <SceneCard
        scene={scene}
        tags={tags}
        density={density}
        selected={selected}
        draggable
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        actions={
            <>
              <KeyRatingButton value={scene.keyRating} onChange={onToggleKeyScene} />
              {showAdd ? (
                <InlineActionButton label="Add to outline" onClick={onAdd}>
                  <Plus className="h-4 w-4" />
              </InlineActionButton>
            ) : null}
          </>
        }
      />
      {density === 'detailed' ? (
        <div className="mt-2 flex items-center justify-between px-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-xs text-muted hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
            Drag to outline
          </button>
          {footer}
        </div>
      ) : null}
    </div>
  )
}

function groupScenesByFolder(scenes: Scene[], folders: SceneFolder[]) {
  const groups = new Map<string, { folderPath: string; label: string; color: SceneFolder['color']; scenes: Scene[]; depth: number }>()
  const order = [...folders]
    .sort((left, right) => left.sortOrder - right.sortOrder || left.path.localeCompare(right.path))
    .map((folder) => folder.path)

  order.forEach((folderPath) => {
    const folder = folders.find((entry) => entry.path === folderPath)
    groups.set(folderPath, {
      folderPath,
      label: folder?.name ?? folderPath.split('/').at(-1) ?? '',
      color: folder?.color ?? 'slate',
      scenes: [],
      depth: folderPath.split('/').length - 1,
    })
  })

  const rootScenes: Scene[] = []

  scenes.forEach((scene) => {
    const folderPath = scene.folder.trim()
    if (!folderPath) {
      rootScenes.push(scene)
      return
    }

    if (!groups.has(folderPath)) {
      groups.set(folderPath, {
        folderPath,
        label: folderPath.split('/').at(-1) ?? folderPath,
        color: 'slate',
        scenes: [],
        depth: folderPath.split('/').length - 1,
      })
      order.push(folderPath)
    }

    groups.get(folderPath)?.scenes.push(scene)
  })

  return {
    groups: order.map((folderPath) => groups.get(folderPath)!).filter((group) => group.scenes.length > 0),
    rootScenes,
  }
}

function hasCollapsedAncestor(path: string, collapsedFolders: string[]) {
  return collapsedFolders.some((collapsedPath) => path !== collapsedPath && path.startsWith(`${collapsedPath}/`))
}

function BoardSortableItem({
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
  onRemove,
  onContextMenu,
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
  onRemove(): void
  onContextMenu(event: ReactMouseEvent<HTMLDivElement>): void
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
          onDoubleClick={onDoubleClick}
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
          onDoubleClick={onDoubleClick}
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
  )
}

function OutlineSceneRow({
  index,
  scene,
  tags,
  density,
  selected,
  overlay,
  actions,
  onClick,
  onDoubleClick,
}: {
  index: number
  scene: Scene | null
  tags: Tag[]
  density: SceneDensity
  selected?: boolean
  overlay?: boolean
  actions?: ReactNode
  onClick?: () => void
  onDoubleClick?: () => void
}) {
  if (!scene) {
    return (
      <Panel className="border-danger/40 bg-danger/5 px-4 py-3 text-sm text-muted">
        Referenced scene no longer exists.
      </Panel>
    )
  }

  const accent = sceneColors.find((entry) => entry.value === scene.color)?.hex ?? '#7f8895'

  if (density === 'table') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
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
            <div className="min-w-0 truncate font-medium text-foreground">{scene.title}</div>
            <div className="min-w-0 truncate text-muted">{scene.synopsis || 'No synopsis yet'}</div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
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
            <div className="flex items-center gap-2 font-display text-[15px] font-semibold text-foreground">
              {scene.title}
            </div>
            <div className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
              {scene.synopsis || 'No synopsis yet'}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      </div>
      {density === 'detailed' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag.id}>{tag.name}</Badge>
          ))}
          <Badge className="capitalize">{scene.status}</Badge>
        </div>
      ) : null}
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
}: {
  item: Exclude<BoardItem, { kind: 'scene' }>
  density: SceneDensity
  selected?: boolean
  overlay?: boolean
  actions?: ReactNode
  onClick?: () => void
  onDoubleClick?: () => void
}) {
  const kindMeta = boardBlockKinds.find((entry) => entry.value === item.kind)
  const accent = sceneColors.find((entry) => entry.value === kindMeta?.defaultColor)?.hex ?? '#7f8895'
  const blockTitle = item.title || kindMeta?.defaultTitle
  const blockBody = item.body?.trim()

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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
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
        </div>
        <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
      </div>
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

function ResizeHandle({
  label,
  active,
  onPointerDown,
}: {
  label: string
  active?: boolean
  onPointerDown: PointerEventHandler<HTMLButtonElement>
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="group relative flex w-3 shrink-0 cursor-col-resize items-center justify-center rounded-full text-muted outline-none transition hover:bg-panelMuted/70 hover:text-foreground"
      onPointerDown={onPointerDown}
    >
      <span className={`h-full w-px rounded-full bg-border transition ${active ? 'bg-accent' : 'group-hover:bg-accent/70'}`} />
      <GripVertical className="pointer-events-none absolute h-4 w-4 opacity-0 transition group-hover:opacity-100" />
    </button>
  )
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized

  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function colorHex(color: SceneFolder['color']) {
  return sceneColors.find((entry) => entry.value === color)?.hex ?? '#607086'
}

function formatFolderLabel(label: string) {
  return label.toLocaleUpperCase('nb-NO')
}

function resolveInsertAfterItemId(
  container: HTMLDivElement | null,
  selectedBoardItemId: string | null,
) {
  if (selectedBoardItemId) {
    return selectedBoardItemId
  }

  if (!container) {
    return null
  }

  const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-board-item-id]'))
  if (nodes.length === 0) {
    return null
  }

  const containerRect = container.getBoundingClientRect()
  const viewportCenter = containerRect.top + container.clientHeight / 2

  const nearest = nodes
    .map((node) => {
      const rect = node.getBoundingClientRect()
      const rowCenter = rect.top + rect.height / 2
      return {
        id: node.dataset.boardItemId ?? null,
        distance: Math.abs(rowCenter - viewportCenter),
      }
    })
    .filter((entry): entry is { id: string; distance: number } => Boolean(entry.id))
    .sort((left, right) => left.distance - right.distance)[0]

  return nearest?.id ?? null
}
