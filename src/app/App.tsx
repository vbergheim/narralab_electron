import type { PointerEventHandler } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  AlignJustify,
  Archive as ArchiveIcon,
  ChevronDown,
  Film,
  GripVertical,
  LayoutGrid,
  Loader2,
  Maximize2,
  MessageCircle,
  NotebookText,
  PanelLeftOpen,
  PanelRightOpen,
  Rows3,
  X,
} from 'lucide-react'

import { FiltersSidebar } from '@/features/filters/filters-sidebar'
import { ArchiveWorkspace } from '@/features/archive/archive-workspace'
import { OutlineWorkspace } from '@/features/boards/outline-workspace'
import { ConsultantWorkspace } from '@/features/consultant/consultant-workspace'
import { BoardInspector } from '@/features/inspector/board-inspector'
import { BoardItemInspector } from '@/features/inspector/board-item-inspector'
import { BulkSceneInspector } from '@/features/inspector/bulk-scene-inspector'
import { SceneInspector } from '@/features/inspector/scene-inspector'
import { NotebookEditor } from '@/features/notebook/notebook-editor'
import { ProjectsToolbar } from '@/features/projects/projects-toolbar'
import { SceneBankView } from '@/features/scenes/scene-bank-view'
import { SettingsWorkspace } from '@/features/settings/settings-workspace'
import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { Panel } from '@/components/ui/panel'
import { usePanelResize } from '@/hooks/use-panel-resize'
import { cn } from '@/lib/cn'
import { nextKeyRating } from '@/lib/scene-rating'
import { useAppStore } from '@/stores/app-store'
import { useFilterStore } from '@/stores/filter-store'
import { isTextBoardItem } from '@/types/board'
import type { BoardViewMode } from '@/types/board'
import type { SavedWindowLayout, WindowWorkspace } from '@/types/ai'
import type { WindowContext } from '@/types/project'
import type { Scene } from '@/types/scene'
import type { SceneDensity } from '@/types/view'

const workspaceTabs = [
  { value: 'outline', label: 'Outline Board', shortLabel: 'Outline', icon: Rows3 },
  { value: 'bank', label: 'Scene Bank', shortLabel: 'Bank', icon: LayoutGrid },
  { value: 'notebook', label: 'Notebook', shortLabel: 'Notebook', icon: NotebookText },
  { value: 'archive', label: 'Archive', shortLabel: 'Archive', icon: ArchiveIcon },
] as const

