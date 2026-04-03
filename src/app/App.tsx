import { useCallback, useEffect, useMemo, useRef, useState, type PointerEventHandler } from 'react'
import { Loader2 } from 'lucide-react'

import { ProjectsToolbar } from '@/features/projects/projects-toolbar'
import {
  buildConsultantContextSummary,
  inferConsultantHint,
} from '@/features/consultant/consultant-context'
import type { SettingsTab } from '@/features/settings/settings-workspace'
import {
  ConsultantLauncher,
  ErrorBanner,
  InspectorSidebar,
  WorkspaceTabsBar,
} from '@/app/app-shell-sections'
import {
  buildInspectorContent,
  deriveSelectionState,
  getBoardBlockKindsForProject,
  getWorkspaceSummary,
  matchesSceneFilters,
} from '@/app/app-view-model'
import { DetachedWorkspacePanel, MainWorkspacePanel } from '@/app/app-workspace-panels'
import { densityOptions, isTextInputTarget } from '@/app/app-shell-utils'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { usePanelResize } from '@/hooks/use-panel-resize'
import { cn } from '@/lib/cn'
import { nextKeyRating } from '@/lib/scene-rating'
import { normalizeBoardViewMode, useWindowRuntime } from '@/app/use-window-runtime'
import { useAppStore } from '@/stores/app-store'
import { useFilterStore } from '@/stores/filter-store'
import type { ConsultantDialogPosition, ConsultantDialogSize, ConsultantLauncherPosition, WindowWorkspace } from '@/types/ai'
import type { Scene } from '@/types/scene'

