import type { PointerEventHandler } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  Film,
  GripVertical,
  Loader2,
  NotebookText,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'

import { FiltersSidebar } from '@/features/filters/filters-sidebar'
import { OutlineWorkspace } from '@/features/boards/outline-workspace'
import { BoardItemInspector } from '@/features/inspector/board-item-inspector'
import { BulkSceneInspector } from '@/features/inspector/bulk-scene-inspector'
import { SceneInspector } from '@/features/inspector/scene-inspector'
import { NotebookEditor } from '@/features/notebook/notebook-editor'
import { ProjectsToolbar } from '@/features/projects/projects-toolbar'
import { SceneBankView } from '@/features/scenes/scene-bank-view'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import { usePanelResize } from '@/hooks/use-panel-resize'
import { useAppStore } from '@/stores/app-store'
import { useFilterStore } from '@/stores/filter-store'
import { isTextBoardItem } from '@/types/board'
import type { Scene } from '@/types/scene'
import type { SceneDensity } from '@/types/view'

export function App() {
  const searchRef = useRef<HTMLInputElement | null>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [sceneDensity, setSceneDensity] = useState<SceneDensity>('compact')
  const inspectorResize = usePanelResize({ initial: 420, min: 320, max: 620 })
  const {
    ready,
    busy,
    error,
    projectMeta,
    notebook,
    scenes,
    boards,
    tags,
    activeBoardId,
    selectedSceneId,
    selectedSceneIds,
    selectedBoardItemId,
    workspaceMode,
    initialize,
    createProject,
    openProject,
    saveProjectAs,
    importJson,
    exportJson,
    createScene,
    deleteScene,
    persistSceneDraft,
    bulkUpdateScenes,
    persistBoardItemDraft,
    updateNotebookDraft,
    persistNotebook,
    duplicateScene,
    selectScene,
    toggleSceneSelection,
    setSceneSelection,
    clearSceneSelection,
    setWorkspaceMode,
    setActiveBoard,
    renameBoard,
    cloneBoard,
    addSceneToActiveBoard,
    addBlockToActiveBoard,
    duplicateBoardItem,
    removeBoardItem,
    reorderActiveBoard,
    cloneActiveBoard,
    dismissError,
  } = useAppStore()

  const filters = useFilterStore()

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const hasMeta = event.metaKey || event.ctrlKey
      const isEditingText = isTextInputTarget(event.target)

      if (hasMeta && event.key.toLowerCase() === 'n') {
        event.preventDefault()
        if (projectMeta) {
          void createScene()
        } else {
          void createProject()
        }
      }

      if (hasMeta && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        searchRef.current?.focus()
      }

      if (event.shiftKey && event.code === 'Digit1' && !hasMeta && !isEditingText) {
        event.preventDefault()
        setRightCollapsed((current) => !current)
      }

      if (event.shiftKey && event.code === 'Digit2' && !hasMeta && !isEditingText) {
        event.preventDefault()
        setLeftCollapsed((current) => !current)
      }

      if (event.key === 'Escape') {
        selectScene(null)
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (isEditingText) {
          return
        }

        if (selectedBoardItemId) {
          event.preventDefault()
          void removeBoardItem(selectedBoardItemId)
        } else if (selectedSceneId) {
          event.preventDefault()
          if (window.confirm('Delete the selected scene from the project?')) {
            void deleteScene(selectedSceneId)
          }
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    createProject,
    createScene,
    deleteScene,
    projectMeta,
    removeBoardItem,
    selectedBoardItemId,
    selectedSceneId,
    selectScene,
  ])

  const activeBoard = boards.find((board) => board.id === activeBoardId) ?? null

  const openInspector = (sceneId: string | null, boardItemId?: string | null) => {
    selectScene(sceneId, boardItemId ?? null)
    setRightCollapsed(false)
  }

  const toggleKeyScene = (scene: Scene) => {
    const tagNames = tags.filter((tag) => scene.tagIds.includes(tag.id)).map((tag) => tag.name)

    void persistSceneDraft({
      ...scene,
      isKeyScene: !scene.isKeyScene,
      tagNames,
    })
  }

  const filteredScenes = useMemo(() => {
    return scenes.filter((scene) => matchesFilters(scene, filters))
  }, [filters, scenes])

  const filteredSceneIds = useMemo(() => filteredScenes.map((scene) => scene.id), [filteredScenes])

  const selectedBoardItem =
    activeBoard?.items.find((item) => item.id === selectedBoardItemId) ?? null

  const selectedScene =
    scenes.find((scene) => scene.id === selectedSceneId) ??
    (activeBoard && activeBoard.items[0] && activeBoard.items[0].kind === 'scene'
      ? scenes.find((scene) => scene.id === activeBoard.items[0].sceneId) ?? null
      : null)

  const selectedBlock = selectedBoardItem && isTextBoardItem(selectedBoardItem) ? selectedBoardItem : null
  const multiSelectedSceneCount = workspaceMode === 'bank' ? selectedSceneIds.length : 0
  const workspaceSummary =
    workspaceMode === 'notebook'
      ? notebook.updatedAt
        ? `Notebook saved ${new Date(notebook.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Project notebook'
      : activeBoard
        ? `${activeBoard.items.length} rows in active outline`
        : 'No board selected'

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a1f2d_0%,#10131c_32%,#0b0d12_100%)] text-foreground">
      <ProjectsToolbar
        projectMeta={projectMeta}
        busy={busy}
        onCreateProject={() => void createProject()}
        onOpenProject={() => void openProject()}
        onSaveAs={() => void saveProjectAs()}
        onImportJson={() => void importJson()}
        onExportJson={() => void exportJson()}
        onCreateScene={() => void createScene()}
        onCloneBoard={() => void cloneActiveBoard()}
        searchRef={searchRef}
      />

      {error ? (
        <div className="px-5 pt-4">
          <Panel className="flex items-center justify-between border-danger/50 bg-danger/10 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-red-100">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
            <Button variant="ghost" size="sm" onClick={dismissError}>
              Dismiss
            </Button>
          </Panel>
        </div>
      ) : null}

      <div
        className="grid h-[calc(100vh-81px)] gap-4 p-4"
        style={{
          gridTemplateColumns: `${leftCollapsed ? '56px' : '300px'} minmax(0,1fr)`,
        }}
      >
        {leftCollapsed ? (
          <CollapsedRail side="left" title="Filters" onExpand={() => setLeftCollapsed(false)} />
        ) : (
          <Panel className="min-h-0 overflow-hidden">
            <div className="flex items-center justify-end border-b border-border/90 px-3 py-2">
              <Button variant="ghost" size="sm" onClick={() => setLeftCollapsed(true)}>
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
            <FiltersSidebar
              boards={boards}
              scenes={scenes}
              tags={tags}
              activeBoardId={activeBoardId}
              onSelectBoard={setActiveBoard}
              onRenameBoard={(boardId, name) => void renameBoard(boardId, name)}
              onDuplicateBoard={(boardId) => void cloneBoard(boardId)}
            />
          </Panel>
        )}

        <div className="flex min-h-0 min-w-0 gap-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            <Panel className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant={workspaceMode === 'outline' ? 'accent' : 'ghost'}
                    size="sm"
                    onClick={() => setWorkspaceMode('outline')}
                  >
                    Outline Board
                  </Button>
                  <Button
                    variant={workspaceMode === 'bank' ? 'accent' : 'ghost'}
                    size="sm"
                    onClick={() => setWorkspaceMode('bank')}
                  >
                    Scene Bank
                  </Button>
                  <Button
                    variant={workspaceMode === 'notebook' ? 'accent' : 'ghost'}
                    size="sm"
                    onClick={() => setWorkspaceMode('notebook')}
                  >
                    <NotebookText className="h-4 w-4" />
                    Notebook
                  </Button>
                </div>
                <div className="h-6 w-px bg-border" />
                <div className="flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    View
                  </span>
                  <div className="relative">
                    <select
                      className="h-6 min-w-[112px] appearance-none bg-transparent py-0 pl-0 pr-6 text-sm font-medium text-foreground outline-none"
                      value={sceneDensity}
                      onChange={(event) => setSceneDensity(event.target.value as SceneDensity)}
                    >
                      <option value="table">Table</option>
                      <option value="compact">Compact</option>
                      <option value="detailed">Detailed</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted">{workspaceSummary}</div>
            </Panel>

            {projectMeta && activeBoard ? (
              workspaceMode === 'outline' ? (
                <OutlineWorkspace
                  board={activeBoard}
                  scenes={scenes}
                  filteredSceneIds={filteredSceneIds}
                  tags={tags}
                  density={sceneDensity}
                  selectedSceneId={selectedSceneId}
                  selectedBoardItemId={selectedBoardItemId}
                  onSelect={(sceneId, boardItemId) => selectScene(sceneId, boardItemId)}
                  onOpenInspector={openInspector}
                  onToggleKeyScene={toggleKeyScene}
                  onDuplicateScene={(sceneId, afterItemId) => void duplicateScene(sceneId, { addToBoardAfterItemId: afterItemId ?? null })}
                  onAddScene={(sceneId, afterItemId) => void addSceneToActiveBoard(sceneId, afterItemId)}
                  onAddBlock={(kind, afterItemId) => void addBlockToActiveBoard(kind, afterItemId)}
                  onDuplicateBlock={(itemId) => void duplicateBoardItem(itemId)}
                  onRemoveBoardItem={(itemId) => void removeBoardItem(itemId)}
                  onReorder={(itemIds) => void reorderActiveBoard(itemIds)}
                />
              ) : workspaceMode === 'notebook' ? (
                <NotebookEditor
                  notebook={notebook}
                  onChange={updateNotebookDraft}
                  onSave={(content) => void persistNotebook(content)}
                />
              ) : (
                <SceneBankView
                  scenes={filteredScenes}
                  tags={tags}
                  board={activeBoard}
                  density={sceneDensity}
                  selectedSceneId={selectedSceneId}
                  selectedSceneIds={selectedSceneIds}
                  onSelect={(sceneId) => selectScene(sceneId)}
                  onToggleSelection={toggleSceneSelection}
                  onSelectAllVisible={setSceneSelection}
                  onClearSelection={clearSceneSelection}
                  onOpenInspector={openInspector}
                  onToggleKeyScene={toggleKeyScene}
                  onDuplicate={(sceneId) => void duplicateScene(sceneId)}
                  onDelete={(sceneId) => void deleteScene(sceneId)}
                  onAdd={(sceneId) => void addSceneToActiveBoard(sceneId, selectedBoardItemId)}
                />
              )
            ) : (
              <WelcomePanel
                onCreate={() => void createProject()}
                onOpen={() => void openProject()}
              />
            )}
          </div>

          {!rightCollapsed ? (
            <ResizeHandle
              label="Resize inspector"
              active={inspectorResize.isResizing}
              onPointerDown={inspectorResize.startResize(-1)}
            />
          ) : null}

          {rightCollapsed ? (
            <CollapsedRail side="right" title="Inspector" onExpand={() => setRightCollapsed(false)} />
          ) : (
            <div className="min-h-0 shrink-0 overflow-hidden" style={{ width: inspectorResize.size }}>
              <div className="mb-2 flex items-center justify-end">
                <Button variant="ghost" size="sm" onClick={() => setRightCollapsed(true)}>
                  <PanelRightClose className="h-4 w-4" />
                </Button>
              </div>
              {selectedBlock ? (
                <BoardItemInspector
                  key={selectedBlock.id}
                  item={selectedBlock}
                  onSave={(item) => void persistBoardItemDraft(item)}
                  onDelete={(itemId) => void removeBoardItem(itemId)}
                />
              ) : multiSelectedSceneCount > 1 ? (
                <BulkSceneInspector
                  key={`bulk-${selectedSceneIds.join('-')}`}
                  count={multiSelectedSceneCount}
                  onApply={(input) =>
                    void bulkUpdateScenes({
                      sceneIds: selectedSceneIds,
                      ...input,
                    })
                  }
                  onClear={clearSceneSelection}
                />
              ) : (
                <SceneInspector
                  key={selectedSceneId ?? 'empty'}
                  scene={selectedSceneId ? selectedScene ?? null : null}
                  tags={tags}
                  onSave={(scene) => void persistSceneDraft(scene)}
                  onDelete={(sceneId) => void deleteScene(sceneId)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function matchesFilters(scene: Scene, filters: ReturnType<typeof useFilterStore.getState>) {
  const query = filters.search.trim().toLowerCase()
  const haystack = [
    scene.title,
    scene.synopsis,
    scene.notes,
    scene.location,
    scene.category,
    scene.function,
    scene.sourceReference,
    scene.characters.join(' '),
  ]
    .join(' ')
    .toLowerCase()

  if (query && !haystack.includes(query)) return false
  if (filters.onlyKeyScenes && !scene.isKeyScene) return false
  if (filters.selectedStatuses.length > 0 && !filters.selectedStatuses.includes(scene.status)) return false
  if (filters.selectedColors.length > 0 && !filters.selectedColors.includes(scene.color)) return false
  if (filters.selectedCategories.length > 0 && !filters.selectedCategories.includes(scene.category)) return false
  if (filters.selectedTagIds.length > 0 && !filters.selectedTagIds.every((tagId) => scene.tagIds.includes(tagId))) {
    return false
  }

  return true
}

function WelcomePanel({ onCreate, onOpen }: { onCreate(): void; onOpen(): void }) {
  return (
    <Panel className="flex h-full items-center justify-center px-8">
      <div className="max-w-xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10">
          <Film className="h-8 w-8 text-accent" />
        </div>
        <div className="mt-6 font-display text-3xl font-semibold text-foreground">
          Structure your documentary scene by scene
        </div>
        <div className="mt-3 text-base leading-7 text-muted">
          Create a local project file, build your scene bank, and drag scenes into the outline as you shape the film.
        </div>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="accent" onClick={onCreate}>
            Create Project
          </Button>
          <Button onClick={onOpen}>Open Project</Button>
        </div>
      </div>
    </Panel>
  )
}

function CollapsedRail({
  side,
  title,
  onExpand,
}: {
  side: 'left' | 'right'
  title: string
  onExpand(): void
}) {
  return (
    <Panel className="flex h-full flex-col items-center gap-3 px-2 py-3">
      <Button variant="ghost" size="sm" onClick={onExpand}>
        {side === 'left' ? <PanelLeftOpen className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
      </Button>
      <div
        className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        {title}
      </div>
    </Panel>
  )
}

function ResizeHandle({
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
      <span className={`h-full w-px rounded-full bg-border transition ${active ? 'bg-accent' : 'group-hover:bg-accent/70'}`} />
      <GripVertical className="pointer-events-none absolute h-4 w-4 opacity-0 transition group-hover:opacity-100" />
    </button>
  )
}

function isTextInputTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  const tagName = target.tagName
  return (
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    target.isContentEditable
  )
}
