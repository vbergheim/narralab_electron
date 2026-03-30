import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useState } from 'react'

type Options = {
  initial: number
  min: number
  max: number
  /** When set, width is read/written to localStorage (per-project keys recommended). */
  storageKey?: string | null
}

type DragState = {
  startX: number
  startSize: number
  direction: 1 | -1
} | null

function readStoredSize(key: string, min: number, max: number, fallback: number): number {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback
  } catch {
    return fallback
  }
}

export function usePanelResize({ initial, min, max, storageKey }: Options) {
  const [size, setSize] = useState(initial)

  useEffect(() => {
    if (!storageKey) {
      setSize(initial)
      return
    }
    setSize(readStoredSize(storageKey, min, max, initial))
  }, [storageKey, initial, min, max])

  useEffect(() => {
    if (!storageKey || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey, String(size))
    } catch {
      // ignore quota / private mode
    }
  }, [storageKey, size])

  const [dragState, setDragState] = useState<DragState>(null)

  useEffect(() => {
    if (!dragState) return

    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onPointerMove = (event: PointerEvent) => {
      const delta = (event.clientX - dragState.startX) * dragState.direction
      setSize(clamp(dragState.startSize + delta, min, max))
    }

    const onPointerUp = () => {
      setDragState(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [dragState, max, min])

  const startResize = (direction: 1 | -1) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setDragState({
      startX: event.clientX,
      startSize: size,
      direction,
    })
  }

  return {
    size,
    setSize,
    startResize,
    isResizing: dragState !== null,
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