export function App() {
  const searchRef = useRef<HTMLInputElement | null>(null)
  const viewButtonRef = useRef<HTMLButtonElement | null>(null)
  const [rightCollapsed, setRightCollapsed] = useState(true)
  const [, setLeftCollapsed] = useState(false)
  const [settingsNavigate, setSettingsNavigate] = useState<{ tab: SettingsTab; requestId: number } | null>(null)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [viewMenuPosition, setViewMenuPosition] = useState({ x: 0, y: 0 })
  const [outlineImmersive, setOutlineImmersive] = useState(false)
  const [consultantDialogOpen, setConsultantDialogOpen] = useState(false)
  const [consultantLauncherOverride, setConsultantLauncherOverride] = useState<ConsultantLauncherPosition | null>(null)
  const [consultantDialogPositionOverride, setConsultantDialogPositionOverride] = useState<ConsultantDialogPosition | null>(null)
  const [consultantDialogSizeOverride, setConsultantDialogSizeOverride] = useState<ConsultantDialogSize | null>(null)
  const dragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
    lastPosition: ConsultantLauncherPosition
  } | null>(null)
  const resizeStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    direction: 'left' | 'right' | 'bottom' | 'bottom-left'
    originWidth: number
    originHeight: number
    originX: number
    originY: number
    lastSize: ConsultantDialogSize
    lastPosition: ConsultantDialogPosition
  } | null>(null)
  const dialogDragStateRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    moved: boolean
    lastPosition: ConsultantDialogPosition
  } | null>(null)
  const suppressLauncherClickRef = useRef(false)
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
    workspaceMode,
    applyGlobalUiState,
    updateAppSettings,
    updateProjectSettings,
    sendConsultantMessage,
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
    const onResize = () => {
      setConsultantLauncherOverride((current) => (current ? clampConsultantLauncherPosition(current) : current))
      setConsultantDialogPositionOverride((current) =>
        current ? clampConsultantDialogPosition(current, consultantDialogSizeOverride ?? appSettings.ui.consultantDialogSize ?? getDefaultConsultantDialogSize()) : current,
      )
      setConsultantDialogSizeOverride((current) => (current ? clampConsultantDialogSize(current) : current))
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [appSettings.ui.consultantDialogSize, consultantDialogSizeOverride])

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
    return scenes.filter((scene) => matchesSceneFilters(scene, filters))
  }, [filters, scenes])

  const filteredSceneIds = useMemo(() => filteredScenes.map((scene) => scene.id), [filteredScenes])
  const {
    activeBoard,
    selectedBoard,
    selectedScene,
    selectedBlock,
    multiSelectedSceneCount,
  } = deriveSelectionState({
    boards,
    boardIdForWindow,
    selectedBoardId,
    selectedSceneId,
    selectedSceneIds,
    selectedBoardItemId,
    scenes,
    workspaceMode,
  })
  const workspaceSummary = getWorkspaceSummary({
    workspaceMode,
    consultantMessagesCount: consultantMessages.length,
    archiveItemsCount: archiveItems.length,
    boardsCount: boards.length,
    boardFoldersCount: boardFolders.length,
    notebookUpdatedAt: notebook.updatedAt,
    activeBoard,
  })
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

  const detachedViewControl = detachedWorkspace === 'outline' || detachedWorkspace === 'bank' ? (
    <button
      ref={viewButtonRef}
      type="button"
      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-border bg-panel px-2.5 text-sm font-medium text-foreground transition hover:bg-panelMuted lg:px-3"
      onClick={openViewMenu}
      aria-label={`View: ${densityOption.label}`}
      title={`View: ${densityOption.label}`}
    >
      <span className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-muted xl:inline">
        View
      </span>
      <densityOption.icon className="h-4 w-4" />
      <span className="hidden sm:inline">{densityOption.label}</span>
    </button>
  ) : null

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
  const inspectorContent = buildInspectorContent({
    selectedBlock,
    selectedBoard,
    selectedScene,
    selectedSceneId,
    selectedSceneIds,
    multiSelectedSceneCount,
    tags,
    onCollapse: () => setRightCollapsed(true),
    onSaveBoardItem: (item) => void persistBoardItemDraft(item),
    onSaveBlockTemplate: (input) => void saveBlockTemplate(input),
    onDeleteBoardItem: (itemId) => void removeBoardItem(itemId),
    onSaveBoard: (board) => void updateBoardDraft(board),
    onBulkUpdateScenes: (input) =>
      void bulkUpdateScenes({
        sceneIds: selectedSceneIds,
        ...input,
      }),
    onDeleteScenes: (sceneIds) => void deleteScenes(sceneIds),
    onClearSceneSelection: clearSceneSelection,
    onSaveScene: (scene) => void persistSceneDraft(scene),
    onCreateSceneBeat: (sceneId, afterBeatId) => void createSceneBeat(sceneId, afterBeatId),
    onUpdateSceneBeat: (input) => void updateSceneBeat(input),
    onDeleteSceneBeat: (beatId) => void deleteSceneBeat(beatId),
    onReorderSceneBeats: (sceneId, beatIds) => void reorderSceneBeats(sceneId, beatIds),
    onDeleteScene: (sceneId) => void deleteScene(sceneId),
  })

  const boardBlockKindsForProject = useMemo(
    () => getBoardBlockKindsForProject(projectSettings),
    [projectSettings],
  )
  const consultantContextInput = useMemo(
    () => ({
      projectMeta,
      projectSettings,
      workspaceMode,
      boards,
      scenes,
      tags,
      activeBoardId,
      selectedSceneId,
      selectedSceneIds,
      selectedBoardItemId,
    }),
    [
      projectMeta,
      projectSettings,
      workspaceMode,
      boards,
      scenes,
      tags,
      activeBoardId,
      selectedSceneId,
      selectedSceneIds,
      selectedBoardItemId,
    ],
  )
  const consultantContextSummary = useMemo(
    () => buildConsultantContextSummary(consultantContextInput),
    [consultantContextInput],
  )
  const consultantProactiveHint = useMemo(
    () => inferConsultantHint(consultantContextInput),
    [consultantContextInput],
  )
  const consultantDialogSize = useMemo(
    () =>
      clampConsultantDialogSize(
        consultantDialogSizeOverride ?? appSettings.ui.consultantDialogSize ?? getDefaultConsultantDialogSize(),
      ),
    [appSettings.ui.consultantDialogSize, consultantDialogSizeOverride],
  )
  const consultantDialogPosition = useMemo(
    () =>
      clampConsultantDialogPosition(
        consultantDialogPositionOverride ??
          appSettings.ui.consultantDialogPosition ??
          getDefaultConsultantDialogPosition(appSettings.ui.consultantDialogSize ?? getDefaultConsultantDialogSize()),
        consultantDialogSize,
      ),
    [appSettings.ui.consultantDialogPosition, appSettings.ui.consultantDialogSize, consultantDialogPositionOverride, consultantDialogSize],
  )
  const consultantLauncherPosition = useMemo(
    () =>
      consultantDialogOpen
        ? getLauncherPositionForDialog(consultantDialogPosition, consultantDialogSize)
        : clampConsultantLauncherPosition(
            consultantLauncherOverride ?? appSettings.ui.consultantLauncherPosition ?? getDefaultConsultantLauncherPosition(),
          ),
    [
      appSettings.ui.consultantLauncherPosition,
      consultantDialogOpen,
      consultantDialogPosition,
      consultantDialogSize,
      consultantLauncherOverride,
    ],
  )

  const persistConsultantLauncherPosition = useCallback((position: ConsultantLauncherPosition) => {
    void updateAppSettings({ consultantLauncherPosition: position })
  }, [updateAppSettings])

  const persistConsultantDialogSize = useCallback((size: ConsultantDialogSize) => {
    void updateAppSettings({ consultantDialogSize: size })
  }, [updateAppSettings])

  const persistConsultantDialogPosition = useCallback((position: ConsultantDialogPosition) => {
    void updateAppSettings({ consultantDialogPosition: position })
  }, [updateAppSettings])

  const syncLauncherToDialog = useCallback((
    dialogPosition: ConsultantDialogPosition,
    dialogSize: ConsultantDialogSize,
  ) => {
    const launcherPosition = getLauncherPositionForDialog(dialogPosition, dialogSize)
    setConsultantLauncherOverride(launcherPosition)
    persistConsultantLauncherPosition(launcherPosition)
  }, [persistConsultantLauncherPosition])

  const startConsultantDialogDrag = useCallback((
    pointerId: number,
    clientX: number,
    clientY: number,
    target: Element & { setPointerCapture(pointerId: number): void; releasePointerCapture(pointerId: number): void },
    suppressClickOnFinish: boolean,
  ) => {
    dialogDragStateRef.current = {
      pointerId,
      startX: clientX,
      startY: clientY,
      originX: consultantDialogPosition.x,
      originY: consultantDialogPosition.y,
      moved: false,
      lastPosition: consultantDialogPosition,
    }

    target.setPointerCapture(pointerId)

    const finish = (nextPointerId: number) => {
      if (dialogDragStateRef.current?.pointerId !== nextPointerId) {
        return
      }

      target.releasePointerCapture(nextPointerId)
      const lastPosition = dialogDragStateRef.current.lastPosition
      const didMove = dialogDragStateRef.current.moved
      dialogDragStateRef.current = null
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      persistConsultantDialogPosition(lastPosition)
      syncLauncherToDialog(lastPosition, consultantDialogSize)
      if (suppressClickOnFinish && didMove) {
        suppressLauncherClickRef.current = true
      }
    }

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dragState = dialogDragStateRef.current
      if (!dragState || dragState.pointerId !== moveEvent.pointerId) {
        return
      }

      const nextPosition = clampConsultantDialogPosition({
        x: dragState.originX + (moveEvent.clientX - dragState.startX),
        y: dragState.originY + (moveEvent.clientY - dragState.startY),
      }, consultantDialogSize)

      if (!dragState.moved && (Math.abs(moveEvent.clientX - dragState.startX) + Math.abs(moveEvent.clientY - dragState.startY) > 6)) {
        dragState.moved = true
      }

      dragState.lastPosition = nextPosition
      setConsultantDialogPositionOverride(nextPosition)
    }

    const onPointerUp = (upEvent: PointerEvent) => finish(upEvent.pointerId)

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }, [consultantDialogPosition, consultantDialogSize, persistConsultantDialogPosition, syncLauncherToDialog])

  const handleConsultantLauncherPointerDown = useCallback<PointerEventHandler<HTMLButtonElement>>((event) => {
    if (event.button !== 0) {
      return
    }

    if (consultantDialogOpen) {
      event.preventDefault()
      startConsultantDialogDrag(event.pointerId, event.clientX, event.clientY, event.currentTarget, true)
      return
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: consultantLauncherPosition.x,
      originY: consultantLauncherPosition.y,
      moved: false,
      lastPosition: consultantLauncherPosition,
    }

    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)

    const finish = (pointerId: number) => {
      if (dragStateRef.current?.pointerId !== pointerId) {
        return
      }

      target.releasePointerCapture(pointerId)
      const lastPosition = dragStateRef.current.lastPosition
      const didMove = dragStateRef.current.moved
      dragStateRef.current = null
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)

      if (didMove) {
        suppressLauncherClickRef.current = true
        persistConsultantLauncherPosition(lastPosition)
      }
    }

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState || dragState.pointerId !== moveEvent.pointerId) {
        return
      }

      const deltaX = moveEvent.clientX - dragState.startX
      const deltaY = moveEvent.clientY - dragState.startY
      const nextPosition = clampConsultantLauncherPosition({
        x: dragState.originX + deltaX,
        y: dragState.originY + deltaY,
      })

      if (!dragState.moved && Math.abs(deltaX) + Math.abs(deltaY) > 6) {
        dragState.moved = true
      }

      dragState.lastPosition = nextPosition
      setConsultantLauncherOverride(nextPosition)
    }

    const onPointerUp = (upEvent: PointerEvent) => finish(upEvent.pointerId)

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }, [consultantDialogOpen, consultantLauncherPosition, persistConsultantLauncherPosition, startConsultantDialogDrag])

  const openConsultantWorkspace = useCallback(() => {
    if (suppressLauncherClickRef.current) {
      suppressLauncherClickRef.current = false
      return
    }

    setConsultantDialogOpen((current) => {
      if (current) {
        syncLauncherToDialog(consultantDialogPosition, consultantDialogSize)
        return false
      }

      const nextSize = consultantDialogSize
      const anchoredPosition = clampConsultantDialogPosition({
        x: consultantLauncherPosition.x + 56 - nextSize.width,
        y: consultantLauncherPosition.y - nextSize.height - 10,
      }, nextSize)

      setConsultantDialogPositionOverride(anchoredPosition)
      return true
    })
  }, [consultantDialogPosition, consultantDialogSize, consultantLauncherPosition, syncLauncherToDialog])

  const openConsultantPanel = useCallback(() => {
    syncLauncherToDialog(consultantDialogPosition, consultantDialogSize)
    setConsultantDialogOpen(false)
    setWorkspaceMode('consultant')
  }, [consultantDialogPosition, consultantDialogSize, setWorkspaceMode, syncLauncherToDialog])

  const closeConsultantDialog = useCallback(() => {
    syncLauncherToDialog(consultantDialogPosition, consultantDialogSize)
    setConsultantDialogOpen(false)
  }, [consultantDialogPosition, consultantDialogSize, syncLauncherToDialog])

  const handleConsultantResizePointerDown = useCallback<PointerEventHandler<HTMLButtonElement>>((event) => {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    const direction = (event.currentTarget.dataset.direction ?? 'bottom-left') as
      | 'left'
      | 'right'
      | 'bottom'
      | 'bottom-left'

    resizeStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      direction,
      originWidth: consultantDialogSize.width,
      originHeight: consultantDialogSize.height,
      originX: consultantDialogPosition.x,
      originY: consultantDialogPosition.y,
      lastSize: consultantDialogSize,
      lastPosition: consultantDialogPosition,
    }

    const target = event.currentTarget
    target.setPointerCapture(event.pointerId)

    const finish = (pointerId: number) => {
      if (resizeStateRef.current?.pointerId !== pointerId) {
        return
      }

      target.releasePointerCapture(pointerId)
      const lastSize = resizeStateRef.current.lastSize
      const lastPosition = resizeStateRef.current.lastPosition
      resizeStateRef.current = null
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      persistConsultantDialogSize(lastSize)
      persistConsultantDialogPosition(lastPosition)
      syncLauncherToDialog(lastPosition, lastSize)
    }

    const onPointerMove = (moveEvent: PointerEvent) => {
      const resizeState = resizeStateRef.current
      if (!resizeState || resizeState.pointerId !== moveEvent.pointerId) {
        return
      }

      const deltaX = moveEvent.clientX - resizeState.startX
      const deltaY = moveEvent.clientY - resizeState.startY
      let nextWidth = resizeState.originWidth
      let nextHeight = resizeState.originHeight
      let nextX = resizeState.originX

      if (resizeState.direction === 'right') {
        nextWidth = resizeState.originWidth + deltaX
      } else if (resizeState.direction === 'left') {
        nextWidth = resizeState.originWidth - deltaX
        nextX = resizeState.originX + deltaX
      } else if (resizeState.direction === 'bottom') {
        nextHeight = resizeState.originHeight + deltaY
      } else {
        nextWidth = resizeState.originWidth - deltaX
        nextHeight = resizeState.originHeight + deltaY
        nextX = resizeState.originX + deltaX
      }

      const clampedWidth = clamp(nextWidth, 380, Math.max(380, window.innerWidth - 32))
      const clampedHeight = clamp(nextHeight, 440, Math.max(440, window.innerHeight - 32))
      if (resizeState.direction === 'left' || resizeState.direction === 'bottom-left') {
        nextX = resizeState.originX + (resizeState.originWidth - clampedWidth)
      }

      const nextSize = clampConsultantDialogSize({
        width: clampedWidth,
        height: clampedHeight,
      })
      const nextPosition = clampConsultantDialogPosition({
        x: nextX,
        y: resizeState.originY,
      }, nextSize)

      resizeState.lastSize = nextSize
      resizeState.lastPosition = nextPosition
      setConsultantDialogSizeOverride(nextSize)
      setConsultantDialogPositionOverride(nextPosition)
    }

    const onPointerUp = (upEvent: PointerEvent) => finish(upEvent.pointerId)

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }, [consultantDialogPosition, consultantDialogSize, persistConsultantDialogPosition, persistConsultantDialogSize, syncLauncherToDialog])

  const handleConsultantDialogPointerDown = useCallback<PointerEventHandler<HTMLDivElement>>((event) => {
    if (event.button !== 0) {
      return
    }

    const interactiveTarget = event.target as HTMLElement | null
    if (interactiveTarget?.closest('button, textarea, input, a')) {
      return
    }

    startConsultantDialogDrag(event.pointerId, event.clientX, event.clientY, event.currentTarget, false)
  }, [startConsultantDialogDrag])

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
        {!outlineImmersive ? <div className="app-drag h-14 shrink-0 pl-24" /> : null}
        <div className={cn('min-h-0 flex-1 overflow-hidden', outlineImmersive ? 'p-0' : 'p-4')}>
          <DetachedWorkspacePanel
            {...sharedWorkspaceProps}
            detachedWorkspace={detachedWorkspace}
            outlineImmersive={outlineImmersive}
            detachedViewControl={!outlineImmersive ? detachedViewControl : null}
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
              consultantContextSummary={consultantContextSummary}
              consultantProactiveHint={consultantProactiveHint}
              busy={busy}
              settingsNavigate={settingsNavigate}
              onSetWorkspaceMode={setWorkspaceMode}
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

      <ConsultantLauncher
        open={consultantDialogOpen}
        position={consultantLauncherPosition}
        hasHint={Boolean(consultantProactiveHint) && !consultantDialogOpen && workspaceMode !== 'consultant'}
        dialogPosition={consultantDialogPosition}
        dialogSize={consultantDialogSize}
        settings={appSettings}
        messages={consultantMessages}
        busy={consultantBusy}
        contextSummary={consultantContextSummary}
        proactiveHint={consultantProactiveHint}
        onOpen={openConsultantWorkspace}
        onClose={closeConsultantDialog}
        onOpenFullView={openConsultantPanel}
        onPointerDown={handleConsultantLauncherPointerDown}
        onDialogPointerDown={handleConsultantDialogPointerDown}
        onResizePointerDown={handleConsultantResizePointerDown}
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

