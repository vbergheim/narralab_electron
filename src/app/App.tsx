import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { BoardInspector } from '@/features/inspector/board-inspector'
import { BoardItemInspector } from '@/features/inspector/board-item-inspector'
import { BulkSceneInspector } from '@/features/inspector/bulk-scene-inspector'
import { SceneInspector } from '@/features/inspector/scene-inspector'
import { ProjectsToolbar } from '@/features/projects/projects-toolbar'
import type { SettingsTab } from '@/features/settings/settings-workspace'
import {
  ConsultantDock,
  DetachedWindowHeader,
  ErrorBanner,
  InspectorSidebar,
  WorkspaceTabsBar,
} from '@/app/app-shell-sections'
import { DetachedWorkspacePanel, MainWorkspacePanel } from '@/app/app-workspace-panels'
import { densityOptions, isTextInputTarget } from '@/app/app-shell-utils'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { usePanelResize } from '@/hooks/use-panel-resize'
import { cn } from '@/lib/cn'
import { nextKeyRating } from '@/lib/scene-rating'
import { normalizeBoardViewMode, useWindowRuntime } from '@/app/use-window-runtime'
import { useAppStore } from '@/stores/app-store'
import { useFilterStore } from '@/stores/filter-store'
import { isTextBoardItem } from '@/types/board'
import type { WindowWorkspace } from '@/types/ai'
import type { Scene } from '@/types/scene'

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
  const openViewMenu = useCallback(() => {
    const rect = viewButtonRef.current?.getBoundingClientRect()
    if (!rect) {
      return
    }

    setViewMenuPosition({ x: rect.left, y: rect.bottom + 8 })
    setViewMenuOpen(true)
  }, [])

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

  const sharedWorkspaceProps = {
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
    activeBoard,
    selectedSceneId,
    selectedSceneIds,
    selectedBoardItemId,
    selectedArchiveFolderId,
    filteredScenes,
    filteredSceneIds,
    sceneDensity,
    boardViewMode: effectiveBoardViewMode,
    boardBlockKindsForProject,
    inspectorContent,
    onCreateProject: () => void createProject(),
    onOpenProject: () => void openProject(),
    onUpdateAppSettings: updateAppSettings,
    onUpdateProjectSettings: updateProjectSettings,
    onUpdateNotebookDraft: updateNotebookDraft,
    onPersistNotebook: persistNotebook,
    onSetSelectedArchiveFolder: setSelectedArchiveFolder,
    onCreateArchiveFolder: createArchiveFolder,
    onUpdateArchiveFolder: updateArchiveFolder,
    onDeleteArchiveFolder: deleteArchiveFolder,
    onAddArchiveFiles: addArchiveFiles,
    onMoveArchiveItem: moveArchiveItem,
    onOpenArchiveItem: openArchiveItem,
    onRevealArchiveItem: revealArchiveItem,
    onDeleteArchiveItem: deleteArchiveItem,
    onSelectBoardForWindow: setBoardForCurrentWindow,
    onOpenBoardDetailsForWindow: openBoardDetailsForCurrentWindow,
    onUpdateBoardDraft: updateBoardDraft,
    onCloneBoard: cloneBoard,
    onCreateBoard: createBoard,
    onCreateBoardFolder: createBoardFolder,
    onUpdateBoardFolder: updateBoardFolder,
    onDeleteBoardFolder: deleteBoardFolder,
    onDeleteBoard: deleteBoard,
    onMoveBoard: moveBoard,
    onReorderBoards: reorderBoards,
    onSelectScene: selectScene,
    onOpenInspector: openInspector,
    onCreateScene: createScene,
    onToggleSceneSelection: toggleSceneSelection,
    onSetSceneSelection: setSceneSelection,
    onClearSceneSelection: clearSceneSelection,
    onCreateSceneFolder: createSceneFolder,
    onUpdateSceneFolder: updateSceneFolder,
    onDeleteSceneFolder: deleteSceneFolder,
    onMoveScenesToFolder: moveScenesToFolder,
    onToggleKeyScene: toggleKeyScene,
    onDuplicateScene: (sceneId: string, afterItemId?: string | null) =>
      duplicateScene(sceneId, { addToBoardAfterItemId: afterItemId ?? null }),
    onDeleteScene: deleteScene,
    onDeleteSelectedScenes: () => deleteScenes(selectedSceneIds),
    onAddSceneToCurrentBoard: addSceneToCurrentBoard,
    onAddBlockToCurrentBoard: addBlockToCurrentBoard,
    onAddBlockTemplateToCurrentBoard: addBlockTemplateToCurrentBoard,
    onSaveBlockTemplate: saveBlockTemplate,
    onDeleteBlockTemplate: deleteBlockTemplate,
    onCopyBlockToBoard: copyBlockToBoard,
    onDuplicateBoardItem: duplicateBoardItem,
    onRemoveBoardItem: removeBoardItem,
    onReorderCurrentBoard: reorderCurrentBoard,
    onPersistBoardItemDraft: persistBoardItemDraft,
    onInlineUpdateScene: inlineUpdateScene,
    onInlineUpdateBlock: inlineUpdateBlock,
    onCreateSceneBeat: createSceneBeat,
    onUpdateSceneBeat: updateSceneBeat,
    onDeleteSceneBeat: deleteSceneBeat,
    onReorderSceneBeats: reorderSceneBeats,
    onSendScenesToOpenOutline: sendScenesToOpenOutline,
    onOpenTranscribeSettings: openAppSettingsTranscribe,
  }

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
          <DetachedWindowHeader
            projectTitle={projectTitle}
            detachedWorkspace={detachedWorkspace}
            densityOption={densityOption}
            viewButtonRef={viewButtonRef}
            onOpenViewMenu={openViewMenu}
            onToggleOutlineImmersive={() => void toggleOutlineImmersive()}
          />
        ) : null}
        <div className={cn('min-h-0 flex-1 overflow-hidden', outlineImmersive ? 'p-0' : 'p-4')}>
          <DetachedWorkspacePanel
            {...sharedWorkspaceProps}
            detachedWorkspace={detachedWorkspace}
            outlineImmersive={outlineImmersive}
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
        {error ? <ErrorBanner error={error} onDismiss={dismissError} /> : null}

        <WorkspaceTabsBar
          workspaceMode={workspaceMode}
          workspaceSummary={workspaceSummary}
          showDensityControl={showDensityControl}
          densityOption={densityOption}
          viewButtonRef={viewButtonRef}
          onOpenViewMenu={openViewMenu}
          onSetWorkspaceMode={setWorkspaceMode}
        />

        <div className="flex min-h-0 flex-1 gap-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
            <MainWorkspacePanel
              {...sharedWorkspaceProps}
              workspaceMode={workspaceMode}
              consultantBusy={consultantBusy}
              consultantMessages={consultantMessages}
              consultantContextMode={consultantContextMode}
              busy={busy}
              settingsNavigate={settingsNavigate}
              onSetWorkspaceMode={setWorkspaceMode}
              onSetConsultantContextMode={setConsultantContextMode}
              onSendConsultantMessage={sendConsultantMessage}
              onClearConsultantConversation={clearConsultantConversation}
              onOpenAppSettings={openAppSettings}
              onChangeBoardViewMode={(mode) => setBoardViewMode(normalizeBoardViewMode(mode))}
            />
          </div>

          <InspectorSidebar
            showInspector={showInspector}
            collapsed={rightCollapsed}
            resize={inspectorResize}
            inspectorContent={inspectorContent}
            onExpand={() => setRightCollapsed(false)}
          />
        </div>
      </div>

      <ConsultantDock
        open={consultantDockOpen}
        settings={appSettings}
        messages={consultantMessages}
        busy={consultantBusy}
        activeBoardName={activeBoard?.name ?? null}
        contextMode={consultantContextMode}
        onToggleOpen={() => setConsultantDockOpen((current) => !current)}
        onOpenFullView={() => setWorkspaceMode('consultant')}
        onChangeContextMode={setConsultantContextMode}
        onSend={(content) => void sendConsultantMessage(content)}
        onClear={clearConsultantConversation}
        onOpenSettings={openAppSettings}
      />
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
