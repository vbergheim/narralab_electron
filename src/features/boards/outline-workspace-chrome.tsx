import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  LayoutPanelTop,
  PanelLeftOpen,
  Plus,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import { InlineActionButton } from '@/features/boards/outline-workspace-shared'
import { cn } from '@/lib/cn'
import { boardBlockKinds } from '@/lib/constants'
import type { BlockTemplate, BoardTextItemKind, BoardViewMode } from '@/types/board'

export function DropPanel({
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
      className={cn('flex h-full flex-col', isOver && 'border-accent/60 bg-accent/5', panelClassName)}
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
      <div ref={bodyRef} className={cn('min-h-0 flex-1 p-4', bodyClassName ?? 'overflow-y-auto overscroll-contain')}>
        {children}
      </div>
    </Panel>
  )
}

export function CollapsedWorkspaceRail({
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

export function AddBlockMenu({
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

export function ViewModeToggle({
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
