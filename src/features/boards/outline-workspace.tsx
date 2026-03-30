import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  PointerEventHandler,
  ReactNode,
  RefObject,
  SetStateAction,
} from 'react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
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
  Plus as PlusIcon,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Layers3,
  LayoutPanelTop,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightOpen,
  Plus,
  X,
} from 'lucide-react'

import { SceneCard } from '@/components/cards/scene-card'
import { Badge } from '@/components/ui/badge'
import { BoardManagerDialog } from '@/components/board-selector/board-manager-dialog'
import { BoardSelectorDropdown } from '@/components/board-selector/board-selector-dropdown'
import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { InlineEditActions, InlineEditScope, InlineNameEditor, InlineTextareaEditor } from '@/components/ui/inline-name-editor'
import { KeyRatingButton } from '@/components/ui/key-rating-button'
import { Panel } from '@/components/ui/panel'
import { SceneReorderGap } from '@/components/ui/scene-reorder-gap'
import { SceneBankView } from '@/features/scenes/scene-bank-view'
import { usePersistedStringArray } from '@/hooks/use-persisted-string-array'
import { usePersistedNumber } from '@/hooks/use-persisted-number'
import { usePanelResize } from '@/hooks/use-panel-resize'
import { cn } from '@/lib/cn'
import { boardBlockKinds, sceneColors } from '@/lib/constants'
import { formatDuration } from '@/lib/durations'
import { readSceneDragData } from '@/lib/scene-drag'
import type { BlockTemplate, Board, BoardFolder, BoardItem, BoardTextItemKind, BoardViewMode } from '@/types/board'
import { isSceneBoardItem } from '@/types/board'
import type { Scene, SceneBeat, SceneBeatUpdateInput, SceneFolder } from '@/types/scene'
import type { Tag } from '@/types/tag'
import type { SceneDensity } from '@/types/view'

type Props = {
  board: Board
  allBoards: Board[]
  boardFolders: BoardFolder[]
  scenes: Scene[]
  sceneFolders: SceneFolder[]
  blockTemplates: BlockTemplate[]
  filteredSceneIds: string[]
  tags: Tag[]
  density: SceneDensity
  viewMode: BoardViewMode
  availableBlockKinds: BoardTextItemKind[]
  immersive?: boolean
  defaultBankCollapsed?: boolean
  onToggleImmersive?(): void
  onChangeViewMode(mode: BoardViewMode): void
  onSelectBoard(boardId: string): void
  onOpenBoardInspector(boardId: string): void
  onInlineUpdateBoard(boardId: string, input: { name: string }): void
  onDuplicateBoard(boardId: string): void
  onCreateBoard(folder?: string | null): void
  onCreateBoardFolder(name: string, parentPath?: string | null): void
  onUpdateBoardFolder(currentPath: string, input: { name?: string; color?: BoardFolder['color']; parentPath?: string | null }): void
  onDeleteBoardFolder(currentPath: string): void
  onDeleteBoard(boardId: string): void
  onMoveBoard(boardId: string, folder: string, beforeBoardId?: string | null): void
  onReorderBoards(boardIds: string[]): void
  selectedSceneId: string | null
  selectedSceneIds: string[]
  selectedBoardItemId: string | null
  onSelect(sceneId: string | null, boardItemId?: string): void
  onOpenInspector(sceneId: string | null, boardItemId?: string): void
  onCreateScene(): void
  onToggleSceneSelection(sceneId: string): void
  onSetSceneSelection(sceneIds: string[]): void
  onClearSceneSelection(): void
  onCreateSceneFolder(name: string, parentPath?: string | null): void
  onUpdateSceneFolder(currentPath: string, input: { name?: string; color?: SceneFolder['color']; parentPath?: string | null }): void
  onDeleteSceneFolder(currentPath: string): void
  onMoveScenesToFolder(sceneIds: string[], folder: string): void
  onToggleKeyScene(scene: Scene): void
  onDuplicateScene(sceneId: string, afterItemId?: string | null): void
  onDeleteScene(sceneId: string): void
  onDeleteSelectedScenes(): void
  onAddScene(sceneId: string, afterItemId?: string | null, boardPosition?: { x: number; y: number } | null): void
  onAddBlock(kind: BoardTextItemKind, afterItemId?: string | null): void
  onAddTemplate(templateId: string, afterItemId?: string | null): void
  onSaveTemplate(input: { kind: BoardTextItemKind; name: string; title: string; body: string }): void
  onDeleteTemplate(templateId: string): void
  onCopyBlockToBoard(itemId: string, boardId: string): void
  onDuplicateBlock(itemId: string): void
  onRemoveBoardItem(itemId: string): void
  onReorder(itemIds: string[]): void
  onUpdateItemPosition(itemId: string, boardX: number, boardY: number): void
  onInlineUpdateScene(sceneId: string, input: { title: string; synopsis: string }): void
  onInlineUpdateBlock(itemId: string, input: { title: string; body: string }): void
  onCreateBeat(sceneId: string, afterBeatId?: string | null): void
  onUpdateBeat(input: SceneBeatUpdateInput): void
  onDeleteBeat(beatId: string): void
  onReorderBeats(sceneId: string, beatIds: string[]): void
}

type DragPayload =
  | { kind: 'scene'; sceneId: string }
  | { kind: 'board-item'; itemId: string }
  | null

type BoardCanvasHandle = {
  resolveDropPosition(clientX: number, clientY: number): { x: number; y: number } | null
  revealItem(itemId: string): void
}

