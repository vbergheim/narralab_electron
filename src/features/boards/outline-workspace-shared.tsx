import type { PointerEventHandler, ReactNode } from 'react'
import { GripVertical } from 'lucide-react'

import { cn } from '@/lib/cn'

export function InlineActionButton({
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

export function ResizeHandle({
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
      <span className={cn('h-full w-px rounded-full bg-border transition', active ? 'bg-accent' : 'group-hover:bg-accent/70')} />
      <GripVertical className="pointer-events-none absolute h-4 w-4 opacity-0 transition group-hover:opacity-100" />
    </button>
  )
}
