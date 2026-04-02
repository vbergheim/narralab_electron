import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { BoardCanvasCard } from '@/features/boards/outline-workspace-canvas-card'
import { getDraggedSceneIds, resolveDraggedSceneIds } from '@/features/boards/outline-workspace-utils'
import { cn } from '@/lib/cn'
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
                  shouldIgnoreDragTarget={shouldIgnoreCanvasDrag}
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