export function OutlineWorkspace({
  board,
  allBoards,
  boardFolders,
  scenes,
  sceneFolders,
  blockTemplates,
  filteredSceneIds,
  tags,
  density,
  viewMode,
  availableBlockKinds,
  immersive = false,
  defaultBankCollapsed = false,
  onToggleImmersive,
  onChangeViewMode,
  onSelectBoard,
  onOpenBoardInspector,
  onInlineUpdateBoard,
  onDuplicateBoard,
  onCreateBoard,
  onCreateBoardFolder,
  onUpdateBoardFolder,
  onDeleteBoardFolder,
  onDeleteBoard,
  onMoveBoard,
  onReorderBoards,
  selectedSceneId,
  selectedSceneIds,
  selectedBoardItemId,
  onSelect,
  onOpenInspector,
  onCreateScene,
  onToggleSceneSelection,
  onSetSceneSelection,
  onClearSceneSelection,
  onCreateSceneFolder,
  onUpdateSceneFolder,
  onDeleteSceneFolder,
  onMoveScenesToFolder,
  onToggleKeyScene,
  onDuplicateScene,
  onDeleteScene,
  onDeleteSelectedScenes,
  onAddScene,
  onAddBlock,
  onAddTemplate,
  onSaveTemplate,
  onDeleteTemplate,
  onCopyBlockToBoard,
  onDuplicateBlock,
  onRemoveBoardItem,
  onReorder,
  onUpdateItemPosition,
  onInlineUpdateScene,
  onInlineUpdateBlock,
  onCreateBeat,
  onUpdateBeat,
  onDeleteBeat,
  onReorderBeats,
}: Props) {
  const [activeDrag, setActiveDrag] = useState<DragPayload>(null)
  const [dragOverlayOffset, setDragOverlayOffset] = useState<{ x: number; y: number } | null>(null)
  const [menuState, setMenuState] = useState<{ itemId: string; x: number; y: number } | null>(null)
  const [copyMenuState, setCopyMenuState] = useState<{ itemId: string; x: number; y: number } | null>(null)
  const [bankCollapsed, setBankCollapsed] = useState(defaultBankCollapsed)
  const [boardSelectorOpen, setBoardSelectorOpen] = useState(false)
  const [boardManagerOpen, setBoardManagerOpen] = useState(false)
  const boardSelectorButtonRef = useRef<HTMLButtonElement>(null)
  const [nativeSceneDropActive, setNativeSceneDropActive] = useState(false)
  const [nativeSceneInsertAfterId, setNativeSceneInsertAfterId] = useState<string | null>(null)
  const [nativeDraggedSceneCount, setNativeDraggedSceneCount] = useState(0)
  const [sceneDragDropActive, setSceneDragDropActive] = useState(false)
  const [sceneDragInsertAfterId, setSceneDragInsertAfterId] = useState<string | null>(null)
  const outlineScrollRef = useRef<HTMLDivElement | null>(null)
  const boardCanvasHandleRef = useRef<BoardCanvasHandle | null>(null)
  const bankResize = usePanelResize({ initial: 320, min: 240, max: 520 })
  const [expandedSceneIds, setExpandedSceneIds] = usePersistedStringArray('narralab:outline:expanded-scenes')
  const filteredSceneIdSet = useMemo(() => new Set(filteredSceneIds), [filteredSceneIds])
  const bankScenes = scenes.filter((scene) => filteredSceneIdSet.has(scene.id))
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
  const activeSceneOverlay = useMemo(
    () => (activeDrag?.kind === 'scene' ? (activeOverlay as Scene | null) : null),
    [activeDrag?.kind, activeOverlay],
  )
  const overlayModifiers = useMemo<Modifier[]>(
    () =>
      dragOverlayOffset
        ? [
            ({ transform }) => ({
              ...transform,
              x: transform.x - dragOverlayOffset.x + 28,
              y: transform.y - dragOverlayOffset.y + 18,
            }),
          ]
        : [],
    [dragOverlayOffset],
  )
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

  useEffect(() => {
    if (!selectedBoardItemId) {
      return
    }

    const container = outlineScrollRef.current
    if (viewMode !== 'canvas') {
      const item = container?.querySelector<HTMLElement>(`[data-board-item-id="${selectedBoardItemId}"]`)
      item?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    } else {
      boardCanvasHandleRef.current?.revealItem(selectedBoardItemId)
    }
  }, [selectedBoardItemId, viewMode])

  const outlineContent = (
    <>
      <div className={cn('flex h-full min-h-0 min-w-0 overflow-hidden', immersive ? '' : 'gap-4')}>
        {!immersive && bankCollapsed ? (
          <CollapsedWorkspaceRail title="Scene Bank" onExpand={() => setBankCollapsed(false)} />
        ) : !immersive ? (
        <div className="min-h-0 shrink-0" style={{ width: bankResize.size }}>
          <DropPanel
            id="bank-dropzone"
            title="Scene Bank"
            description="Drag scenes into the outline"
            bodyClassName="overflow-hidden"
            headingAction={
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBankCollapsed(true)}
                title="Collapse scene bank"
                aria-label="Collapse scene bank"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            }
          >
            <SceneBankView
              embedded
              scenes={bankScenes}
              folders={sceneFolders}
              tags={tags}
              board={board}
              density={density}
              selectedSceneId={selectedSceneId}
              selectedSceneIds={selectedSceneIds}
              onSelect={(sceneId) => onSelect(sceneId)}
              onToggleSelection={onToggleSceneSelection}
              onSelectAllVisible={onSetSceneSelection}
              onClearSelection={onClearSceneSelection}
              onOpenInspector={(sceneId) => onOpenInspector(sceneId)}
              onInlineUpdateScene={onInlineUpdateScene}
              onToggleKeyScene={onToggleKeyScene}
              onCreateScene={onCreateScene}
              onCreateFolder={onCreateSceneFolder}
              onUpdateFolder={onUpdateSceneFolder}
              onDeleteFolder={onDeleteSceneFolder}
              onMoveToFolder={onMoveScenesToFolder}
              onDuplicate={(sceneId) => onDuplicateScene(sceneId)}
              onDelete={onDeleteScene}
              onDeleteSelected={onDeleteSelectedScenes}
              onAdd={(sceneId, afterItemId) =>
                onAddScene(
                  sceneId,
                  afterItemId ?? resolveInsertAfterItemId(outlineScrollRef.current, selectedBoardItemId),
                )
              }
            />
          </DropPanel>
        </div>
        ) : null}

        {!immersive && !bankCollapsed ? (
          <ResizeHandle
            label="Resize scene bank"
            active={bankResize.isResizing}
            onPointerDown={bankResize.startResize(1)}
          />
        ) : null}

        <div className="min-h-0 min-w-0 flex-1">
          <DropPanel
            id="board-dropzone"
            title={board.name}
            description={`${board.items.length} rows · ${formatDuration(totalDuration)}`}
            panelClassName={immersive ? 'overflow-hidden border-0 rounded-none bg-transparent shadow-none' : undefined}
            hideHeader={immersive}
            bodyClassName={cn(
              viewMode === 'outline' ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden',
              immersive ? 'p-0' : undefined,
            )}
            headingAction={
              <div className="flex shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="relative">
                  <Button
                    ref={boardSelectorButtonRef}
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setBoardSelectorOpen(!boardSelectorOpen)}
                  >
                    <Layers3 className="h-4 w-4" />
                    <span className="max-w-[120px] truncate">{board.name}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <BoardSelectorDropdown
                    boards={allBoards}
                    folders={boardFolders}
                    activeBoardId={board.id}
                    open={boardSelectorOpen}
                    buttonRef={boardSelectorButtonRef}
                    onClose={() => setBoardSelectorOpen(false)}
                    onSelectBoard={onSelectBoard}
                    onOpenManager={() => setBoardManagerOpen(true)}
                    onCreateBoard={onCreateBoard}
                  />
                </div>
                <AddBlockMenu
                  availableBlockKinds={availableBlockKinds}
                  templates={blockTemplates}
                  onAddBlock={onAddBlock}
                  onAddTemplate={onAddTemplate}
                  onDeleteTemplate={onDeleteTemplate}
                  getInsertAfterItemId={() => resolveInsertAfterItemId(outlineScrollRef.current, selectedBoardItemId)}
                />
                <ViewModeToggle value={viewMode} onChange={onChangeViewMode} />
              </div>
            }
            bodyRef={outlineScrollRef}
          >
            {immersive ? (
              <div className="pointer-events-none absolute right-5 top-5 z-20 flex items-center gap-2">
                <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-border/80 bg-panel/85 px-3 py-2 shadow-panel backdrop-blur">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    {viewMode === 'canvas' ? 'Canvas Focus' : 'Outline Focus'}
                  </span>
                  {onToggleImmersive ? (
                    <Button variant="ghost" size="sm" onClick={onToggleImmersive} title="Exit fullscreen focus" aria-label="Exit fullscreen focus">
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {viewMode === 'outline' ? (
              <SortableContext items={board.items.map((item) => `item:${item.id}`)} strategy={verticalListSortingStrategy}>
                <div
                  className={cn(
                    'relative min-h-full space-y-3 pb-8',
                    (nativeSceneDropActive || sceneDragDropActive) &&
                      'rounded-2xl border border-dashed border-accent/60 bg-accent/5 p-2',
                  )}
                  onDragOver={(event) => {
                    const sceneIds = getDraggedSceneIds(event.dataTransfer)
                    if (sceneIds.length === 0) {
                      return
                    }
                    event.preventDefault()
                    event.stopPropagation()
                    event.dataTransfer.dropEffect = 'copy'
                    setNativeSceneDropActive(true)
                    setNativeDraggedSceneCount(sceneIds.length)
                    setNativeSceneInsertAfterId(
                      resolveInsertAfterItemIdAtPoint(outlineScrollRef.current, event.clientY, selectedBoardItemId),
                    )
                  }}
                  onDragLeave={(event) => {
                    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      return
                    }
                    setNativeSceneDropActive(false)
                    setNativeSceneInsertAfterId(null)
                    setNativeDraggedSceneCount(0)
                  }}
                  onDrop={async (event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    const sceneIds = await resolveDraggedSceneIds(event.dataTransfer, true)
                    if (sceneIds.length === 0) {
                      return
                    }
                    const insertAfterItemId = resolveInsertAfterItemIdAtPoint(
                      outlineScrollRef.current,
                      event.clientY,
                      selectedBoardItemId,
                    )
                    const sceneId = sceneIds[0]
                    if (!sceneId) {
                      setNativeSceneDropActive(false)
                      setNativeSceneInsertAfterId(null)
                      setNativeDraggedSceneCount(0)
                      return
                    }
                    await onAddScene(sceneId, insertAfterItemId)
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                        setNativeSceneDropActive(false)
                        setNativeSceneInsertAfterId(null)
                        setNativeDraggedSceneCount(0)
                      })
                    })
                  }}
                >
                  {nativeSceneDropActive || sceneDragDropActive ? (
                    (nativeSceneDropActive ? nativeSceneInsertAfterId : sceneDragInsertAfterId) === null ? (
                      <SceneReorderGap variant="outline" density={density} count={nativeDraggedSceneCount} />
                    ) : null
                  ) : null}
                  {board.items.map((item, index) => {
                    const scene = isSceneBoardItem(item) ? scenes.find((entry) => entry.id === item.sceneId) ?? null : null
                    const itemTags = scene ? tags.filter((tag) => scene.tagIds.includes(tag.id)) : []
                    const activeInsertAfterId = nativeSceneDropActive ? nativeSceneInsertAfterId : sceneDragInsertAfterId
                    const showInsertAfter = (nativeSceneDropActive || sceneDragDropActive) && activeInsertAfterId === item.id

                    return (
                      <div key={item.id} className="space-y-3">
                        <BoardSortableItem
                          item={item}
                          index={index}
                          scene={scene}
                          tags={itemTags}
                          density={density}
                          muted={isSceneBoardItem(item) ? !filteredSceneIdSet.has(item.sceneId) : false}
                          selected={selectedBoardItemId === item.id}
                          onClick={() => onSelect(isSceneBoardItem(item) ? item.sceneId : null, item.id)}
                          onDoubleClick={() => onOpenInspector(isSceneBoardItem(item) ? item.sceneId : null, item.id)}
                          onToggleKeyScene={() => {
                            if (scene) onToggleKeyScene(scene)
                          }}
                          beatsExpanded={scene ? expandedSceneIds.includes(scene.id) : false}
                          onToggleBeats={() => {
                            if (!scene) return
                            setExpandedSceneIds((current) =>
                              current.includes(scene.id)
                                ? current.filter((id) => id !== scene.id)
                                : [...current, scene.id],
                            )
                          }}
                          onCreateBeat={onCreateBeat}
                          onUpdateBeat={onUpdateBeat}
                          onDeleteBeat={onDeleteBeat}
                          onInlineUpdateScene={onInlineUpdateScene}
                          onInlineUpdateBlock={onInlineUpdateBlock}
                          onRemove={() => onRemoveBoardItem(item.id)}
                          onContextMenu={(event) => {
                            event.preventDefault()
                            onSelect(isSceneBoardItem(item) ? item.sceneId : null, item.id)
                            setMenuState({ itemId: item.id, x: event.clientX, y: event.clientY })
                          }}
                        />
                        {showInsertAfter ? (
                          <SceneReorderGap variant="outline" density={density} count={nativeDraggedSceneCount} />
                        ) : null}
                      </div>
                    )
                  })}
                  {board.items.length === 0 && (nativeSceneDropActive || sceneDragDropActive) ? (
                    <div className="flex min-h-[220px] items-center justify-center">
                      <div className="w-full max-w-md rounded-2xl border border-dashed border-accent/40 bg-accent/5 px-4 py-8 text-center text-sm text-muted">
                        Drop scene here
                      </div>
                    </div>
                  ) : null}
                </div>
              </SortableContext>
            ) : (
              <BoardCanvasView
                board={board}
                scenes={scenes}
                tags={tags}
                filteredSceneIdSet={filteredSceneIdSet}
                selectedBoardItemId={selectedBoardItemId}
                immersive={immersive}
                nativeSceneDropActive={nativeSceneDropActive}
                onNativeSceneDragStateChange={setNativeSceneDropActive}
                canvasHandleRef={boardCanvasHandleRef}
                onSelect={onSelect}
                onOpenInspector={onOpenInspector}
                onToggleKeyScene={onToggleKeyScene}
                onUpdatePosition={onUpdateItemPosition}
                onNativeSceneDrop={(sceneIds, boardPosition) => {
                  setNativeSceneDropActive(false)
                  const sceneId = sceneIds[0]
                  if (!sceneId) {
                    return
                  }
                  onAddScene(sceneId, null, boardPosition)
                }}
                onInlineUpdateScene={onInlineUpdateScene}
                onInlineUpdateBlock={onInlineUpdateBlock}
                onContextMenu={(item, event) => {
                  event.preventDefault()
                  onSelect(isSceneBoardItem(item) ? item.sceneId : null, item.id)
                  setMenuState({ itemId: item.id, x: event.clientX, y: event.clientY })
                }}
              />
            )}
          </DropPanel>
        </div>
      </div>

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
    </>
  )

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragStart={(event) => handleDragStart(event, setActiveDrag, setDragOverlayOffset)}
      onDragOver={(event) => {
        const activeId = String(event.active.id)
        if (!activeId.startsWith('scene:') || viewMode !== 'outline') {
          setSceneDragDropActive(false)
          setSceneDragInsertAfterId(null)
          return
        }

        const overId = event.over ? String(event.over.id) : null
        if (!overId || (overId !== 'board-dropzone' && !overId.startsWith('item:'))) {
          setSceneDragDropActive(false)
          setSceneDragInsertAfterId(null)
          return
        }

        setSceneDragDropActive(true)

        if (overId.startsWith('item:')) {
          setSceneDragInsertAfterId(overId.replace('item:', ''))
          return
        }

        const translatedRect = event.active.rect.current.translated ?? event.active.rect.current.initial
        const centerY = translatedRect ? translatedRect.top + translatedRect.height / 2 : null
        setSceneDragInsertAfterId(
          centerY === null
            ? null
            : resolveInsertAfterItemIdAtPoint(outlineScrollRef.current, centerY, selectedBoardItemId),
        )
      }}
      onDragEnd={(event) =>
        handleDragEnd(event, {
          board,
          scenes,
          boardCanvasHandleRef,
          viewMode,
          outlineScrollRef,
          selectedBoardItemId,
          sceneDragInsertAfterId,
          onAddScene,
          onReorderBeats,
          onRemoveBoardItem,
          onReorder,
          setActiveDrag,
          setDragOverlayOffset,
          setSceneDragDropActive,
          setSceneDragInsertAfterId,
        })
      }
      onDragCancel={() => {
        setActiveDrag(null)
        setDragOverlayOffset(null)
        setSceneDragDropActive(false)
        setSceneDragInsertAfterId(null)
      }}
    >
      {outlineContent}
      {typeof document !== 'undefined'
        ? createPortal(
            <DragOverlay dropAnimation={null} modifiers={overlayModifiers} zIndex={1000}>
              {activeOverlay ? (
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
              ) : null}
            </DragOverlay>,
            document.body,
          )
        : null}
      <BoardManagerDialog
        boards={allBoards}
        folders={boardFolders}
        activeBoardId={board.id}
        open={boardManagerOpen}
        onClose={() => setBoardManagerOpen(false)}
        onSelectBoard={onSelectBoard}
        onOpenBoardInspector={onOpenBoardInspector}
        onInlineUpdateBoard={onInlineUpdateBoard}
        onDuplicateBoard={onDuplicateBoard}
        onCreateBoard={onCreateBoard}
        onCreateFolder={onCreateBoardFolder}
        onUpdateFolder={onUpdateBoardFolder}
        onDeleteFolder={onDeleteBoardFolder}
        onDeleteBoard={onDeleteBoard}
        onMoveBoard={onMoveBoard}
        onReorderBoards={onReorderBoards}
      />
    </DndContext>
  )
}

