import type { PointerEventHandler, ReactNode, RefObject } from 'react'
import {
  AlertTriangle,
  Archive as ArchiveIcon,
  ChevronDown,
  LayoutGrid,
  Maximize2,
  MessageCircle,
  Mic,
  NotebookText,
  Rows3,
  X,
} from 'lucide-react'

import { ConsultantWorkspace } from '@/features/consultant/consultant-workspace'
import { CollapsedRail, ResizeHandle } from '@/app/app-shell-controls'
import { densityOptions, detachedLabel, detachedTitle } from '@/app/app-shell-utils'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import type {
  AppSettings,
  ConsultantDialogSize,
  ConsultantDialogPosition,
  ConsultantLauncherPosition,
  ConsultantMessage,
  ConsultantProactiveHint,
  WindowWorkspace,
} from '@/types/ai'

type PanelResizeState = {
  size: number
  isResizing: boolean
  startResize(direction: 1 | -1): PointerEventHandler<HTMLButtonElement>
}

const workspaceTabs = [
  { value: 'outline', label: 'Outline', shortLabel: 'Outline', icon: Rows3 },
  { value: 'bank', label: 'Scene Bank', shortLabel: 'Bank', icon: LayoutGrid },
  { value: 'notebook', label: 'Notebook', shortLabel: 'Notebook', icon: NotebookText },
  { value: 'archive', label: 'Archive', shortLabel: 'Archive', icon: ArchiveIcon },
  { value: 'transcribe', label: 'Transcribe', shortLabel: 'Transcribe', icon: Mic },
] as const

type DensityOption = (typeof densityOptions)[number]

export function ErrorBanner({
  error,
  onDismiss,
}: {
  error: string
  onDismiss(): void
}) {
  return (
    <Panel className="flex items-center justify-between border-danger/50 bg-danger/10 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-red-100">
        <AlertTriangle className="h-4 w-4" />
        {error}
      </div>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </Panel>
  )
}

