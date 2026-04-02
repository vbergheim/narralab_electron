import type { PointerEventHandler } from 'react'
import { GripVertical, PanelLeftOpen, PanelRightOpen } from 'lucide-react'

import { Panel } from '@/components/ui/panel'
import { cn } from '@/lib/cn'

export function CollapsedRail({
  side,
  title,
  onExpand,
}: {
  side: 'left' | 'right'
  title: string
  onExpand(): void
}) {
  return (
    <Panel className="h-full overflow-hidden px-0 py-0">
      <button
        type="button"
        onClick={onExpand}
        title={`Open ${title}`}
        aria-label={`Open ${title}`}
        className="flex h-full w-full items-start justify-center rounded-[inherit] px-2 py-4 text-muted transition hover:bg-panelMuted hover:text-foreground"
      >
        <div className="flex flex-col items-center gap-3">
          {side === 'left' ? <PanelLeftOpen className="h-4 w-4 shrink-0" /> : <PanelRightOpen className="h-4 w-4 shrink-0" />}
          <span
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            {title}
          </span>
        </div>
      </button>
    </Panel>
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
