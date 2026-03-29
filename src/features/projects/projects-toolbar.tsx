import type { ReactNode, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Download,
  FileCode2,
  FileJson2,
  FileSpreadsheet,
  FileText,
  Files,
  FolderOpen,
  FolderPlus,
  LayoutTemplate,
  MonitorUp,
  Settings2,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { useFilterStore } from '@/stores/filter-store'
import type { SavedWindowLayout, WindowWorkspace } from '@/types/ai'
import type { BoardScriptExportFormat, ProjectMeta } from '@/types/project'

type Props = {
  projectMeta: ProjectMeta | null
  busy: boolean
  projectTitle?: string
  savedLayouts: SavedWindowLayout[]
  onCreateProject(): void
  onOpenProject(): void
  onSaveAs(): void
  onImportJson(): void
  onImportShootLog(): void
  onExportJson(): void
  onExportScript(format: BoardScriptExportFormat): void
  onOpenSettings(): void
  onOpenWorkspaceWindow(workspace: WindowWorkspace): void
  onSaveLayout(): void
  onApplyLayout(layoutId: string): void
  onDeleteLayout(layoutId: string): void
  searchRef: RefObject<HTMLInputElement | null>
}

export function ProjectsToolbar({
  projectMeta,
  busy,
  projectTitle,
  savedLayouts,
  onCreateProject,
  onOpenProject,
  onSaveAs,
  onImportJson,
  onImportShootLog,
  onExportJson,
  onExportScript,
  onOpenSettings,
  onOpenWorkspaceWindow,
  onSaveLayout,
  onApplyLayout,
  onDeleteLayout,
  searchRef,
}: Props) {
  const search = useFilterStore((state) => state.search)
  const setSearch = useFilterStore((state) => state.setSearch)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [scriptMenuOpen, setScriptMenuOpen] = useState(false)
  const [windowMenuOpen, setWindowMenuOpen] = useState(false)
  const fileMenuRef = useRef<HTMLDivElement | null>(null)
  const scriptMenuRef = useRef<HTMLDivElement | null>(null)
  const windowMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!fileMenuRef.current?.contains(target)) {
        setFileMenuOpen(false)
      }
      if (!scriptMenuRef.current?.contains(target)) {
        setScriptMenuOpen(false)
      }
      if (!windowMenuRef.current?.contains(target)) {
        setWindowMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <div className="app-drag flex items-center justify-between gap-4 border-b border-border/90 px-5 py-4 pl-24">
      <div>
        <div className="font-display text-lg font-semibold text-foreground">
          {projectTitle || projectMeta?.name || 'NarraLab'}
        </div>
        <div className="text-sm text-muted">
          {projectMeta?.path ?? 'Create or open a local project file to start outlining.'}
        </div>
      </div>

      <div className="app-no-drag flex items-center gap-2">
        <div className="w-64">
          <Input
            ref={searchRef}
            placeholder="Search scenes, notes, locations..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div ref={fileMenuRef} className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFileMenuOpen((current) => !current)
              setScriptMenuOpen(false)
              setWindowMenuOpen(false)
            }}
            disabled={busy}
          >
            <Files className="h-4 w-4" />
            File
            <ChevronDown className="h-4 w-4" />
          </Button>
          {fileMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-2xl border border-border/90 bg-panel p-2 shadow-panel">
              <ToolbarMenuButton
                icon={<FolderPlus className="h-4 w-4" />}
                label="New Project"
                onClick={() => {
                  onCreateProject()
                  setFileMenuOpen(false)
                }}
              />
              <ToolbarMenuButton
                icon={<FolderOpen className="h-4 w-4" />}
                label="Open Project"
                onClick={() => {
                  onOpenProject()
                  setFileMenuOpen(false)
                }}
              />
              <ToolbarMenuButton
                icon={<Download className="h-4 w-4" />}
                label="Save As"
                description="Save the current project to a new file."
                onClick={() => {
                  onSaveAs()
                  setFileMenuOpen(false)
                }}
              />
              <div className="my-2 h-px bg-border/80" />
              <ToolbarMenuButton
                icon={<FileSpreadsheet className="h-4 w-4" />}
                label="Import Shoot Log (.xlsx)"
                description="Add scenes and beats from an Excel shoot log."
                onClick={() => {
                  onImportShootLog()
                  setFileMenuOpen(false)
                }}
              />
              <ToolbarMenuButton
                icon={<FileJson2 className="h-4 w-4" />}
                label="Import JSON"
                onClick={() => {
                  onImportJson()
                  setFileMenuOpen(false)
                }}
              />
              <ToolbarMenuButton
                icon={<FileJson2 className="h-4 w-4" />}
                label="Export JSON"
                onClick={() => {
                  onExportJson()
                  setFileMenuOpen(false)
                }}
              />
            </div>
          ) : null}
        </div>

        <div ref={scriptMenuRef} className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setScriptMenuOpen((current) => !current)
              setFileMenuOpen(false)
              setWindowMenuOpen(false)
            }}
            disabled={busy || !projectMeta}
          >
            <FileText className="h-4 w-4" />
            Script
            <ChevronDown className="h-4 w-4" />
          </Button>
          {scriptMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-2xl border border-border/90 bg-panel p-2 shadow-panel">
              <ToolbarMenuButton
                icon={<FileText className="h-4 w-4" />}
                label="Formatted TXT"
                description="Centered VO, forteller and chapter layout."
                onClick={() => {
                  onExportScript('txt-formatted')
                  setScriptMenuOpen(false)
                }}
              />
              <ToolbarMenuButton
                icon={<FileText className="h-4 w-4" />}
                label="Plain TXT"
                description="Readable text draft without centered formatting."
                onClick={() => {
                  onExportScript('txt-plain')
                  setScriptMenuOpen(false)
                }}
              />
              <ToolbarMenuButton
                icon={<FileCode2 className="h-4 w-4" />}
                label="Screenplay HTML"
                description="Courier-based screenplay layout with title header."
                onClick={() => {
                  onExportScript('html-screenplay')
                  setScriptMenuOpen(false)
                }}
              />
              <ToolbarMenuButton
                icon={<FileCode2 className="h-4 w-4" />}
                label="Word Screenplay"
                description="Word-compatible .doc with the same screenplay layout."
                onClick={() => {
                  onExportScript('doc-screenplay')
                  setScriptMenuOpen(false)
                }}
              />
              <ToolbarMenuButton
                icon={<FileCode2 className="h-4 w-4" />}
                label="Markdown"
                description="Structured board export for further editing."
                onClick={() => {
                  onExportScript('md')
                  setScriptMenuOpen(false)
                }}
              />
            </div>
          ) : null}
        </div>

        <div ref={windowMenuRef} className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setWindowMenuOpen((current) => !current)
              setScriptMenuOpen(false)
              setFileMenuOpen(false)
            }}
            disabled={busy || !projectMeta}
          >
            <MonitorUp className="h-4 w-4" />
            Window
            <ChevronDown className="h-4 w-4" />
          </Button>
          {windowMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-2xl border border-border/90 bg-panel p-2 shadow-panel">
              {([
                ['outline', 'Open Outline'],
                ['bank', 'Open Scene Bank'],
                ['inspector', 'Open Inspector'],
                ['notebook', 'Open Notebook'],
                ['archive', 'Open Archive'],
              ] as Array<[WindowWorkspace, string]>).map(([workspace, label]) => (
                <ToolbarMenuButton
                  key={workspace}
                  icon={<MonitorUp className="h-4 w-4" />}
                  label={label}
                  onClick={() => {
                    onOpenWorkspaceWindow(workspace)
                    setWindowMenuOpen(false)
                  }}
                />
              ))}
              <div className="my-2 h-px bg-border/80" />
              <ToolbarMenuButton
                icon={<LayoutTemplate className="h-4 w-4" />}
                label="Save Current Layout"
                onClick={() => {
                  onSaveLayout()
                  setWindowMenuOpen(false)
                }}
              />
              {savedLayouts.length > 0 ? <div className="my-2 h-px bg-border/80" /> : null}
              {savedLayouts.map((layout) => (
                <div key={layout.id} className="flex items-center gap-2 rounded-xl px-1 py-1 hover:bg-panelMuted">
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-xl px-2 py-1.5 text-left"
                    onClick={() => {
                      onApplyLayout(layout.id)
                      setWindowMenuOpen(false)
                    }}
                  >
                    <div className="truncate text-sm font-medium text-foreground">{layout.name}</div>
                    <div className="text-xs text-muted">{layout.windows.length} windows</div>
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onDeleteLayout(layout.id)
                      setWindowMenuOpen(false)
                    }}
                    title="Delete layout"
                    aria-label={`Delete ${layout.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <Button variant="ghost" size="sm" onClick={onOpenSettings} disabled={busy}>
          <Settings2 className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  )
}

function ToolbarMenuButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon: ReactNode
  label: string
  description?: string
  onClick(): void
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-panelMuted',
      )}
      onClick={onClick}
    >
      <span className="mt-0.5 shrink-0 text-muted">{icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="mt-0.5 block text-xs leading-5 text-muted">{description}</span> : null}
      </span>
    </button>
  )
}
