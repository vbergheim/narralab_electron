import type { ReactNode, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Download,
  FileCode2,
  FileJson2,
  FileText,
  FolderOpen,
  FolderPlus,
  Settings2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { useFilterStore } from '@/stores/filter-store'
import type { BoardScriptExportFormat, ProjectMeta } from '@/types/project'

type Props = {
  projectMeta: ProjectMeta | null
  busy: boolean
  onCreateProject(): void
  onOpenProject(): void
  onSaveAs(): void
  onImportJson(): void
  onExportJson(): void
  onExportScript(format: BoardScriptExportFormat): void
  onOpenSettings(): void
  searchRef: RefObject<HTMLInputElement | null>
}

export function ProjectsToolbar({
  projectMeta,
  busy,
  onCreateProject,
  onOpenProject,
  onSaveAs,
  onImportJson,
  onExportJson,
  onExportScript,
  onOpenSettings,
  searchRef,
}: Props) {
  const search = useFilterStore((state) => state.search)
  const setSearch = useFilterStore((state) => state.setSearch)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [scriptMenuOpen, setScriptMenuOpen] = useState(false)
  const projectMenuRef = useRef<HTMLDivElement | null>(null)
  const scriptMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!projectMenuRef.current?.contains(target)) {
        setProjectMenuOpen(false)
      }
      if (!scriptMenuRef.current?.contains(target)) {
        setScriptMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/90 px-5 py-4 pl-24">
      <div>
        <div className="font-display text-lg font-semibold text-foreground">
          {projectMeta?.name ?? 'DocuDoc'}
        </div>
        <div className="text-sm text-muted">
          {projectMeta?.path ?? 'Create or open a local project file to start outlining.'}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="w-64">
          <Input
            ref={searchRef}
            placeholder="Search scenes, notes, locations..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onCreateProject} disabled={busy}>
          <FolderPlus className="h-4 w-4" />
          New
        </Button>
        <Button variant="ghost" size="sm" onClick={onOpenProject} disabled={busy}>
          <FolderOpen className="h-4 w-4" />
          Open
        </Button>
        <Button variant="ghost" size="sm" onClick={onSaveAs} disabled={busy || !projectMeta}>
          <Download className="h-4 w-4" />
          Save As
        </Button>

        <div ref={scriptMenuRef} className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setScriptMenuOpen((current) => !current)
              setProjectMenuOpen(false)
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

        <div ref={projectMenuRef} className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProjectMenuOpen((current) => !current)
              setScriptMenuOpen(false)
            }}
            disabled={busy || !projectMeta}
          >
            <FileJson2 className="h-4 w-4" />
            Project
            <ChevronDown className="h-4 w-4" />
          </Button>
          {projectMenuOpen ? (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-52 rounded-2xl border border-border/90 bg-panel p-2 shadow-panel">
              <ToolbarMenuButton
                icon={<FileJson2 className="h-4 w-4" />}
                label="Import JSON"
                onClick={() => {
                  onImportJson()
                  setProjectMenuOpen(false)
                }}
              />
              <ToolbarMenuButton
                icon={<FileJson2 className="h-4 w-4" />}
                label="Export JSON"
                onClick={() => {
                  onExportJson()
                  setProjectMenuOpen(false)
                }}
              />
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
