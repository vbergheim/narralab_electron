import { useEffect } from 'react'

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

  if (!open) {
    return null
  }

  return (
    <div
      className="fixed z-50 min-w-[190px] rounded-2xl border border-border/90 bg-panel/95 p-1.5 shadow-panel backdrop-blur"
      style={{
        left: Math.min(x, window.innerWidth - 212),
        top: Math.min(y, window.innerHeight - (items.length * 38 + 24)),
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
    </div>
  )
}