export function DetachedWindowHeader({
  detachedWorkspace,
  densityOption,
  viewButtonRef,
  onOpenViewMenu,
  onToggleOutlineImmersive,
}: {
  detachedWorkspace: WindowWorkspace
  densityOption: DensityOption
  viewButtonRef: RefObject<HTMLButtonElement | null>
  onOpenViewMenu(): void
  onToggleOutlineImmersive(): void
}) {
  return (
    <div className="app-drag flex items-center justify-between border-b border-border/90 px-5 py-3 pl-24">
      <div>
        <div className="font-display text-lg font-semibold text-foreground">{detachedTitle(detachedWorkspace)}</div>
        <div className="text-sm text-muted">{detachedLabel(detachedWorkspace)}</div>
      </div>
      <div className="app-no-drag flex items-center gap-2">
        {detachedWorkspace === 'outline' ? (
          <Button variant="ghost" size="sm" onClick={onToggleOutlineImmersive} title="Fullscreen focus" aria-label="Fullscreen focus">
            <Maximize2 className="h-4 w-4" />
            <span className="hidden lg:inline">Focus</span>
          </Button>
        ) : null}
        {detachedWorkspace === 'outline' || detachedWorkspace === 'bank' ? (
          <button
            ref={viewButtonRef}
            type="button"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border bg-panel px-2.5 text-sm font-medium text-foreground transition hover:bg-panelMuted lg:px-3"
            onClick={onOpenViewMenu}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">View</span>
            <densityOption.icon className="h-4 w-4" />
            <ChevronDown className="h-4 w-4 text-muted" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function WorkspaceTabsBar({
  workspaceMode,
  workspaceSummary,
  showDensityControl,
  densityOption,
  viewButtonRef,
  onOpenViewMenu,
  onSetWorkspaceMode,
}: {
  workspaceMode: string
  workspaceSummary: string
  showDensityControl: boolean
  densityOption: DensityOption
  viewButtonRef: RefObject<HTMLButtonElement | null>
  onOpenViewMenu(): void
  onSetWorkspaceMode(mode: (typeof workspaceTabs)[number]['value']): void
}) {
  return (
    <Panel className="app-drag px-4 py-3">
      <div className="flex min-w-0 items-center gap-3 overflow-hidden">
        <div className="app-no-drag flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {workspaceTabs.map((tab) => {
            const Icon = tab.icon

            return (
              <Button
                key={tab.value}
                variant={workspaceMode === tab.value ? 'accent' : 'ghost'}
                size="sm"
                onClick={() => onSetWorkspaceMode(tab.value)}
                className="shrink-0 whitespace-nowrap px-2.5 lg:px-3"
                title={tab.label}
                aria-label={tab.label}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden min-[1280px]:inline">{tab.label}</span>
                <span className="hidden min-[1080px]:max-[1279px]:inline">{tab.shortLabel}</span>
              </Button>
            )
          })}
          {showDensityControl ? (
            <>
              <div className="h-6 w-px shrink-0 bg-border" />
              <button
                ref={viewButtonRef}
                type="button"
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border bg-panel px-2.5 text-sm font-medium text-foreground transition hover:bg-panelMuted lg:px-3"
                onClick={onOpenViewMenu}
                aria-label={`View: ${densityOption.label}`}
                title={`View: ${densityOption.label}`}
              >
                <span className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-muted xl:inline">
                  View
                </span>
                <densityOption.icon className="h-4 w-4" />
                <ChevronDown className="h-4 w-4 text-muted" />
              </button>
            </>
          ) : null}
        </div>
        <div className="min-w-0 shrink text-right text-sm text-muted">
          <div className="truncate whitespace-nowrap">{workspaceSummary}</div>
        </div>
      </div>
    </Panel>
  )
}

export function InspectorSidebar({
  showInspector,
  collapsed,
  resize,
  inspectorContent,
  onExpand,
}: {
  showInspector: boolean
  collapsed: boolean
  resize: PanelResizeState
  inspectorContent: ReactNode
  onExpand(): void
}) {
  if (!showInspector) {
    return null
  }

  if (collapsed) {
    return <CollapsedRail side="right" title="Inspector" onExpand={onExpand} />
  }

  return (
    <>
      <ResizeHandle
        label="Resize inspector"
        active={resize.isResizing}
        onPointerDown={resize.startResize(-1)}
      />
      <div className="min-h-0 shrink-0 overflow-hidden" style={{ width: resize.size }}>
        <Panel className="flex h-full flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-0">
            {inspectorContent}
          </div>
        </Panel>
      </div>
    </>
  )
}

export function ConsultantLauncher({
  open,
  position,
  hasHint,
  dialogPosition,
  dialogSize,
  settings,
  messages,
  busy,
  contextSummary,
  proactiveHint,
  onOpen,
  onClose,
  onOpenFullView,
  onPointerDown,
  onDialogPointerDown,
  onResizePointerDown,
  onSend,
  onClear,
  onOpenSettings,
}: {
  open: boolean
  position: ConsultantLauncherPosition
  hasHint: boolean
  dialogPosition: ConsultantDialogPosition
  dialogSize: ConsultantDialogSize
  settings: AppSettings
  messages: ConsultantMessage[]
  busy: boolean
  contextSummary: string
  proactiveHint: ConsultantProactiveHint | null
  onOpen(): void
  onClose(): void
  onOpenFullView(): void
  onPointerDown: PointerEventHandler<HTMLButtonElement>
  onDialogPointerDown: PointerEventHandler<HTMLDivElement>
  onResizePointerDown: PointerEventHandler<HTMLButtonElement>
  onSend(content: string): void
  onClear(): void
  onOpenSettings(): void
}) {
  return (
    <>
      {open ? (
        <div className="pointer-events-none fixed inset-0 z-40">
          <div
            className="pointer-events-auto absolute"
            style={{ left: dialogPosition.x, top: dialogPosition.y, width: dialogSize.width }}
          >
            <Panel className="relative flex flex-col overflow-hidden rounded-[32px] shadow-2xl shadow-black/40" style={{ height: dialogSize.height }}>
              <div className="flex cursor-move items-start justify-between gap-4 border-b border-border/90 px-6 py-5" onPointerDown={onDialogPointerDown}>
                <div className="min-w-0">
                  <div className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">Consultant</div>
                  <div className="mt-2 truncate text-base text-muted">{contextSummary}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={onOpenFullView}>
                    Open Panel
                  </Button>
                  <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close consultant dialog">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="min-h-0 flex-1 p-5">
                <ConsultantWorkspace
                  settings={settings}
                  messages={messages}
                  busy={busy}
                  contextSummary={contextSummary}
                  proactiveHint={proactiveHint}
                  compact
                  onSend={onSend}
                  onClear={onClear}
                  onOpenSettings={onOpenSettings}
                />
              </div>
              <button
                type="button"
                data-direction="left"
                className="absolute bottom-12 left-0 top-12 w-3 cursor-ew-resize"
                onPointerDown={onResizePointerDown}
                aria-label="Resize consultant dialog from left edge"
                title="Resize"
              />
              <button
                type="button"
                data-direction="right"
                className="absolute bottom-12 right-0 top-12 w-3 cursor-ew-resize"
                onPointerDown={onResizePointerDown}
                aria-label="Resize consultant dialog from right edge"
                title="Resize"
              />
              <button
                type="button"
                data-direction="bottom"
                className="absolute bottom-0 left-4 right-4 h-3 cursor-ns-resize"
                onPointerDown={onResizePointerDown}
                aria-label="Resize consultant dialog from bottom edge"
                title="Resize"
              />
              <button
                type="button"
                data-direction="bottom-left"
                className="absolute bottom-0 left-0 h-4 w-4 cursor-nesw-resize"
                onPointerDown={onResizePointerDown}
                aria-label="Resize consultant dialog from bottom left corner"
                title="Resize"
              />
            </Panel>
          </div>
        </div>
      ) : null}

      <div
        className="pointer-events-none fixed z-50"
        style={{ left: position.x, top: position.y }}
      >
        <Button
          className="pointer-events-auto relative h-14 w-14 rounded-full px-0 shadow-2xl shadow-black/35"
          variant="accent"
          size="md"
          onClick={onOpen}
          onPointerDown={onPointerDown}
          aria-label={hasHint ? 'Open consultant with suggestion available' : 'Open consultant'}
          title={hasHint ? 'Consultant has a suggestion for your current work' : 'Open consultant'}
        >
          <MessageCircle className="h-5 w-5" />
          {hasHint ? <span className="absolute right-1.5 top-1.5 h-3 w-3 rounded-full border border-panel bg-amber-400" /> : null}
        </Button>
      </div>
    </>
  )
}
