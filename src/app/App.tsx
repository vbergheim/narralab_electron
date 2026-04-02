import type { PointerEventHandler } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  AlignJustify,
  Archive as ArchiveIcon,
  ChevronDown,
  GripVertical,
  LayoutGrid,
  Loader2,
  Maximize2,
  MessageCircle,
  Mic,
  NotebookText,
  PanelLeftOpen,
  PanelRightOpen,
  Rows3,
  X,
} from 'lucide-react'

import { BoardInspector } from '@/features/inspector/board-inspector'
import { BoardItemInspector } from '@/features/inspector/board-item-inspector'
import { BulkSceneInspector } from '@/features/inspector/bulk-scene-inspector'
import { SceneInspector } from '@/features/inspector/scene-inspector'
import { ProjectsToolbar } from '@/features/projects/projects-toolbar'
import { ConsultantWorkspace } from '@/features/consultant/consultant-workspace'
import type { SettingsTab } from '@/features/settings/settings-workspace'
import { DetachedWorkspacePanel, MainWorkspacePanel } from '@/app/app-workspace-panels'
import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { Panel } from '@/components/ui/panel'
import { usePanelResize } from '@/hooks/use-panel-resize'
import { cn } from '@/lib/cn'
import { nextKeyRating } from '@/lib/scene-rating'
import { normalizeBoardViewMode, useWindowRuntime } from '@/app/use-window-runtime'
import { useAppStore } from '@/stores/app-store'
import { useFilterStore } from '@/stores/filter-store'
import { isTextBoardItem } from '@/types/board'
import type { WindowWorkspace } from '@/types/ai'
import type { Scene } from '@/types/scene'
import type { SceneDensity } from '@/types/view'

const workspaceTabs = [
  { value: 'outline', label: 'Outline', shortLabel: 'Outline', icon: Rows3 },
  { value: 'bank', label: 'Scene Bank', shortLabel: 'Bank', icon: LayoutGrid },
  { value: 'notebook', label: 'Notebook', shortLabel: 'Notebook', icon: NotebookText },
  { value: 'archive', label: 'Archive', shortLabel: 'Archive', icon: ArchiveIcon },
  { value: 'transcribe', label: 'Transcribe', shortLabel: 'Transcribe', icon: Mic },
] as const

