import type { RefObject } from 'react'
import { Download, FileJson2, FolderOpen, FolderPlus, Layers3, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFilterStore } from '@/stores/filter-store'
import type { ProjectMeta } from '@/types/project'

type Props = {
  projectMeta: ProjectMeta | null
  busy: boolean
  onCreateProject(): void
  onOpenProject(): void
  onSaveAs(): void
  onImportJson(): void
  onExportJson(): void
  onCreateScene(): void
  onCloneBoard(): void
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
  onCreateScene,
  onCloneBoard,
  searchRef,
}: Props) {
  const search = useFilterStore((state) => state.search)
  const setSearch = useFilterStore((state) => state.setSearch)

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
        <Button variant="ghost" size="sm" onClick={onImportJson} disabled={busy || !projectMeta}>
          <FileJson2 className="h-4 w-4" />
          Import
        </Button>
        <Button variant="ghost" size="sm" onClick={onExportJson} disabled={busy || !projectMeta}>
          <FileJson2 className="h-4 w-4" />
          Export
        </Button>
        <Button variant="ghost" size="sm" onClick={onCloneBoard} disabled={busy || !projectMeta}>
          <Layers3 className="h-4 w-4" />
          Clone Board
        </Button>
        <Button variant="accent" size="sm" onClick={onCreateScene} disabled={busy || !projectMeta}>
          <Plus className="h-4 w-4" />
          New Scene
        </Button>
      </div>
    </div>
  )
}
