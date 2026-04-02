import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanelRightOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineEditActions, InlineEditScope, InlineNameEditor, InlineTextareaEditor } from '@/components/ui/inline-name-editor'
import { SceneCard } from '@/components/cards/scene-card'
import { KeyRatingButton } from '@/components/ui/key-rating-button'
import { InlineActionButton } from '@/features/boards/outline-workspace-shared'
import { getDraggedSceneIds, hexToRgba, resolveDraggedSceneIds } from '@/features/boards/outline-workspace-utils'
import { cn } from '@/lib/cn'
import { boardBlockKinds, sceneColors } from '@/lib/constants'
import { usePersistedNumber } from '@/hooks/use-persisted-number'
import type { Board, BoardItem } from '@/types/board'
import { isSceneBoardItem } from '@/types/board'
import type { Scene } from '@/types/scene'
import type { Tag } from '@/types/tag'

export type BoardCanvasHandle = {
  resolveDropPosition(clientX: number, clientY: number): { x: number; y: number } | null
  revealItem(itemId: string): void
}

export function BoardCanvasView({
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

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const container = scrollRef.current
      if (!container) {
        return { x: 0, y: 0 }
      }

      const rect = container.getBoundingClientRect()
      return {
        x: (container.scrollLeft + clientX - rect.left) / zoom,
        y: (container.scrollTop + clientY - rect.top) / zoom,
      }
    },
    [zoom],
  )

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
          const targetLeft = Math.max(0, item.boardX * zoom - container.clientWidth / 2 + (item.boardW * zoom) / 2)
          const targetTop = Math.max(0, item.boardY * zoom - container.clientHeight / 2 + (item.boardH * zoom) / 2)
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

  const applyZoom = useCallback(
    (nextZoom: number, focus?: { clientX: number; clientY: number }) => {
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
    },
    [setZoom, zoom],
  )

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
    (event: ReactPointerEvent<HTMLDivElement>, itemId: string) => {
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
  onStartGroupDrag?(event: ReactPointerEvent<HTMLDivElement>, itemId: string): boolean
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