export function App() {
  const searchRef = useRef<HTMLInputElement | null>(null)
  const viewButtonRef = useRef<HTMLButtonElement | null>(null)
  const [rightCollapsed, setRightCollapsed] = useState(true)
  const [, setLeftCollapsed] = useState(false)
  const [settingsNavigate, setSettingsNavigate] = useState<{ tab: SettingsTab; requestId: number } | null>(null)
  const [consultantDockOpen, setConsultantDockOpen] = useState(false)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [viewMenuPosition, setViewMenuPosition] = useState({ x: 0, y: 0 })
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
    syncProjectChanges,
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
    importShootLog,
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
    addSceneToBoard,
    addBlockToBoard,
    addBlockTemplateToBoard,
    saveBlockTemplate,
    deleteBlockTemplate,
    copyBlockToBoard,
    duplicateBoardItem,
    removeBoardItem,
    reorderBoard,
    dismissError,
  } = useAppStore()

  const openAppSettings = useCallback(() => {
    setSettingsNavigate(null)
    setWorkspaceMode('settings')
  }, [setWorkspaceMode])

  const openAppSettingsTranscribe = useCallback(() => {
    setSettingsNavigate({ tab: 'transcribe', requestId: Date.now() })
    setWorkspaceMode('settings')
  }, [setWorkspaceMode])

  const filters = useFilterStore()

  useEffect(() => {
    void initialize()
  }, [initialize])

  const {
    boardIdForWindow,
    boardViewMode,
    detachedWorkspace,
    savedLayouts,
    sceneDensity,
    setBoardViewMode,
    setSavedLayouts,
    setSceneDensity,
    setWindowContext,
    windowContext,
  } = useWindowRuntime({
    ready,
    projectMetaPath: projectMeta?.path ?? null,
    defaultSceneDensity: appSettings.ui.defaultSceneDensity,
    defaultBoardView: projectSettings?.defaultBoardView ?? null,
    activeBoardId,
    applyGlobalUiState,
    syncProjectChanges,
  })

  useEffect(() => {
    const onFullscreenChange = () => {
      setOutlineImmersive(Boolean(document.fullscreenElement))
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

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

  const openBoardDetails = useCallback((boardId: string) => {
    openBoardInspector(boardId)
    setRightCollapsed(false)
  }, [openBoardInspector])

  const setBoardForCurrentWindow = useCallback((boardId: string) => {
    if (windowContext?.role === 'detached' && detachedWorkspace) {
      setWindowContext((current) =>
        current && current.role === 'detached'
          ? { ...current, boardId }
          : current,
      )
      void window.narralab.windows.updateContext({ boardId })
      return
    }

    setActiveBoard(boardId)
  }, [detachedWorkspace, setActiveBoard, setWindowContext, windowContext?.role])

  const openBoardDetailsForCurrentWindow = useCallback((boardId: string) => {
    if (windowContext?.role === 'detached' && detachedWorkspace) {
      setBoardForCurrentWindow(boardId)
      setRightCollapsed(false)
      return
    }

    openBoardDetails(boardId)
  }, [detachedWorkspace, openBoardDetails, setBoardForCurrentWindow, windowContext?.role])

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
      ? 'App, project and AI preferences'
      : workspaceMode === 'consultant'
        ? `${consultantMessages.length} messages in current conversation`
      : workspaceMode === 'archive'
        ? `${archiveItems.length} files in archive`
      : workspaceMode === 'board-manager'
        ? `${boards.length} boards, ${boardFolders.length} folders`
      : workspaceMode === 'transcribe'
        ? 'Local Whisper transcription'
      : workspaceMode === 'notebook'
      ? notebook.updatedAt
        ? `Notebook saved ${new Date(notebook.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Project notebook'
      : activeBoard
        ? `${activeBoard.items.length} rows in active outline`
        : 'No board selected'
  const showDensityControl = workspaceMode === 'outline' || workspaceMode === 'bank'
  const showInspector =
    workspaceMode !== 'consultant' &&
    workspaceMode !== 'settings' &&
    workspaceMode !== 'archive' &&
    workspaceMode !== 'board-manager' &&
    workspaceMode !== 'transcribe'
  const densityOption = densityOptions.find((option) => option.value === sceneDensity) ?? densityOptions[1]
  const densityMenuItems = useMemo<ContextMenuItem[]>(
    () =>
      densityOptions.map((option) => ({
        label: option.label,
        onSelect: () => setSceneDensity(option.value),
      })),
    [setSceneDensity],
  )
  const effectiveBoardViewMode = normalizeBoardViewMode(boardViewMode)
  const projectTitle = projectSettings?.title?.trim() || projectMeta?.name || 'NarraLab'

  const addSceneToCurrentBoard = async (
    sceneId: string,
    afterItemId?: string | null,
    boardPosition?: { x: number; y: number } | null,
  ) => {
    const targetBoardId = boardIdForWindow
    if (!targetBoardId) {
      return null
    }
    return addSceneToBoard(targetBoardId, sceneId, afterItemId, boardPosition)
  }

  const sendScenesToOpenOutline = useCallback(async (sceneIds: string[]) => {
    const uniqueSceneIds = [...new Set(sceneIds.filter(Boolean))]
    if (uniqueSceneIds.length === 0) {
      return
    }

    const contexts = await window.narralab.windows.listContexts()
    const outlineTargets = contexts.filter(
      (context) =>
        context.role === 'detached' &&
        context.workspace === 'outline' &&
        Boolean(context.boardId) &&
        context.windowId !== windowContext?.windowId,
    )

    const target = outlineTargets.at(-1)
    if (!target?.boardId) {
      window.alert('No detached outline window is open.')
      return
    }

    for (const sceneId of uniqueSceneIds) {
      await addSceneToBoard(target.boardId, sceneId)
    }

  }, [addSceneToBoard, windowContext?.windowId])

  const addBlockToCurrentBoard = useCallback((kind: import('@/types/board').BoardTextItemKind, afterItemId?: string | null) => {
    const targetBoardId = boardIdForWindow
    if (!targetBoardId) {
      return
    }

    void addBlockToBoard(targetBoardId, kind, afterItemId)
  }, [addBlockToBoard, boardIdForWindow])

  const addBlockTemplateToCurrentBoard = useCallback((templateId: string, afterItemId?: string | null) => {
    const targetBoardId = boardIdForWindow
    if (!targetBoardId) {
      return
    }

    void addBlockTemplateToBoard(targetBoardId, templateId, afterItemId)
  }, [addBlockTemplateToBoard, boardIdForWindow])

  const reorderCurrentBoard = useCallback((itemIds: string[]) => {
    const targetBoardId = boardIdForWindow
    if (!targetBoardId) {
      return
    }

    void reorderBoard(targetBoardId, itemIds)
  }, [boardIdForWindow, reorderBoard])

  const saveCurrentLayout = async () => {
    const name = window.prompt('Layout name')
    if (!name?.trim()) {
      return
    }
    const layout = await window.narralab.windows.saveLayout(name.trim())
    setSavedLayouts((current) => [...current.filter((entry) => entry.id !== layout.id), layout])
  }

  const applyLayout = async (layoutId: string) => {
    await window.narralab.windows.applyLayout(layoutId)
    setSavedLayouts(await window.narralab.windows.listLayouts())
  }

  const deleteLayout = async (layoutId: string) => {
    setSavedLayouts(await window.narralab.windows.deleteLayout(layoutId))
  }

  const openWorkspaceWindow = async (workspace: WindowWorkspace) => {
    await window.narralab.windows.openWorkspace(workspace, {
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
          <DetachedWorkspacePanel
            projectMeta={projectMeta}
            projectSettings={projectSettings}
            appSettings={appSettings}
            notebook={notebook}
            archiveFolders={archiveFolders}
            archiveItems={archiveItems}
            scenes={scenes}
            sceneFolders={sceneFolders}
            boards={boards}
            boardFolders={boardFolders}
            blockTemplates={blockTemplates}
            tags={tags}
            activeBoardId={activeBoardId}
            activeBoard={activeBoard}
            selectedSceneId={selectedSceneId}
            selectedSceneIds={selectedSceneIds}
            selectedBoardItemId={selectedBoardItemId}
            selectedArchiveFolderId={selectedArchiveFolderId}
            filteredScenes={filteredScenes}
            filteredSceneIds={filteredSceneIds}
            sceneDensity={sceneDensity}
            boardViewMode={effectiveBoardViewMode}
            boardBlockKindsForProject={boardBlockKindsForProject}
            inspectorContent={inspectorContent}
            detachedWorkspace={detachedWorkspace}
            outlineImmersive={outlineImmersive}
            onCreateProject={() => void createProject()}
            onOpenProject={() => void openProject()}
            onUpdateAppSettings={updateAppSettings}
            onUpdateProjectSettings={updateProjectSettings}
            onUpdateNotebookDraft={updateNotebookDraft}
            onPersistNotebook={persistNotebook}
            onSetSelectedArchiveFolder={setSelectedArchiveFolder}
            onCreateArchiveFolder={createArchiveFolder}
            onUpdateArchiveFolder={updateArchiveFolder}
            onDeleteArchiveFolder={deleteArchiveFolder}
            onAddArchiveFiles={addArchiveFiles}
            onMoveArchiveItem={moveArchiveItem}
            onOpenArchiveItem={openArchiveItem}
            onRevealArchiveItem={revealArchiveItem}
            onDeleteArchiveItem={deleteArchiveItem}
            onSelectBoardForWindow={setBoardForCurrentWindow}
            onOpenBoardDetailsForWindow={openBoardDetailsForCurrentWindow}
            onUpdateBoardDraft={updateBoardDraft}
            onCloneBoard={cloneBoard}
            onCreateBoard={createBoard}
            onCreateBoardFolder={createBoardFolder}
            onUpdateBoardFolder={updateBoardFolder}
            onDeleteBoardFolder={deleteBoardFolder}
            onDeleteBoard={deleteBoard}
            onMoveBoard={moveBoard}
            onReorderBoards={reorderBoards}
            onSelectScene={selectScene}
            onOpenInspector={openInspector}
            onCreateScene={createScene}
            onToggleSceneSelection={toggleSceneSelection}
            onSetSceneSelection={setSceneSelection}
            onClearSceneSelection={clearSceneSelection}
            onCreateSceneFolder={createSceneFolder}
            onUpdateSceneFolder={updateSceneFolder}
            onDeleteSceneFolder={deleteSceneFolder}
            onMoveScenesToFolder={moveScenesToFolder}
            onToggleKeyScene={toggleKeyScene}
            onDuplicateScene={(sceneId, afterItemId) => duplicateScene(sceneId, { addToBoardAfterItemId: afterItemId ?? null })}
            onDeleteScene={deleteScene}
            onDeleteSelectedScenes={() => deleteScenes(selectedSceneIds)}
            onAddSceneToCurrentBoard={addSceneToCurrentBoard}
            onAddBlockToCurrentBoard={addBlockToCurrentBoard}
            onAddBlockTemplateToCurrentBoard={addBlockTemplateToCurrentBoard}
            onSaveBlockTemplate={saveBlockTemplate}
            onDeleteBlockTemplate={deleteBlockTemplate}
            onCopyBlockToBoard={copyBlockToBoard}
            onDuplicateBoardItem={duplicateBoardItem}
            onRemoveBoardItem={removeBoardItem}
            onReorderCurrentBoard={reorderCurrentBoard}
            onPersistBoardItemDraft={persistBoardItemDraft}
            onInlineUpdateScene={inlineUpdateScene}
            onInlineUpdateBlock={inlineUpdateBlock}
            onCreateSceneBeat={createSceneBeat}
            onUpdateSceneBeat={updateSceneBeat}
            onDeleteSceneBeat={deleteSceneBeat}
            onReorderSceneBeats={reorderSceneBeats}
            onSendScenesToOpenOutline={sendScenesToOpenOutline}
            onOpenTranscribeSettings={openAppSettingsTranscribe}
            onToggleOutlineImmersive={toggleOutlineImmersive}
            onChangeBoardViewMode={(mode) => setBoardViewMode(normalizeBoardViewMode(mode))}
          />
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
        onImportShootLog={() => void importShootLog()}
        onExportJson={() => void exportJson()}
        onExportScript={(format) => void exportActiveBoardScript(format)}
        onOpenSettings={openAppSettings}
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

        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            <MainWorkspacePanel
              workspaceMode={workspaceMode}
              projectMeta={projectMeta}
              projectSettings={projectSettings}
              appSettings={appSettings}
              notebook={notebook}
              archiveFolders={archiveFolders}
              archiveItems={archiveItems}
              scenes={scenes}
              sceneFolders={sceneFolders}
              boards={boards}
              boardFolders={boardFolders}
              blockTemplates={blockTemplates}
              tags={tags}
              activeBoardId={activeBoardId}
              activeBoard={activeBoard}
              selectedSceneId={selectedSceneId}
              selectedSceneIds={selectedSceneIds}
              selectedBoardItemId={selectedBoardItemId}
              selectedArchiveFolderId={selectedArchiveFolderId}
              consultantBusy={consultantBusy}
              consultantMessages={consultantMessages}
              consultantContextMode={consultantContextMode}
              filteredScenes={filteredScenes}
              filteredSceneIds={filteredSceneIds}
              sceneDensity={sceneDensity}
              boardViewMode={effectiveBoardViewMode}
              boardBlockKindsForProject={boardBlockKindsForProject}
              busy={busy}
              settingsNavigate={settingsNavigate}
              inspectorContent={inspectorContent}
              onCreateProject={() => void createProject()}
              onOpenProject={() => void openProject()}
              onUpdateAppSettings={updateAppSettings}
              onUpdateProjectSettings={updateProjectSettings}
              onUpdateNotebookDraft={updateNotebookDraft}
              onPersistNotebook={persistNotebook}
              onSetSelectedArchiveFolder={setSelectedArchiveFolder}
              onCreateArchiveFolder={createArchiveFolder}
              onUpdateArchiveFolder={updateArchiveFolder}
              onDeleteArchiveFolder={deleteArchiveFolder}
              onAddArchiveFiles={addArchiveFiles}
              onMoveArchiveItem={moveArchiveItem}
              onOpenArchiveItem={openArchiveItem}
              onRevealArchiveItem={revealArchiveItem}
              onDeleteArchiveItem={deleteArchiveItem}
              onSelectBoardForWindow={setBoardForCurrentWindow}
              onOpenBoardDetailsForWindow={openBoardDetailsForCurrentWindow}
              onUpdateBoardDraft={updateBoardDraft}
              onCloneBoard={cloneBoard}
              onCreateBoard={createBoard}
              onCreateBoardFolder={createBoardFolder}
              onUpdateBoardFolder={updateBoardFolder}
              onDeleteBoardFolder={deleteBoardFolder}
              onDeleteBoard={deleteBoard}
              onMoveBoard={moveBoard}
              onReorderBoards={reorderBoards}
              onSelectScene={selectScene}
              onOpenInspector={openInspector}
              onCreateScene={createScene}
              onToggleSceneSelection={toggleSceneSelection}
              onSetSceneSelection={setSceneSelection}
              onClearSceneSelection={clearSceneSelection}
              onCreateSceneFolder={createSceneFolder}
              onUpdateSceneFolder={updateSceneFolder}
              onDeleteSceneFolder={deleteSceneFolder}
              onMoveScenesToFolder={moveScenesToFolder}
              onToggleKeyScene={toggleKeyScene}
              onDuplicateScene={(sceneId, afterItemId) => duplicateScene(sceneId, { addToBoardAfterItemId: afterItemId ?? null })}
              onDeleteScene={deleteScene}
              onDeleteSelectedScenes={() => deleteScenes(selectedSceneIds)}
              onAddSceneToCurrentBoard={addSceneToCurrentBoard}
              onAddBlockToCurrentBoard={addBlockToCurrentBoard}
              onAddBlockTemplateToCurrentBoard={addBlockTemplateToCurrentBoard}
              onSaveBlockTemplate={saveBlockTemplate}
              onDeleteBlockTemplate={deleteBlockTemplate}
              onCopyBlockToBoard={copyBlockToBoard}
              onDuplicateBoardItem={duplicateBoardItem}
              onRemoveBoardItem={removeBoardItem}
              onReorderCurrentBoard={reorderCurrentBoard}
              onPersistBoardItemDraft={persistBoardItemDraft}
              onInlineUpdateScene={inlineUpdateScene}
              onInlineUpdateBlock={inlineUpdateBlock}
              onCreateSceneBeat={createSceneBeat}
              onUpdateSceneBeat={updateSceneBeat}
              onDeleteSceneBeat={deleteSceneBeat}
              onReorderSceneBeats={reorderSceneBeats}
              onSendScenesToOpenOutline={sendScenesToOpenOutline}
              onOpenTranscribeSettings={openAppSettingsTranscribe}
              onSetWorkspaceMode={setWorkspaceMode}
              onSetConsultantContextMode={setConsultantContextMode}
              onSendConsultantMessage={sendConsultantMessage}
              onClearConsultantConversation={clearConsultantConversation}
              onOpenAppSettings={openAppSettings}
              onChangeBoardViewMode={(mode) => setBoardViewMode(normalizeBoardViewMode(mode))}
            />
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
                  onOpenSettings={openAppSettings}
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
    scene.quoteMoment,
    scene.quality,
    scene.sourcePaths.join(' '),
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
  if (workspace === 'board-manager') return 'Board Manager Window'
  if (workspace === 'inspector') return 'Inspector Window'
  if (workspace === 'notebook') return 'Notebook Window'
  if (workspace === 'archive') return 'Archive Window'
  if (workspace === 'transcribe') return 'Transcribe Window'
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
