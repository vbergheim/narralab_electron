import { startTransition, useCallback, useEffect, useRef, useState } from 'react'

import type { SavedWindowLayout } from '@/types/ai'
import type { BoardViewMode } from '@/types/board'
import type { GlobalUiState, ProjectChangeScope, WindowContext } from '@/types/project'
import type { SceneDensity } from '@/types/view'

type UseWindowRuntimeInput = {
  ready: boolean
  projectMetaPath: string | null
  defaultSceneDensity: SceneDensity
  defaultBoardView: BoardViewMode | null
  activeBoardId: string | null
  applyGlobalUiState(input: Partial<GlobalUiState>): void
  syncProjectChanges(scopes: ProjectChangeScope[]): Promise<void>
}

export function useWindowRuntime(input: UseWindowRuntimeInput) {
  const {
    ready,
    projectMetaPath,
    defaultSceneDensity,
    defaultBoardView,
    activeBoardId,
    applyGlobalUiState,
    syncProjectChanges,
  } = input
  const [sceneDensity, setSceneDensity] = useState<SceneDensity>('compact')
  const [boardViewMode, setBoardViewMode] = useState<BoardViewMode>('outline')
  const [windowContext, setWindowContext] = useState<WindowContext | null>(null)
  const [savedLayouts, setSavedLayouts] = useState<SavedWindowLayout[]>([])
  const lastProjectRevisionRef = useRef<number>(0)
  const lastAppliedProjectBoardViewKeyRef = useRef<string>('')

  const syncProjectChangeEvent = useCallback(
    async (scopes: ProjectChangeScope[]) => {
      await syncProjectChanges(scopes)
      if (scopes.includes('all') || scopes.includes('layouts')) {
        setSavedLayouts(await window.narralab.windows.listLayouts())
      }
    },
    [syncProjectChanges],
  )

  useEffect(() => {
    const loadWindowState = async () => {
      const [context, layouts] = await Promise.all([
        window.narralab.windows.getContext(),
        window.narralab.windows.listLayouts(),
      ])
      setWindowContext(context)
      setSavedLayouts(layouts)
      if (context.role === 'detached') {
        setSceneDensity(context.sceneDensity)
        setBoardViewMode(normalizeBoardViewMode(context.viewMode))
      }
    }

    void loadWindowState()

    const dispose = window.narralab.windows.subscribe((event) => {
      if (event.type === 'project-changed') {
        if (event.payload.revision <= lastProjectRevisionRef.current) {
          return
        }
        lastProjectRevisionRef.current = event.payload.revision
        void syncProjectChangeEvent(event.payload.scopes)
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
  }, [applyGlobalUiState, syncProjectChangeEvent, windowContext?.windowId])

  useEffect(() => {
    if (!ready || windowContext === null) return
    if (windowContext.role !== 'main') return
    startTransition(() => {
      setSceneDensity(defaultSceneDensity)
    })
  }, [defaultSceneDensity, ready, windowContext])

  useEffect(() => {
    if (!ready || windowContext === null) return
    if (windowContext.role !== 'main') return
    if (!projectMetaPath || !defaultBoardView) {
      lastAppliedProjectBoardViewKeyRef.current = ''
      return
    }
    const key = `${projectMetaPath}:${defaultBoardView}`
    if (lastAppliedProjectBoardViewKeyRef.current === key) return
    lastAppliedProjectBoardViewKeyRef.current = key
    startTransition(() => {
      setBoardViewMode(normalizeBoardViewMode(defaultBoardView))
    })
  }, [defaultBoardView, projectMetaPath, ready, windowContext])

  const detachedWorkspace =
    windowContext?.role === 'detached' && windowContext.workspace !== 'main'
      ? windowContext.workspace
      : null
  const boardIdForWindow =
    detachedWorkspace && windowContext?.boardId
      ? windowContext.boardId
      : activeBoardId
  const mediaPathForWindow =
    detachedWorkspace && windowContext?.mediaPath
      ? windowContext.mediaPath
      : null

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

    void window.narralab.windows.updateContext({
      boardId: boardIdForWindow,
      viewMode: normalizeBoardViewMode(boardViewMode),
      sceneDensity,
    })
  }, [boardIdForWindow, boardViewMode, sceneDensity, windowContext])

  return {
    boardIdForWindow,
    boardViewMode,
    detachedWorkspace,
    mediaPathForWindow,
    savedLayouts,
    sceneDensity,
    setBoardViewMode,
    setSavedLayouts,
    setSceneDensity,
    setWindowContext,
    windowContext,
  }
}

export function normalizeBoardViewMode(mode: BoardViewMode): BoardViewMode {
  return mode === 'timeline' ? 'outline' : mode
}
