import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/cn'

export type ContextMenuItem = {
  label: string
  onSelect(): void
  disabled?: boolean
  danger?: boolean
}

type Props = {
  open: boolean
  x: number
  y: number
  items: ContextMenuItem[]
  onClose(): void
}

export function ContextMenu({ open, x, y, items, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState({ left: x, top: y })

  useEffect(() => {
    if (!open) return

    const handlePointerDown = () => onClose()
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [onClose, open])

  useLayoutEffect(() => {
    if (!open || !menuRef.current) return

    const rect = menuRef.current.getBoundingClientRect()
    const margin = 12
    setPosition({
      left: Math.max(margin, Math.min(x, window.innerWidth - rect.width - margin)),
      top: Math.max(margin, Math.min(y, window.innerHeight - rect.height - margin)),
    })
  }, [items.length, open, x, y])

  if (!open) {
    return null
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[190px] rounded-2xl border border-border/90 bg-panel/95 p-1.5 shadow-panel backdrop-blur"
      style={{
        left: position.left,
        top: position.top,
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={item.disabled}
          className={cn(
            'flex w-full items-center rounded-xl px-3 py-2 text-left text-sm transition',
            item.disabled
              ? 'cursor-not-allowed opacity-40'
              : item.danger
                ? 'text-red-200 hover:bg-danger/15'
                : 'text-foreground hover:bg-panelMuted',
          )}
          onClick={() => {
            if (item.disabled) return
            item.onSelect()
            onClose()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  )
}
