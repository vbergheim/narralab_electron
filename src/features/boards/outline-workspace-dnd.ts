import type { Dispatch, RefObject, SetStateAction } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'

import type { BoardCanvasHandle } from '@/features/boards/outline-workspace-canvas'
import type { Board, BoardViewMode } from '@/types/board'
import type { Scene } from '@/types/scene'

export type DragPayload =
  | { kind: 'scene'; sceneId: string }
  | { kind: 'board-item'; itemId: string }
  | null

export function handleDragStart(
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

export function handleDragEnd(
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

export function resolveInsertAfterItemId(
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

export function resolveInsertAfterItemIdAtPoint(
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