function getDefaultConsultantLauncherPosition(): ConsultantLauncherPosition {
  if (typeof window === 'undefined') {
    return { x: 24, y: 120 }
  }

  return clampConsultantLauncherPosition({
    x: window.innerWidth - 80,
    y: window.innerHeight - 172,
  })
}

function getLauncherPositionForDialog(
  dialogPosition: ConsultantDialogPosition,
  dialogSize: ConsultantDialogSize,
): ConsultantLauncherPosition {
  return clampConsultantLauncherPosition({
    x: dialogPosition.x + dialogSize.width - 56,
    y: dialogPosition.y + dialogSize.height + 10,
  })
}

function getDefaultConsultantDialogSize(): ConsultantDialogSize {
  if (typeof window === 'undefined') {
    return { width: 460, height: 620 }
  }

  return clampConsultantDialogSize({
    width: 460,
    height: 620,
  })
}

function getDefaultConsultantDialogPosition(size: ConsultantDialogSize): ConsultantDialogPosition {
  if (typeof window === 'undefined') {
    return { x: 24, y: 24 }
  }

  return clampConsultantDialogPosition({
    x: window.innerWidth - size.width - 32,
    y: Math.max(24, window.innerHeight - size.height - 120),
  }, size)
}

function clampConsultantLauncherPosition(position: ConsultantLauncherPosition): ConsultantLauncherPosition {
  if (typeof window === 'undefined') {
    return position
  }

  const margin = 16
  const size = 56

  return {
    x: clamp(position.x, margin, Math.max(margin, window.innerWidth - size - margin)),
    y: clamp(position.y, margin, Math.max(margin, window.innerHeight - size - margin)),
  }
}

function clampConsultantDialogSize(size: ConsultantDialogSize): ConsultantDialogSize {
  if (typeof window === 'undefined') {
    return size
  }

  return {
    width: clamp(size.width, 380, Math.max(380, window.innerWidth - 32)),
    height: clamp(size.height, 440, Math.max(440, window.innerHeight - 32)),
  }
}

function clampConsultantDialogPosition(
  position: ConsultantDialogPosition,
  size: ConsultantDialogSize,
): ConsultantDialogPosition {
  if (typeof window === 'undefined') {
    return position
  }

  return {
    x: clamp(position.x, 16, Math.max(16, window.innerWidth - size.width - 16)),
    y: clamp(position.y, 16, Math.max(16, window.innerHeight - size.height - 16)),
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