function handleDragStart(
  event: DragStartEvent,
  setActiveDrag: Dispatch<SetStateAction<DragPayload>>,
  setDragOverlayOffset: Dispatch<SetStateAction<{ x: number; y: number } | null>>,
) {
  const id = String(event.active.id)
  const initialRect = event.active.rect.current.initial
  const activator = event.activatorEvent
  if (
    initialRect &&
    activator &&
    'clientX' in activator &&
    'clientY' in activator &&
    typeof activator.clientX === 'number' &&
    typeof activator.clientY === 'number'
  ) {
    setDragOverlayOffset({
      x: activator.clientX - initialRect.left,
      y: activator.clientY - initialRect.top,
    })
  } else {
    setDragOverlayOffset(null)
  }
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
    scenes,
    boardCanvasHandleRef,
    viewMode,
    outlineScrollRef,
    selectedBoardItemId,
    sceneDragInsertAfterId,
    onAddScene,
    onReorderBeats,
    onRemoveBoardItem,
    onReorder,
    setActiveDrag,
    setDragOverlayOffset,
    setSceneDragDropActive,
    setSceneDragInsertAfterId,
  }: {
    board: Board
    scenes: Scene[]
    boardCanvasHandleRef: RefObject<BoardCanvasHandle | null>
    viewMode: BoardViewMode
    outlineScrollRef: RefObject<HTMLDivElement | null>
    selectedBoardItemId: string | null
    sceneDragInsertAfterId: string | null
    onAddScene(sceneId: string, afterItemId?: string | null, boardPosition?: { x: number; y: number } | null): void
    onReorderBeats(sceneId: string, beatIds: string[]): void
    onRemoveBoardItem(itemId: string): void
    onReorder(itemIds: string[]): void
    setActiveDrag: Dispatch<SetStateAction<DragPayload>>
    setDragOverlayOffset: Dispatch<SetStateAction<{ x: number; y: number } | null>>
    setSceneDragDropActive: Dispatch<SetStateAction<boolean>>
    setSceneDragInsertAfterId: Dispatch<SetStateAction<string | null>>
  },
) {
  const activeId = String(event.active.id)
  const overId = event.over ? String(event.over.id) : null

  const resetDragUi = () => {
    setActiveDrag(null)
    setDragOverlayOffset(null)
    setSceneDragDropActive(false)
    setSceneDragInsertAfterId(null)
  }

  if (!overId) {
    resetDragUi()
    return
  }

  if (activeId.startsWith('scene:') && (overId === 'board-dropzone' || overId.startsWith('item:'))) {
    const sceneId = activeId.replace('scene:', '')
    const dropRect = event.active.rect.current.translated ?? event.active.rect.current.initial
    const dropCenterX = dropRect ? dropRect.left + dropRect.width / 2 : null
    const dropCenterY = dropRect ? dropRect.top + dropRect.height / 2 : null
    const dropPosition =
      viewMode === 'canvas' && overId === 'board-dropzone' && dropCenterX !== null && dropCenterY !== null
        ? boardCanvasHandleRef.current?.resolveDropPosition(dropCenterX, dropCenterY) ?? null
        : null

    const insertAfterItemId =
      viewMode === 'outline'
        ? overId.startsWith('item:')
          ? overId.replace('item:', '')
          : sceneDragInsertAfterId ??
            resolveInsertAfterItemIdAtPoint(outlineScrollRef.current, dropCenterY ?? 0, selectedBoardItemId)
        : overId.startsWith('item:')
          ? overId.replace('item:', '')
          : null

    onAddScene(sceneId, insertAfterItemId, dropPosition)
    resetDragUi()
    return
  }

  if (activeId.startsWith('beat:') && overId.startsWith('beat:')) {
    const activeBeat = parseBeatDragId(activeId)
    const overBeat = parseBeatDragId(overId)

    if (activeBeat && overBeat && activeBeat.sceneId === overBeat.sceneId && activeBeat.beatId !== overBeat.beatId) {
      const scene = scenes.find((entry) => entry.id === activeBeat.sceneId)
      if (scene) {
        const currentIds = scene.beats.map((beat) => beat.id)
        const fromIndex = currentIds.indexOf(activeBeat.beatId)
        const toIndex = currentIds.indexOf(overBeat.beatId)
        if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
          onReorderBeats(activeBeat.sceneId, arrayMove(currentIds, fromIndex, toIndex))
        }
      }
    }
    resetDragUi()
    return
  }

  if (activeId.startsWith('item:') && overId === 'bank-dropzone') {
    onRemoveBoardItem(activeId.replace('item:', ''))
    resetDragUi()
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

  resetDragUi()
}