export function App() {
  const searchRef = useRef<HTMLInputElement | null>(null)
  const viewButtonRef = useRef<HTMLButtonElement | null>(null)
  const [leftCollapsed, setLeftCollapsed] = useState(false)
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [consultantDockOpen, setConsultantDockOpen] = useState(false)
  const [sceneDensity, setSceneDensity] = useState<SceneDensity>('compact')
  const [boardViewMode, setBoardViewMode] = useState<BoardViewMode>('outline')
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [viewMenuPosition, setViewMenuPosition] = useState({ x: 0, y: 0 })
  const [windowContext, setWindowContext] = useState<WindowContext | null>(null)
  const [savedLayouts, setSavedLayouts] = useState<SavedWindowLayout[]>([])
  const [outlineImmersive, setOutlineImmersive] = useState(false)
  const inspectorResize = usePanelResize({ initial: 420, min: 320, max: 620 })
  const {
    ready,
    busy,
    consultantBusy,
    error,
    projectMeta,
    projectSettings,
    appSettings,
    notebook,
    archiveFolders,
    archiveItems,
    scenes,
    sceneFolders,
    boards,
    boardFolders,
    blockTemplates,
    tags,
    activeBoardId,
    selectedBoardId,
    selectedSceneId,
    selectedSceneIds,
    selectedBoardItemId,
    selectedArchiveFolderId,
    consultantMessages,
    consultantContextMode,
    workspaceMode,
    applyGlobalUiState,
    updateAppSettings,
    updateProjectSettings,
    sendConsultantMessage,
    setConsultantContextMode,
    clearConsultantConversation,
    initialize,
    createArchiveFolder,
    updateArchiveFolder,
    deleteArchiveFolder,
    addArchiveFiles,
    moveArchiveItem,
    deleteArchiveItem,
    openArchiveItem,
    revealArchiveItem,
    createProject,
    openProject,
    saveProjectAs,
    importJson,
    exportJson,
    exportActiveBoardScript,
    createScene,
    createSceneBeat,
    createSceneFolder,
    deleteSceneBeat,
    updateSceneFolder,
    reorderSceneBeats,
    deleteSceneFolder,
    moveScenesToFolder,
    reorderScenes,
    createBoard,
    createBoardFolder,
    updateBoardFolder,
    deleteBoardFolder,
    deleteBoard,
    deleteScene,
    deleteScenes,
    persistSceneDraft,
    updateSceneBeat,
    bulkUpdateScenes,
    persistBoardItemDraft,
    updateNotebookDraft,
    persistNotebook,
    duplicateScene,
    openBoardInspector,
    selectScene,
    toggleSceneSelection,
    setSceneSelection,
    clearSceneSelection,
    setSelectedArchiveFolder,
    setWorkspaceMode,
    setActiveBoard,
    updateBoardDraft,
    reorderBoards,
    cloneBoard,
    moveBoard,
    addSceneToActiveBoard,
    addBlockToActiveBoard,
    addBlockTemplateToActiveBoard,
    saveBlockTemplate,
    deleteBlockTemplate,
    copyBlockToBoard,
    duplicateBoardItem,
    removeBoardItem,
    reorderActiveBoard,
    dismissError,
  } = useAppStore()

  const filters = useFilterStore()

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    const loadWindowState = async () => {
      const [context, layouts] = await Promise.all([
        window.docudoc.windows.getContext(),
        window.docudoc.windows.listLayouts(),
      ])
      setWindowContext(context)
      setSavedLayouts(layouts)
      if (context.role === 'detached') {
        setSceneDensity(context.sceneDensity)
        setBoardViewMode(normalizeBoardViewMode(context.viewMode))
      }
    }

    void loadWindowState()

    const dispose = window.docudoc.windows.subscribe((event) => {
      if (event.type === 'project-changed') {
        void initialize()
        void window.docudoc.windows.listLayouts().then(setSavedLayouts)
        return
      }

      if (event.type === 'global-ui-state') {
        applyGlobalUiState(event.payload)
        return
      }

      if (
        event.type === 'window-context' &&
        event.payload.windowId === windowContext?.windowId &&
        event.payload.role === 'detached'
      ) {
        setWindowContext(event.payload)
        setSceneDensity(event.payload.sceneDensity)
        setBoardViewMode(normalizeBoardViewMode(event.payload.viewMode))
      }
    })

    return dispose
  }, [applyGlobalUiState, initialize, windowContext?.windowId])

  useEffect(() => {
    const onFullscreenChange = () => {
      setOutlineImmersive(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  const detachedWorkspace =
    windowContext?.role === 'detached' && windowContext.workspace !== 'main'
      ? windowContext.workspace
      : null
  const boardIdForWindow =
    detachedWorkspace && windowContext?.boardId
      ? windowContext.boardId
      : activeBoardId

  useEffect(() => {
    const detachedWindowId = windowContext?.role === 'detached' ? windowContext.windowId : null
    const detachedContextBoardId = windowContext?.role === 'detached' ? windowContext.boardId : null
    const detachedContextViewMode = windowContext?.role === 'detached' ? windowContext.viewMode : null
    const detachedContextSceneDensity = windowContext?.role === 'detached' ? windowContext.sceneDensity : null

    if (!detachedWindowId) {
      return
    }

    if (
      detachedContextBoardId === boardIdForWindow &&
      detachedContextViewMode === boardViewMode &&
      detachedContextSceneDensity === sceneDensity
    ) {
      return
    }

    void window.docudoc.windows.updateContext({
      boardId: boardIdForWindow,
      viewMode: normalizeBoardViewMode(boardViewMode),
      sceneDensity,
    })
  }, [
    boardIdForWindow,
    boardViewMode,
    sceneDensity,
    windowContext,
  ])

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

  const activeBoard = boards.find((board) => board.id === boardIdForWindow) ?? null
  const selectedBoard = boards.find((board) => board.id === selectedBoardId) ?? null

  const openInspector = (sceneId: string | null, boardItemId?: string | null) => {
    selectScene(sceneId, boardItemId ?? null)
    setRightCollapsed(false)
  }

  const openBoardDetails = (boardId: string) => {
    openBoardInspector(boardId)
    setRightCollapsed(false)
  }

  const toggleKeyScene = (scene: Scene) => {
    const tagNames = tags.filter((tag) => scene.tagIds.includes(tag.id)).map((tag) => tag.name)

    void persistSceneDraft({
      ...scene,
      keyRating: nextKeyRating(scene.keyRating),
      tagNames,
    })
  }

  const inlineUpdateScene = (sceneId: string, input: { title: string; synopsis: string }) => {
    const scene = scenes.find((entry) => entry.id === sceneId)
    if (!scene) {
      return
    }

    const tagNames = tags.filter((tag) => scene.tagIds.includes(tag.id)).map((tag) => tag.name)
    void persistSceneDraft({
      ...scene,
      title: input.title,
      synopsis: input.synopsis,
      tagNames,
    })
  }

  const inlineUpdateBlock = (itemId: string, input: { title: string; body: string }) => {
    void persistBoardItemDraft({
      id: itemId,
      title: input.title,
      body: input.body,
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
    workspaceMode === 'settings'
      ? `${appSettings.ai.provider === 'openai' ? 'OpenAI' : 'Gemini'} consultant settings`
      : workspaceMode === 'consultant'
        ? `${consultantMessages.length} messages in current conversation`
      : workspaceMode === 'archive'
        ? `${archiveItems.length} files in archive`
      : workspaceMode === 'notebook'
      ? notebook.updatedAt
        ? `Notebook saved ${new Date(notebook.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Project notebook'
      : activeBoard
        ? `${activeBoard.items.length} rows in active outline`
        : 'No board selected'
  const showDensityControl = workspaceMode === 'outline' || workspaceMode === 'bank'
  const showInspector = workspaceMode !== 'consultant' && workspaceMode !== 'settings' && workspaceMode !== 'archive'
  const densityOption = densityOptions.find((option) => option.value === sceneDensity) ?? densityOptions[1]
  const densityMenuItems = useMemo<ContextMenuItem[]>(
    () =>
      densityOptions.map((option) => ({
        label: option.label,
        onSelect: () => setSceneDensity(option.value),
      })),
    [],
  )
  const effectiveBoardViewMode = normalizeBoardViewMode(boardViewMode)
  const projectTitle = projectSettings?.title?.trim() || projectMeta?.name || 'DocuDoc'

  const addSceneToCurrentBoard = async (
    sceneId: string,
    afterItemId?: string | null,
    boardPosition?: { x: number; y: number } | null,
  ) => {
    const targetBoardId = boardIdForWindow
    if (!targetBoardId) {
      return null
    }

    if (targetBoardId === activeBoardId) {
      return addSceneToActiveBoard(sceneId, afterItemId, boardPosition)
    }

    const result = await window.docudoc.boards.addScene(targetBoardId, sceneId, afterItemId, boardPosition)
    await initialize()
    selectScene(sceneId, result.item.id)
    return result
  }

  const saveCurrentLayout = async () => {
    const name = window.prompt('Layout name')
    if (!name?.trim()) {
      return
    }
    const layout = await window.docudoc.windows.saveLayout(name.trim())
    setSavedLayouts((current) => [...current.filter((entry) => entry.id !== layout.id), layout])
  }

  const applyLayout = async (layoutId: string) => {
    await window.docudoc.windows.applyLayout(layoutId)
    setSavedLayouts(await window.docudoc.windows.listLayouts())
  }

  const deleteLayout = async (layoutId: string) => {
    setSavedLayouts(await window.docudoc.windows.deleteLayout(layoutId))
  }

  const openWorkspaceWindow = async (workspace: WindowWorkspace) => {
    await window.docudoc.windows.openWorkspace(workspace, {
      boardId: activeBoardId,
      viewMode: effectiveBoardViewMode,
      sceneDensity,
    })
  }
  const toggleOutlineImmersive = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }

    await document.documentElement.requestFullscreen()
  }
  const inspectorContent = selectedBlock ? (
    <BoardItemInspector
      key={selectedBlock.id}
      item={selectedBlock}
      onCollapse={() => setRightCollapsed(true)}
      onSave={(item) => void persistBoardItemDraft(item)}
      onSaveTemplate={(input) => void saveBlockTemplate(input)}
      onDelete={(itemId) => void removeBoardItem(itemId)}
    />
  ) : selectedBoard ? (
    <BoardInspector
      key={selectedBoard.id}
      board={selectedBoard}
      onCollapse={() => setRightCollapsed(true)}
      onSave={(board) => void updateBoardDraft(board)}
    />
  ) : multiSelectedSceneCount > 1 ? (
    <BulkSceneInspector
      key={`bulk-${selectedSceneIds.join('-')}`}
      count={multiSelectedSceneCount}
      onCollapse={() => setRightCollapsed(true)}
      onApply={(input) =>
        void bulkUpdateScenes({
          sceneIds: selectedSceneIds,
          ...input,
        })
      }
      onDelete={() => void deleteScenes(selectedSceneIds)}
      onClear={clearSceneSelection}
    />
  ) : (
    <SceneInspector
      key={selectedSceneId ?? 'empty'}
      scene={selectedSceneId ? selectedScene ?? null : null}
      tags={tags}
      onCollapse={() => setRightCollapsed(true)}
      onSave={(scene) => void persistSceneDraft(scene)}
      onCreateBeat={(sceneId, afterBeatId) => void createSceneBeat(sceneId, afterBeatId)}
      onUpdateBeat={(input) => void updateSceneBeat(input)}
      onDeleteBeat={(beatId) => void deleteSceneBeat(beatId)}
      onReorderBeats={(sceneId, beatIds) => void reorderSceneBeats(sceneId, beatIds)}
      onDelete={(sceneId) => void deleteScene(sceneId)}
    />
  )

  const boardBlockKindsForProject = useMemo(() => {
    const enabled = projectSettings?.enabledBlockKinds ?? ['chapter', 'voiceover', 'narration', 'text-card', 'note']
    const order = projectSettings?.blockKindOrder ?? enabled
    return order.filter((kind) => enabled.includes(kind))
  }, [projectSettings])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    )
  }

  if (detachedWorkspace) {
    return (
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#1a1f2d_0%,#10131c_32%,#0b0d12_100%)] text-foreground">
        {!outlineImmersive ? (
          <div className="app-drag flex items-center justify-between border-b border-border/90 px-5 py-3 pl-24">
            <div>
              <div className="font-display text-lg font-semibold text-foreground">{projectTitle}</div>
              <div className="text-sm text-muted">{detachedLabel(detachedWorkspace)}</div>
            </div>
            <div className="app-no-drag flex items-center gap-2">
              {detachedWorkspace === 'outline' ? (
                <Button variant="ghost" size="sm" onClick={() => void toggleOutlineImmersive()} title="Fullscreen focus" aria-label="Fullscreen focus">
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden lg:inline">Focus</span>
                </Button>
              ) : null}
              {detachedWorkspace === 'outline' || detachedWorkspace === 'bank' ? (
                <button
                  ref={viewButtonRef}
                  type="button"
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border bg-panel px-2.5 text-sm font-medium text-foreground transition hover:bg-panelMuted lg:px-3"
                  onClick={() => {
                    const rect = viewButtonRef.current?.getBoundingClientRect()
                    if (!rect) return
                    setViewMenuPosition({ x: rect.left, y: rect.bottom + 8 })
                    setViewMenuOpen(true)
                  }}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">View</span>
                  <densityOption.icon className="h-4 w-4" />
                  <ChevronDown className="h-4 w-4 text-muted" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className={cn('min-h-0 flex-1 overflow-hidden', outlineImmersive ? 'p-0' : 'p-4')}>
          {!projectMeta ? (
            <WelcomePanel onCreate={() => void createProject()} onOpen={() => void openProject()} />
          ) : detachedWorkspace === 'outline' && activeBoard ? (
            <OutlineWorkspace
              board={activeBoard}
              allBoards={boards}
              scenes={scenes}
              sceneFolders={sceneFolders}
              blockTemplates={blockTemplates}
              filteredSceneIds={filteredSceneIds}
              tags={tags}
              density={sceneDensity}
              viewMode={effectiveBoardViewMode}
              availableBlockKinds={boardBlockKindsForProject}
              immersive={outlineImmersive}
              onToggleImmersive={() => void toggleOutlineImmersive()}
              onChangeViewMode={(mode) => setBoardViewMode(normalizeBoardViewMode(mode))}
              selectedSceneId={selectedSceneId}
              selectedBoardItemId={selectedBoardItemId}
              onSelect={(sceneId, boardItemId) => selectScene(sceneId, boardItemId)}
              onOpenInspector={openInspector}
              onToggleKeyScene={toggleKeyScene}
              onDuplicateScene={(sceneId, afterItemId) =>
                void duplicateScene(sceneId, { addToBoardAfterItemId: afterItemId ?? null })}
              onAddScene={(sceneId, afterItemId, boardPosition) => void addSceneToCurrentBoard(sceneId, afterItemId, boardPosition)}
              onAddBlock={(kind, afterItemId) => void addBlockToActiveBoard(kind, afterItemId)}
              onAddTemplate={(templateId, afterItemId) => void addBlockTemplateToActiveBoard(templateId, afterItemId)}
              onSaveTemplate={(input) => void saveBlockTemplate(input)}
              onDeleteTemplate={(templateId) => void deleteBlockTemplate(templateId)}
              onCopyBlockToBoard={(itemId, boardId) => void copyBlockToBoard(itemId, boardId)}
              onDuplicateBlock={(itemId) => void duplicateBoardItem(itemId)}
              onRemoveBoardItem={(itemId) => void removeBoardItem(itemId)}
              onReorder={(itemIds) => void reorderActiveBoard(itemIds)}
              onUpdateItemPosition={(itemId, boardX, boardY) => void persistBoardItemDraft({ id: itemId, boardX, boardY })}
              onInlineUpdateScene={inlineUpdateScene}
              onInlineUpdateBlock={inlineUpdateBlock}
              onCreateBeat={(sceneId, afterBeatId) => void createSceneBeat(sceneId, afterBeatId)}
              onUpdateBeat={(input) => void updateSceneBeat(input)}
              onDeleteBeat={(beatId) => void deleteSceneBeat(beatId)}
              onReorderBeats={(sceneId, beatIds) => void reorderSceneBeats(sceneId, beatIds)}
            />
          ) : detachedWorkspace === 'bank' && activeBoard ? (
            <SceneBankView
              scenes={filteredScenes}
              allScenes={scenes}
              folders={sceneFolders}
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
              onInlineUpdateScene={inlineUpdateScene}
              onToggleKeyScene={toggleKeyScene}
              onCreateScene={() => void createScene()}
              onCreateFolder={(name, parentPath) => void createSceneFolder(name, parentPath)}
              onUpdateFolder={(currentPath, input) => void updateSceneFolder(currentPath, input)}
              onDeleteFolder={(currentPath) => void deleteSceneFolder(currentPath)}
              onMoveToFolder={(sceneIds, folder) => void moveScenesToFolder(sceneIds, folder)}
              onReorderScenes={(sceneIds) => void reorderScenes(sceneIds)}
              onDuplicate={(sceneId) => void duplicateScene(sceneId)}
              onDelete={(sceneId) => void deleteScene(sceneId)}
              onDeleteSelected={() => void deleteScenes(selectedSceneIds)}
              onAdd={(sceneId) => void addSceneToCurrentBoard(sceneId, selectedBoardItemId)}
            />
          ) : detachedWorkspace === 'notebook' ? (
            <NotebookEditor notebook={notebook} onChange={updateNotebookDraft} onSave={(content) => void persistNotebook(content)} />
          ) : detachedWorkspace === 'archive' ? (
            <ArchiveWorkspace
              folders={archiveFolders}
              items={archiveItems}
              selectedFolderId={selectedArchiveFolderId}
              onSelectFolder={setSelectedArchiveFolder}
              onCreateFolder={(name, parentId) => void createArchiveFolder(name, parentId)}
              onUpdateFolder={(folderId, input) => void updateArchiveFolder(folderId, input)}
              onDeleteFolder={(folderId) => void deleteArchiveFolder(folderId)}
              onAddFiles={(filePaths, folderId) => void addArchiveFiles(filePaths, folderId)}
              onMoveItem={(itemId, folderId) => void moveArchiveItem(itemId, folderId)}
              onOpenItem={(itemId) => void openArchiveItem(itemId)}
              onRevealItem={(itemId) => void revealArchiveItem(itemId)}
              onDeleteItem={(itemId) => void deleteArchiveItem(itemId)}
            />
          ) : detachedWorkspace === 'inspector' ? (
            <Panel className="h-full overflow-y-auto overscroll-contain">{inspectorContent}</Panel>
          ) : null}
        </div>
        <ContextMenu
          open={viewMenuOpen}
          x={viewMenuPosition.x}
          y={viewMenuPosition.y}
          items={densityMenuItems}
          onClose={() => setViewMenuOpen(false)}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#1a1f2d_0%,#10131c_32%,#0b0d12_100%)] text-foreground">
      <ProjectsToolbar
        projectMeta={projectMeta}
        projectTitle={projectTitle}
        busy={busy}
        savedLayouts={savedLayouts}
        onCreateProject={() => void createProject()}
        onOpenProject={() => void openProject()}
        onSaveAs={() => void saveProjectAs()}
        onImportJson={() => void importJson()}
        onExportJson={() => void exportJson()}
        onExportScript={(format) => void exportActiveBoardScript(format)}
        onOpenSettings={() => setWorkspaceMode('settings')}
        onOpenWorkspaceWindow={(workspace) => void openWorkspaceWindow(workspace)}
        onSaveLayout={() => void saveCurrentLayout()}
        onApplyLayout={(layoutId) => void applyLayout(layoutId)}
        onDeleteLayout={(layoutId) => void deleteLayout(layoutId)}
        searchRef={searchRef}
      />

      <div className="flex h-[calc(100vh-81px)] flex-col gap-4 p-4">
        {error ? (
          <Panel className="flex items-center justify-between border-danger/50 bg-danger/10 px-4 py-3 text-sm">
            <div className="flex items-center gap-2 text-red-100">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
            <Button variant="ghost" size="sm" onClick={dismissError}>
              Dismiss
            </Button>
          </Panel>
        ) : null}

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
                    onClick={() => setWorkspaceMode(tab.value)}
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
                    onClick={() => {
                      const rect = viewButtonRef.current?.getBoundingClientRect()
                      if (!rect) return
                      setViewMenuPosition({ x: rect.left, y: rect.bottom + 8 })
                      setViewMenuOpen(true)
                    }}
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

        <div
          className="grid min-h-0 flex-1 gap-4"
          style={{
            gridTemplateColumns: `${leftCollapsed ? '56px' : '300px'} minmax(0,1fr)`,
          }}
        >
        {leftCollapsed ? (
          <CollapsedRail side="left" title="Filters" onExpand={() => setLeftCollapsed(false)} />
        ) : (
          <Panel className="min-h-0 overflow-hidden">
            <FiltersSidebar
              boards={boards}
              folders={boardFolders}
              scenes={scenes}
              tags={tags}
              activeBoardId={activeBoardId}
              onCollapse={() => setLeftCollapsed(true)}
              onSelectBoard={setActiveBoard}
              onOpenBoardInspector={openBoardDetails}
              onInlineUpdateBoard={(boardId, input) => void updateBoardDraft({ id: boardId, ...input })}
              onDuplicateBoard={(boardId) => void cloneBoard(boardId)}
              onCreateBoard={(folder) => void createBoard('New Board', folder)}
              onCreateFolder={(name, parentPath) => void createBoardFolder(name, parentPath)}
              onUpdateFolder={(currentPath, input) => void updateBoardFolder(currentPath, input)}
              onDeleteFolder={(currentPath) => void deleteBoardFolder(currentPath)}
              onDeleteBoard={(boardId) => void deleteBoard(boardId)}
              onMoveBoard={(boardId, folder, beforeBoardId) => void moveBoard(boardId, folder, beforeBoardId)}
              onReorderBoards={(boardIds) => void reorderBoards(boardIds)}
            />
          </Panel>
        )}

        <div className="flex min-h-0 min-w-0 gap-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            {workspaceMode === 'settings' ? (
              <SettingsWorkspace
                settings={appSettings}
                projectSettings={projectSettings}
                busy={busy}
                onSaveApp={(input) => void updateAppSettings(input)}
                onSaveProject={(input) => void updateProjectSettings(input)}
              />
            ) : workspaceMode === 'consultant' ? (
              <ConsultantWorkspace
                settings={appSettings}
                messages={consultantMessages}
                busy={consultantBusy}
                activeBoardName={activeBoard?.name ?? null}
                contextMode={consultantContextMode}
                onChangeContextMode={setConsultantContextMode}
                onSend={(content) => void sendConsultantMessage(content)}
                onClear={clearConsultantConversation}
                onOpenSettings={() => setWorkspaceMode('settings')}
              />
            ) : workspaceMode === 'archive' && projectMeta ? (
              <ArchiveWorkspace
                folders={archiveFolders}
                items={archiveItems}
                selectedFolderId={selectedArchiveFolderId}
                onSelectFolder={setSelectedArchiveFolder}
                onCreateFolder={(name, parentId) => void createArchiveFolder(name, parentId)}
                onUpdateFolder={(folderId, input) => void updateArchiveFolder(folderId, input)}
                onDeleteFolder={(folderId) => void deleteArchiveFolder(folderId)}
                onAddFiles={(filePaths, folderId) => void addArchiveFiles(filePaths, folderId)}
                onMoveItem={(itemId, folderId) => void moveArchiveItem(itemId, folderId)}
                onOpenItem={(itemId) => void openArchiveItem(itemId)}
                onRevealItem={(itemId) => void revealArchiveItem(itemId)}
                onDeleteItem={(itemId) => void deleteArchiveItem(itemId)}
              />
            ) : projectMeta && activeBoard ? (
              workspaceMode === 'outline' ? (
                <OutlineWorkspace
                  board={activeBoard}
                  allBoards={boards}
                  scenes={scenes}
                  sceneFolders={sceneFolders}
                  blockTemplates={blockTemplates}
                  filteredSceneIds={filteredSceneIds}
                  tags={tags}
                  density={sceneDensity}
                      viewMode={effectiveBoardViewMode}
                  availableBlockKinds={boardBlockKindsForProject}
                  onChangeViewMode={(mode) => setBoardViewMode(normalizeBoardViewMode(mode))}
                  selectedSceneId={selectedSceneId}
                  selectedBoardItemId={selectedBoardItemId}
                  onSelect={(sceneId, boardItemId) => selectScene(sceneId, boardItemId)}
                  onOpenInspector={openInspector}
                  onToggleKeyScene={toggleKeyScene}
                  onDuplicateScene={(sceneId, afterItemId) => void duplicateScene(sceneId, { addToBoardAfterItemId: afterItemId ?? null })}
                  onAddScene={(sceneId, afterItemId, boardPosition) => void addSceneToCurrentBoard(sceneId, afterItemId, boardPosition)}
                  onAddBlock={(kind, afterItemId) => void addBlockToActiveBoard(kind, afterItemId)}
                  onAddTemplate={(templateId, afterItemId) => void addBlockTemplateToActiveBoard(templateId, afterItemId)}
                  onSaveTemplate={(input) => void saveBlockTemplate(input)}
                  onDeleteTemplate={(templateId) => void deleteBlockTemplate(templateId)}
                  onCopyBlockToBoard={(itemId, boardId) => void copyBlockToBoard(itemId, boardId)}
                  onDuplicateBlock={(itemId) => void duplicateBoardItem(itemId)}
                  onRemoveBoardItem={(itemId) => void removeBoardItem(itemId)}
                  onReorder={(itemIds) => void reorderActiveBoard(itemIds)}
                  onUpdateItemPosition={(itemId, boardX, boardY) => void persistBoardItemDraft({ id: itemId, boardX, boardY })}
                  onInlineUpdateScene={inlineUpdateScene}
                  onInlineUpdateBlock={inlineUpdateBlock}
                  onCreateBeat={(sceneId, afterBeatId) => void createSceneBeat(sceneId, afterBeatId)}
                  onUpdateBeat={(input) => void updateSceneBeat(input)}
                  onDeleteBeat={(beatId) => void deleteSceneBeat(beatId)}
                  onReorderBeats={(sceneId, beatIds) => void reorderSceneBeats(sceneId, beatIds)}
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
                  allScenes={scenes}
                  folders={sceneFolders}
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
                  onInlineUpdateScene={inlineUpdateScene}
                  onToggleKeyScene={toggleKeyScene}
                  onCreateScene={() => void createScene()}
                  onCreateFolder={(name, parentPath) => void createSceneFolder(name, parentPath)}
                  onUpdateFolder={(currentPath, input) => void updateSceneFolder(currentPath, input)}
                  onDeleteFolder={(currentPath) => void deleteSceneFolder(currentPath)}
                  onMoveToFolder={(sceneIds, folder) => void moveScenesToFolder(sceneIds, folder)}
                  onReorderScenes={(sceneIds) => void reorderScenes(sceneIds)}
                  onDuplicate={(sceneId) => void duplicateScene(sceneId)}
                  onDelete={(sceneId) => void deleteScene(sceneId)}
                  onDeleteSelected={() => void deleteScenes(selectedSceneIds)}
                  onAdd={(sceneId) => void addSceneToCurrentBoard(sceneId, selectedBoardItemId)}
                />
              )
            ) : (
              <WelcomePanel
                onCreate={() => void createProject()}
                onOpen={() => void openProject()}
              />
            )}
          </div>

          {showInspector && !rightCollapsed ? (
            <ResizeHandle
              label="Resize inspector"
              active={inspectorResize.isResizing}
              onPointerDown={inspectorResize.startResize(-1)}
            />
          ) : null}

          {showInspector && rightCollapsed ? (
            <CollapsedRail side="right" title="Inspector" onExpand={() => setRightCollapsed(false)} />
          ) : null}

          {showInspector && !rightCollapsed ? (
            <div className="min-h-0 shrink-0 overflow-hidden" style={{ width: inspectorResize.size }}>
              <Panel className="flex h-full flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-0">
                  {inspectorContent}
                </div>
              </Panel>
            </div>
          ) : null}
        </div>
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
        {consultantDockOpen ? (
          <div className="pointer-events-auto w-[min(440px,calc(100vw-2rem))]">
            <Panel className="h-[min(72vh,680px)] overflow-hidden shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-border/90 px-4 py-3">
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-muted">
                  Consultant
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setWorkspaceMode('consultant')}>
                    Full View
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConsultantDockOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="h-[calc(100%-57px)] p-3">
                <ConsultantWorkspace
                  key="consultant-dock"
                  settings={appSettings}
                  messages={consultantMessages}
                  busy={consultantBusy}
                  activeBoardName={activeBoard?.name ?? null}
                  contextMode={consultantContextMode}
                  compact
                  onChangeContextMode={setConsultantContextMode}
                  onSend={(content) => void sendConsultantMessage(content)}
                  onClear={clearConsultantConversation}
                  onOpenSettings={() => setWorkspaceMode('settings')}
                />
              </div>
            </Panel>
          </div>
        ) : null}

        <Button
          className="pointer-events-auto h-12 rounded-full px-4 shadow-2xl shadow-black/35"
          variant="accent"
          size="md"
          onClick={() => setConsultantDockOpen((current) => !current)}
        >
          <MessageCircle className="h-4 w-4" />
          Consultant
        </Button>
      </div>
      <ContextMenu
        open={viewMenuOpen}
        x={viewMenuPosition.x}
        y={viewMenuPosition.y}
        items={densityMenuItems}
        onClose={() => setViewMenuOpen(false)}
      />
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
  if (filters.onlyKeyScenes && scene.keyRating <= 0) return false
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

function detachedLabel(workspace: WindowWorkspace) {
  if (workspace === 'bank') return 'Scene Bank Window'
  if (workspace === 'inspector') return 'Inspector Window'
  if (workspace === 'notebook') return 'Notebook Window'
  if (workspace === 'archive') return 'Archive Window'
  return 'Outline Window'
}

const densityOptions: Array<{
  value: SceneDensity
  label: string
  icon: typeof Rows3
}> = [
  { value: 'table', label: 'Table', icon: AlignJustify },
  { value: 'compact', label: 'Compact', icon: Rows3 },
  { value: 'detailed', label: 'Detailed', icon: LayoutGrid },
]

function normalizeBoardViewMode(mode: BoardViewMode): BoardViewMode {
  return mode === 'timeline' ? 'outline' : mode
}
