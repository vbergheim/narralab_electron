import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Modifier,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  ChevronDown,
  Layers3,
  Minimize2,
  PanelLeftClose,
} from 'lucide-react'

import { BoardManagerDialog } from '@/components/board-selector/board-manager-dialog'
import { BoardSelectorDropdown } from '@/components/board-selector/board-selector-dropdown'
import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { SceneReorderGap } from '@/components/ui/scene-reorder-gap'
import { SceneBankView } from '@/features/scenes/scene-bank-view'
import { BoardCanvasView, type BoardCanvasHandle } from '@/features/boards/outline-workspace-canvas'
import {
  AddBlockMenu,
  CollapsedWorkspaceRail,
  DropPanel,
  ViewModeToggle,
} from '@/features/boards/outline-workspace-chrome'
import {
  handleDragEnd,
  handleDragStart,
  resolveInsertAfterItemId,
  resolveInsertAfterItemIdAtPoint,
  type DragPayload,
} from '@/features/boards/outline-workspace-dnd'
import {
  BoardSortableItem,
  OutlineDragOverlayContent,
} from '@/features/boards/outline-workspace-rows'
import { ResizeHandle } from '@/features/boards/outline-workspace-shared'
import { getDraggedSceneIds, resolveDraggedSceneIds } from '@/features/boards/outline-workspace-utils'
import { usePersistedStringArray } from '@/hooks/use-persisted-string-array'
import { usePanelResize } from '@/hooks/use-panel-resize'
import { cn } from '@/lib/cn'
import { formatDuration } from '@/lib/durations'
import type { AddSceneToBoardResult, BlockTemplate, Board, BoardFolder, BoardTextItemKind, BoardViewMode } from '@/types/board'
import { isSceneBoardItem } from '@/types/board'
import type { Scene, SceneBeatUpdateInput, SceneFolder } from '@/types/scene'
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
  /** localStorage key for Scene Bank panel width (e.g. per project path). */
  sceneBankWidthStorageKey?: string | null
  detachedViewControl?: ReactNode
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
  onAddScene(
    sceneId: string,
    afterItemId?: string | null,
    boardPosition?: { x: number; y: number } | null,
  ): Promise<AddSceneToBoardResult | null> | AddSceneToBoardResult | null
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
  sceneBankWidthStorageKey = null,
  detachedViewControl,
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
  const bankResize = usePanelResize({
    initial: 320,
    min: 240,
    max: 520,
    storageKey: sceneBankWidthStorageKey,
  })
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
                {detachedViewControl}
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
                    let nextInsertAfterItemId = insertAfterItemId
                    for (const sceneId of sceneIds) {
                      const result = await onAddScene(sceneId, nextInsertAfterItemId)
                      if (result?.item.id) {
                        nextInsertAfterItemId = result.item.id
                      }
                    }
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
                      <BoardSortableItem
                        key={item.id}
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
                        afterContent={
                          showInsertAfter ? (
                            <SceneReorderGap variant="outline" density={density} count={nativeDraggedSceneCount} />
                          ) : null
                        }
                      />
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
                  void (async () => {
                    for (const sceneId of sceneIds) {
                      await onAddScene(sceneId, null, boardPosition)
                    }
                  })()
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
              <OutlineDragOverlayContent
                activeOverlay={activeOverlay}
                activeSceneOverlay={activeSceneOverlay}
                scenes={scenes}
                tags={tags}
                density={density}
              />
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