function DropPanel({
  id,
  title,
  description,
  children,
  leadingAction,
  headingAction,
  bodyRef,
  bodyClassName,
  hideHeader = false,
  panelClassName,
}: {
  id: string
  title: string
  description: string
  children: ReactNode
  leadingAction?: ReactNode
  headingAction?: ReactNode
  bodyRef?: RefObject<HTMLDivElement | null>
  bodyClassName?: string
  hideHeader?: boolean
  panelClassName?: string
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <Panel
      ref={setNodeRef}
      className={cn(
        'flex h-full flex-col',
        isOver && 'border-accent/60 bg-accent/5',
        panelClassName,
      )}
    >
      {!hideHeader ? (
        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border/90 px-4 py-4">
          <div className="flex min-w-0 items-start gap-2">
            {leadingAction ? <div className="shrink-0">{leadingAction}</div> : null}
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
              <LayoutPanelTop className="h-4 w-4 text-accent" />
              <span className="truncate">{title}</span>
              </div>
              <div className="mt-1 truncate text-sm text-muted">{description}</div>
            </div>
          </div>
          {headingAction}
        </div>
      ) : null}
      <div
        ref={bodyRef}
        className={cn('min-h-0 flex-1 p-4', bodyClassName ?? 'overflow-y-auto overscroll-contain')}
      >
        {children}
      </div>
    </Panel>
  )
}

function CollapsedWorkspaceRail({
  title,
  onExpand,
}: {
  title: string
  onExpand(): void
}) {
  return (
    <div className="flex h-full shrink-0 items-stretch">
      <button
        type="button"
        className="flex h-full w-14 flex-col items-center justify-start gap-3 rounded-2xl border border-border/90 bg-panel px-2 py-4 text-muted transition hover:bg-panelMuted hover:text-foreground"
        onClick={onExpand}
        title={`Open ${title}`}
        aria-label={`Open ${title}`}
      >
        <PanelLeftOpen className="h-4 w-4" />
        <span className="rotate-180 text-[10px] font-semibold uppercase tracking-[0.18em] [writing-mode:vertical-rl]">
          {title}
        </span>
      </button>
    </div>
  )
}

function AddBlockMenu({
  availableBlockKinds,
  templates,
  onAddBlock,
  onAddTemplate,
  onDeleteTemplate,
  getInsertAfterItemId,
}: {
  availableBlockKinds: BoardTextItemKind[]
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
          {boardBlockKinds.filter((kind) => availableBlockKinds.includes(kind.value)).map((kind) => (
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

function ViewModeToggle({
  value,
  onChange,
}: {
  value: BoardViewMode
  onChange(mode: BoardViewMode): void
}) {
  const options: Array<{ value: BoardViewMode; label: string }> = [
    { value: 'outline', label: 'Outline' },
    { value: 'canvas', label: 'Canvas' },
  ]

  return (
    <div className="inline-flex rounded-xl border border-border/90 bg-panelMuted/50 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cn(
            'rounded-lg px-2.5 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted transition',
            value === option.value && 'bg-accent text-accent-foreground',
          )}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function BoardCanvasView({
  board,
  scenes,
  tags,
  filteredSceneIdSet,
  selectedBoardItemId,
  immersive = false,
  nativeSceneDropActive = false,
  onNativeSceneDragStateChange,
  canvasHandleRef,
  onSelect,
  onOpenInspector,
  onToggleKeyScene,
  onUpdatePosition,
  onNativeSceneDrop,
  onInlineUpdateScene,
  onInlineUpdateBlock,
  onContextMenu,
}: {
  board: Board
  scenes: Scene[]
  tags: Tag[]
  filteredSceneIdSet: Set<string>
  selectedBoardItemId: string | null
  immersive?: boolean
  nativeSceneDropActive?: boolean
  onNativeSceneDragStateChange?(active: boolean): void
  canvasHandleRef?: RefObject<BoardCanvasHandle | null>
  onSelect(sceneId: string | null, boardItemId?: string): void
  onOpenInspector(sceneId: string | null, boardItemId?: string): void
  onToggleKeyScene(scene: Scene): void
  onUpdatePosition(itemId: string, boardX: number, boardY: number): void
  onNativeSceneDrop(sceneIds: string[], boardPosition: { x: number; y: number } | null): void
  onInlineUpdateScene(sceneId: string, input: { title: string; synopsis: string }): void
  onInlineUpdateBlock(itemId: string, input: { title: string; body: string }): void
  onContextMenu(item: BoardItem, event: ReactMouseEvent<HTMLDivElement>): void
}) {
  const [zoom, setZoom] = usePersistedNumber(`narralab:board-zoom:${board.id}`, 1)
  const [spacePressed, setSpacePressed] = useState(false)
  const [panning, setPanning] = useState(false)
  const [multiSelectedItemIds, setMultiSelectedItemIds] = useState<string[]>([])
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [groupPreview, setGroupPreview] = useState<Record<string, { x: number; y: number }> | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const groupPreviewRef = useRef<Record<string, { x: number; y: number }> | null>(null)
  const groupSettlingTimerRef = useRef<number | null>(null)
  const spacePressedRef = useRef(false)
  const panRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null)
  const marqueeRef = useRef<{ startX: number; startY: number } | null>(null)
  const suppressBackgroundClickRef = useRef(false)
  const groupDragRef = useRef<{
    startX: number
    startY: number
    origins: Record<string, { x: number; y: number }>
  } | null>(null)
  const previousImmersiveRef = useRef(immersive)
  const canvasWidth = 1800
  const canvasHeight = 1400

  const selectedItemIds = useMemo(
    () =>
      multiSelectedItemIds.length > 1
        ? multiSelectedItemIds
        : selectedBoardItemId
          ? [selectedBoardItemId]
          : multiSelectedItemIds,
    [multiSelectedItemIds, selectedBoardItemId],
  )

  const autoArrange = useCallback(
    (layout: 'row' | 'stack' | 'grid') => {
      const gapX = 36
      const gapY = 28
      const baseX = 48
      const baseY = 72
      const columns = Math.max(2, Math.min(4, Math.ceil(Math.sqrt(board.items.length || 1))))

      board.items.forEach((item, index) => {
        if (layout === 'row') {
          onUpdatePosition(item.id, baseX + index * (item.boardW + gapX), baseY)
          return
        }

        if (layout === 'stack') {
          onUpdatePosition(item.id, baseX, baseY + index * (item.boardH + gapY))
          return
        }

        const column = index % columns
        const row = Math.floor(index / columns)
        onUpdatePosition(
          item.id,
          baseX + column * (item.boardW + gapX),
          baseY + row * (item.boardH + gapY),
        )
      })
    },
    [board.items, onUpdatePosition],
  )

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const container = scrollRef.current
    if (!container) {
      return { x: 0, y: 0 }
    }

    const rect = container.getBoundingClientRect()
    return {
      x: (container.scrollLeft + clientX - rect.left) / zoom,
      y: (container.scrollTop + clientY - rect.top) / zoom,
    }
  }, [zoom])

  useEffect(() => {
    if (!canvasHandleRef) {
      return
    }

    canvasHandleRef.current = {
      resolveDropPosition(clientX, clientY) {
        const point = clientToWorld(clientX, clientY)
        return {
          x: Math.max(24, point.x - 150),
          y: Math.max(24, point.y - 66),
        }
      },
      revealItem(itemId) {
        const container = scrollRef.current
        const item = board.items.find((entry) => entry.id === itemId)
        if (!container || !item) {
          return
        }

        const itemLeft = item.boardX * zoom
        const itemTop = item.boardY * zoom
        const itemWidth = item.boardW * zoom
        const itemHeight = item.boardH * zoom
        const viewportLeft = container.scrollLeft
        const viewportTop = container.scrollTop
        const viewportRight = viewportLeft + container.clientWidth
        const viewportBottom = viewportTop + container.clientHeight

        const isVisible =
          itemLeft >= viewportLeft &&
          itemTop >= viewportTop &&
          itemLeft + itemWidth <= viewportRight &&
          itemTop + itemHeight <= viewportBottom

        if (!isVisible) {
          const targetLeft = Math.max(0, item.boardX * zoom - container.clientWidth / 2 + item.boardW * zoom / 2)
          const targetTop = Math.max(0, item.boardY * zoom - container.clientHeight / 2 + item.boardH * zoom / 2)
          container.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' })
        }
      },
    }

    return () => {
      if (canvasHandleRef.current) {
        canvasHandleRef.current = null
      }
    }
  }, [board.items, canvasHandleRef, clientToWorld, zoom])

  const applyZoom = useCallback((nextZoom: number, focus?: { clientX: number; clientY: number }) => {
    const clampedZoom = clampZoom(nextZoom)
    const container = scrollRef.current

    if (!container || !focus) {
      setZoom(clampedZoom)
      return
    }

    const rect = container.getBoundingClientRect()
    const pointerX = focus.clientX - rect.left
    const pointerY = focus.clientY - rect.top
    const worldX = (container.scrollLeft + pointerX) / zoom
    const worldY = (container.scrollTop + pointerY) / zoom

    setZoom(clampedZoom)

    requestAnimationFrame(() => {
      const currentContainer = scrollRef.current
      if (!currentContainer) return
      currentContainer.scrollLeft = worldX * clampedZoom - pointerX
      currentContainer.scrollTop = worldY * clampedZoom - pointerY
    })
  }, [setZoom, zoom])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) {
      return
    }

    const onWheel = (event: WheelEvent) => {
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault()
        event.stopPropagation()
        const delta = event.deltaY > 0 ? -0.1 : 0.1
        applyZoom(zoom + delta, { clientX: event.clientX, clientY: event.clientY })
        return
      }

      event.preventDefault()
      event.stopPropagation()

      if (event.altKey) {
        const horizontalDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
        container.scrollLeft += horizontalDelta
        return
      }

      container.scrollTop += event.deltaY
    }

    container.addEventListener('wheel', onWheel, { passive: false })
    return () => container.removeEventListener('wheel', onWheel)
  }, [applyZoom, zoom])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== 'Space' ||
        event.repeat ||
        isEditableTarget(event.target) ||
        isEditableTarget(document.activeElement) ||
        isInlineEditorActive()
      ) {
        return
      }
      event.preventDefault()
      spacePressedRef.current = true
      setSpacePressed(true)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') {
        return
      }
      spacePressedRef.current = false
      setSpacePressed(false)
      setPanning(false)
      panRef.current = null
    }

    const onBlur = () => {
      spacePressedRef.current = false
      setSpacePressed(false)
      setPanning(false)
      panRef.current = null
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useEffect(() => {
    groupPreviewRef.current = groupPreview
  }, [groupPreview])

  useEffect(() => {
    return () => {
      if (groupSettlingTimerRef.current) {
        window.clearTimeout(groupSettlingTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const container = scrollRef.current
      if (container && panRef.current) {
        container.scrollLeft = panRef.current.scrollLeft - (event.clientX - panRef.current.startX)
        container.scrollTop = panRef.current.scrollTop - (event.clientY - panRef.current.startY)
        return
      }

      if (groupDragRef.current) {
        const deltaX = (event.clientX - groupDragRef.current.startX) / zoom
        const deltaY = (event.clientY - groupDragRef.current.startY) / zoom
        const nextPreview = Object.fromEntries(
          Object.entries(groupDragRef.current.origins).map(([itemId, origin]) => [
            itemId,
            {
              x: Math.max(24, origin.x + deltaX),
              y: Math.max(24, origin.y + deltaY),
            },
          ]),
        )
        groupPreviewRef.current = nextPreview
        setGroupPreview(nextPreview)
        return
      }

      if (marqueeRef.current) {
        const current = clientToWorld(event.clientX, event.clientY)
        const rect = normalizeSelectionRect(marqueeRef.current.startX, marqueeRef.current.startY, current.x, current.y)
        setSelectionRect(rect)
        const nextIds = board.items
          .filter((item) => rectanglesIntersect(rect, { x: item.boardX, y: item.boardY, width: item.boardW, height: item.boardH }))
          .map((item) => item.id)
        setMultiSelectedItemIds(nextIds)
      }
    }

    const onPointerUp = () => {
      panRef.current = null
      setPanning(false)

      if (groupDragRef.current && groupPreviewRef.current) {
        const finalPreview = groupPreviewRef.current
        Object.entries(finalPreview).forEach(([itemId, position]) => {
          onUpdatePosition(itemId, position.x, position.y)
        })
        groupDragRef.current = null
        if (groupSettlingTimerRef.current) {
          window.clearTimeout(groupSettlingTimerRef.current)
        }
        groupSettlingTimerRef.current = window.setTimeout(() => {
          groupPreviewRef.current = null
          setGroupPreview(null)
          groupSettlingTimerRef.current = null
        }, 220)
        return
      }

      if (marqueeRef.current) {
        marqueeRef.current = null
        setSelectionRect(null)
        suppressBackgroundClickRef.current = true
        window.setTimeout(() => {
          suppressBackgroundClickRef.current = false
        }, 0)
        if (selectedItemIds.length === 1) {
          const selectedItem = board.items.find((item) => item.id === selectedItemIds[0]) ?? null
          onSelect(selectedItem && isSceneBoardItem(selectedItem) ? selectedItem.sceneId : null, selectedItem?.id)
        }
      }
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [board.items, clientToWorld, onSelect, onUpdatePosition, selectedItemIds, zoom])

  const startGroupDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, itemId: string) => {
      if (!selectedItemIds.includes(itemId) || selectedItemIds.length < 2 || spacePressedRef.current) {
        return false
      }

      event.preventDefault()
      event.stopPropagation()

      const origins = Object.fromEntries(
        board.items
          .filter((item) => selectedItemIds.includes(item.id))
          .map((item) => [item.id, { x: item.boardX, y: item.boardY }]),
      )

      groupDragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        origins,
      }
      if (groupSettlingTimerRef.current) {
        window.clearTimeout(groupSettlingTimerRef.current)
        groupSettlingTimerRef.current = null
      }
      groupPreviewRef.current = origins
      setGroupPreview(origins)
      return true
    },
    [board.items, selectedItemIds],
  )

  useEffect(() => {
    const wasImmersive = previousImmersiveRef.current
    previousImmersiveRef.current = immersive

    if (!immersive || wasImmersive) {
      return
    }

    const container = scrollRef.current
    if (!container) {
      return
    }

    const itemsWithBounds = board.items.map((item) => ({
      left: item.boardX,
      top: item.boardY,
      right: item.boardX + item.boardW,
      bottom: item.boardY + item.boardH,
    }))

    if (itemsWithBounds.length === 0) {
      setZoom(1)
      container.scrollLeft = 0
      container.scrollTop = 0
      return
    }

    const padding = 120
    const minX = Math.min(...itemsWithBounds.map((item) => item.left)) - padding
    const minY = Math.min(...itemsWithBounds.map((item) => item.top)) - padding
    const maxX = Math.max(...itemsWithBounds.map((item) => item.right)) + padding
    const maxY = Math.max(...itemsWithBounds.map((item) => item.bottom)) + padding
    const boundsWidth = Math.max(640, maxX - minX)
    const boundsHeight = Math.max(420, maxY - minY)
    const fitZoom = clampZoom(Math.min(container.clientWidth / boundsWidth, container.clientHeight / boundsHeight))

    setZoom(fitZoom)

    requestAnimationFrame(() => {
      const current = scrollRef.current
      if (!current) {
        return
      }

      current.scrollLeft = Math.max(0, minX * fitZoom)
      current.scrollTop = Math.max(0, minY * fitZoom)
    })
  }, [board.items, immersive, setZoom])

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-3">
      <div
        className={cn(
          'z-10 flex items-center justify-end gap-2',
          immersive
            ? 'pointer-events-none absolute right-5 top-5'
            : '',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2',
            immersive
              ? 'pointer-events-auto rounded-xl border border-border/80 bg-panel/85 px-2 py-1.5 shadow-panel backdrop-blur'
              : '',
          )}
        >
          <Button variant="ghost" size="sm" onClick={() => autoArrange('row')}>
            Row
          </Button>
          <Button variant="ghost" size="sm" onClick={() => autoArrange('stack')}>
            Stack
          </Button>
          <Button variant="ghost" size="sm" onClick={() => autoArrange('grid')}>
            Grid
          </Button>
          <Button variant="ghost" size="sm" onClick={() => applyZoom(zoom - 0.1)}>
            -
          </Button>
          <div className="min-w-16 text-center text-xs font-medium text-muted">{Math.round(zoom * 100)}%</div>
          <Button variant="ghost" size="sm" onClick={() => applyZoom(zoom + 0.1)}>
            +
          </Button>
          <Button variant="ghost" size="sm" onClick={() => applyZoom(1)}>
            Reset
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className={cn(
          'relative min-h-[720px] overflow-auto bg-[#11141b]',
          immersive ? 'h-full min-h-0 rounded-none border-0' : 'rounded-2xl border border-border/60',
          nativeSceneDropActive && 'border-dashed border-accent/70 bg-accent/5',
          spacePressed ? 'cursor-grab' : '',
          panning ? 'cursor-grabbing select-none' : '',
        )}
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(89, 185, 255, 0.05), transparent 28%), radial-gradient(circle at 80% 18%, rgba(255, 255, 255, 0.035), transparent 24%), radial-gradient(circle at 50% 78%, rgba(89, 185, 255, 0.035), transparent 30%)',
        }}
        onPointerDownCapture={(event) => {
          const container = scrollRef.current
          if (!container || event.button !== 0) {
            return
          }

          if (spacePressedRef.current) {
            event.preventDefault()
            event.stopPropagation()
            panRef.current = {
              startX: event.clientX,
              startY: event.clientY,
              scrollLeft: container.scrollLeft,
              scrollTop: container.scrollTop,
            }
            setPanning(true)
            return
          }

          if (shouldIgnoreCanvasDrag(event.target) || isBoardCardTarget(event.target)) {
            return
          }

          event.preventDefault()
          event.stopPropagation()
          setMultiSelectedItemIds([])
          onSelect(null)
          const start = clientToWorld(event.clientX, event.clientY)
          marqueeRef.current = { startX: start.x, startY: start.y }
          setSelectionRect({ x: start.x, y: start.y, width: 0, height: 0 })
        }}
        onClick={(event) => {
          if (suppressBackgroundClickRef.current) {
            return
          }
          if (!isBoardCardTarget(event.target)) {
            setMultiSelectedItemIds([])
            onSelect(null)
          }
        }}
        onDragOver={(event) => {
          const sceneIds = getDraggedSceneIds(event.dataTransfer)
          if (sceneIds.length === 0) {
            return
          }
          event.preventDefault()
          event.stopPropagation()
          event.dataTransfer.dropEffect = 'copy'
          onNativeSceneDragStateChange?.(true)
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return
          }
          onNativeSceneDragStateChange?.(false)
        }}
        onDrop={async (event) => {
          event.preventDefault()
          event.stopPropagation()
          const sceneIds = await resolveDraggedSceneIds(event.dataTransfer, true)
          if (sceneIds.length === 0) {
            return
          }
          onNativeSceneDragStateChange?.(false)
          onNativeSceneDrop(
            sceneIds,
            canvasHandleRef?.current?.resolveDropPosition(event.clientX, event.clientY) ?? null,
          )
        }}
      >
        <div
          className="relative"
          style={{
            width: `${canvasWidth * zoom}px`,
            height: `${canvasHeight * zoom}px`,
          }}
        >
          <div
            className="relative"
            style={{
              width: canvasWidth,
              height: canvasHeight,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
            }}
          >
        {selectionRect ? (
          <div
            className="pointer-events-none absolute rounded-xl border border-accent/70 bg-accent/10"
            style={{
              left: selectionRect.x,
              top: selectionRect.y,
              width: selectionRect.width,
              height: selectionRect.height,
            }}
          />
        ) : null}
        {board.items.map((item) => {
          const scene = isSceneBoardItem(item) ? scenes.find((entry) => entry.id === item.sceneId) ?? null : null
          const muted = isSceneBoardItem(item) ? !filteredSceneIdSet.has(item.sceneId) : false
          return (
            <BoardCanvasCard
              key={item.id}
              item={item}
              scene={scene}
              tags={scene ? tags.filter((tag) => scene.tagIds.includes(tag.id)) : []}
              selected={selectedItemIds.includes(item.id)}
              muted={muted}
              overridePosition={groupPreview?.[item.id] ?? null}
              onSelect={(sceneId, boardItemId) => {
                setMultiSelectedItemIds([])
                onSelect(sceneId, boardItemId)
              }}
              onOpenInspector={onOpenInspector}
              onToggleKeyScene={onToggleKeyScene}
              onUpdatePosition={onUpdatePosition}
              onInlineUpdateScene={onInlineUpdateScene}
              onInlineUpdateBlock={onInlineUpdateBlock}
              onContextMenu={onContextMenu}
              onStartGroupDrag={startGroupDrag}
              zoom={zoom}
            />
          )
        })}
          </div>
        </div>
      </div>
    </div>
  )
}

function BoardCanvasCard({
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
  onStartGroupDrag?(event: React.PointerEvent<HTMLDivElement>, itemId: string): boolean
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

  useEffect(() => () => {
    if (settlingTimerRef.current) {
      window.clearTimeout(settlingTimerRef.current)
    }
  }, [])

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

        if (shouldIgnoreCanvasDrag(event.target)) {
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
            action={
              scene ? <KeyRatingButton value={scene.keyRating} onChange={() => onToggleKeyScene(scene)} /> : null
            }
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
    notes: '',
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

function normalizeSelectionRect(startX: number, startY: number, endX: number, endY: number) {
  return {
    x: Math.min(startX, endX),
    y: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  }
}

function rectanglesIntersect(
  selection: { x: number; y: number; width: number; height: number },
  item: { x: number; y: number; width: number; height: number },
) {
  return !(
    selection.x + selection.width < item.x ||
    item.x + item.width < selection.x ||
    selection.y + selection.height < item.y ||
    item.y + item.height < selection.y
  )
}

function roundZoom(value: number) {
  return Math.round(value * 10) / 10
}

function clampZoom(value: number) {
  return Math.max(0.5, Math.min(1.8, roundZoom(value)))
}

function shouldIgnoreCanvasDrag(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest('button, input, textarea, select, a, [data-no-card-drag="true"]'))
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'))
}

function isInlineEditorActive() {
  if (typeof document === 'undefined') {
    return false
  }

  const activeElement = document.activeElement
  if (!(activeElement instanceof HTMLElement)) {
    return false
  }

  return Boolean(activeElement.closest('[data-inline-edit-scope="true"]'))
}

function isBoardCardTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest('[data-board-card="true"]'))
}

function getDraggedSceneIds(dataTransfer: DataTransfer) {
  const session = window.narralab.windows.getDragSession()
  if (session?.kind === 'scene') {
    return session.sceneIds
  }

  return readSceneDragData(dataTransfer)
}

async function resolveDraggedSceneIds(dataTransfer: DataTransfer, consume = false) {
  const nativeIds = readSceneDragData(dataTransfer)
  if (nativeIds.length > 0) {
    if (consume) {
      void window.narralab.windows.setDragSession(null)
    }
    return nativeIds
  }

  const session = consume
    ? await window.narralab.windows.consumeDragSession()
    : await window.narralab.windows.readDragSession()
  if (session?.kind === 'scene') {
    return session.sceneIds
  }

  return []
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
  beatsExpanded,
  onToggleBeats,
  onCreateBeat,
  onUpdateBeat,
  onDeleteBeat,
  onInlineUpdateScene,
  onInlineUpdateBlock,
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
  beatsExpanded: boolean
  onToggleBeats(): void
  onCreateBeat(sceneId: string, afterBeatId?: string | null): void
  onUpdateBeat(input: SceneBeatUpdateInput): void
  onDeleteBeat(beatId: string): void
  onInlineUpdateScene(sceneId: string, input: { title: string; synopsis: string }): void
  onInlineUpdateBlock(itemId: string, input: { title: string; body: string }): void
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
          <Badge className="capitalize">{scene.status}</Badge>
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
      <div className="space-y-2">
        {scene.beats.map((beat, index) => (
          <OutlineBeatRow
            key={`${beat.id}:${beat.updatedAt}`}
            sceneId={scene.id}
            beat={beat}
            index={index}
            onUpdateBeat={onUpdateBeat}
            onDeleteBeat={onDeleteBeat}
          />
        ))}
        <Button variant="ghost" size="sm" onClick={() => onCreateBeat(scene.id, scene.beats.at(-1)?.id ?? null)}>
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
  index,
  onUpdateBeat,
  onDeleteBeat,
}: {
  sceneId: string
  beat: SceneBeat
  index: number
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
        'flex items-center gap-2 rounded-xl border border-border/70 bg-panelMuted/30 px-3 py-2',
        isDragging && 'opacity-40',
      )}
      onDoubleClick={(event) => {
        event.stopPropagation()
        setEditing(true)
      }}
    >
      <button
        type="button"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-panel hover:text-foreground"
        aria-label="Reorder beat"
        title="Reorder beat"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="w-5 shrink-0 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        {index + 1}
      </div>
      {editing ? (
        <InlineNameEditor
          value={draft}
          onChange={setDraft}
          onSubmit={save}
          onCancel={() => {
            setDraft(beat.text)
            setEditing(false)
          }}
          className="h-9 flex-1"
          autoFocus={true}
        />
      ) : (
        <button
          type="button"
          className="min-w-0 flex-1 text-left text-sm leading-6 text-foreground/90"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => {
            event.stopPropagation()
            setEditing(true)
          }}
        >
          {beat.text || 'Untitled beat'}
        </button>
      )}
      <InlineActionButton label="Delete beat" onClick={() => onDeleteBeat(beat.id)}>
        <X className="h-4 w-4" />
      </InlineActionButton>
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
  item: Exclude<BoardItem, { kind: 'scene' }>
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

function resolveInsertAfterItemIdAtPoint(
  container: HTMLDivElement | null,
  clientY: number,
  selectedBoardItemId: string | null,
) {
  if (!container) {
    return selectedBoardItemId
  }

  const nodes = Array.from(container.querySelectorAll<HTMLElement>('[data-board-item-id]'))
  if (nodes.length === 0) {
    return null
  }

  let previousId: string | null = null

  for (const node of nodes) {
    const rect = node.getBoundingClientRect()
    const midpoint = rect.top + rect.height / 2

    if (clientY < midpoint) {
      return previousId
    }

    previousId = node.dataset.boardItemId ?? previousId
  }

  return previousId
}

function parseBeatDragId(id: string) {
  const [, sceneId, beatId] = id.split(':')
  if (!sceneId || !beatId) {
    return null
  }

  return { sceneId, beatId }
}
