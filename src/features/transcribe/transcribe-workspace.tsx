import { useCallback, useEffect, useState, type CSSProperties } from 'react'

import { CollapsedRail } from '@/app/app-shell-controls'
import { Panel } from '@/components/ui/panel'
import { ResizeHandle } from '@/features/boards/outline-workspace-shared'
import { usePanelResize } from '@/hooks/use-panel-resize'
import type { AppSettings, AppSettingsUpdateInput } from '@/types/ai'
import type { NotebookDocument, ProjectMeta } from '@/types/project'
import type { Scene } from '@/types/scene'
import {
  TRANSCRIPTION_MODEL_CATALOG,
  type TranscriptionLanguage,
  type TranscriptionModelId,
  type TranscriptionProgressEvent,
  type TranscriptionStatus,
  type TranscriptionTimestampInterval,
  type TranscriptionFolder,
  type TranscriptionItem,
} from '@/types/transcription'
import type { TranscriptionSetup } from '@/types/project'
import {
  LibraryEmptyState,
  NewTranscriptionPanel,
  SavedTranscriptionMetadataPanel,
  TranscriptPanel,
  TranscribeWorkspaceHeader,
} from './transcribe-workspace-sections'
import { TranscriptionLibrarySidebar } from './components/transcription-library-sidebar'
import {
  isTranscriptionJobActive,
  presetTimestampIntervals,
  resolveTranscribeWorkspaceView,
  type TranscribeWorkspaceView,
} from './transcribe-workspace-utils'

type Props = {
  projectMeta: ProjectMeta | null
  settings: AppSettings
  onSaveAppSettings(input: AppSettingsUpdateInput): Promise<void>
  onNotebookSynced(document: NotebookDocument): void
  onOpenTranscribeSettings(): void
  detachedTranscriptOnly?: boolean
}


export function TranscribeWorkspace({
  projectMeta,
  settings,
  onSaveAppSettings,
  onNotebookSynced,
  onOpenTranscribeSettings,
  detachedTranscriptOnly = false,
}: Props) {
  const sortLibraryItems = useCallback((items: TranscriptionItem[]) => {
    return [...items].sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || right.createdAt.localeCompare(left.createdAt),
    )
  }, [])

  const [setup, setSetup] = useState<TranscriptionSetup | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<TranscribeWorkspaceView>(() =>
    resolveTranscribeWorkspaceView('initial'),
  )
  const [draftFilePath, setDraftFilePath] = useState<string | null>(null)
  const [modelId, setModelId] = useState<TranscriptionModelId>(settings.transcription.modelId)
  const [language, setLanguage] = useState<TranscriptionLanguage>(settings.transcription.language)
  const [timestampInterval, setTimestampInterval] = useState<TranscriptionTimestampInterval>(
    settings.transcription.timestampInterval,
  )
  const [status, setStatus] = useState<TranscriptionStatus>({ phase: 'idle', message: '' })
  const [draftResultText, setDraftResultText] = useState('')
  const [libraryResultText, setLibraryResultText] = useState('')
  const [elapsedSec, setElapsedSec] = useState(0)

  // Library state
  const [libraryFolders, setLibraryFolders] = useState<TranscriptionFolder[]>([])
  const [libraryItems, setLibraryItems] = useState<TranscriptionItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedLinkedSceneId, setSelectedLinkedSceneId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [libraryMetadataCollapsed, setLibraryMetadataCollapsed] = useState(true)

  // Project data for linking
  const [scenes, setScenes] = useState<Scene[]>([])
  const [windowTranscriptionItemId, setWindowTranscriptionItemId] = useState<string | null>(null)
  const libraryResize = usePanelResize({
    initial: 280,
    min: 220,
    max: 460,
    storageKey: projectMeta
      ? `narralab:transcribe-library-width:${encodeURIComponent(projectMeta.path)}`
      : 'narralab:transcribe-library-width',
  })
  const libraryMetadataResize = usePanelResize({
    initial: 320,
    min: 260,
    max: 420,
    storageKey: projectMeta
      ? `narralab:transcribe-metadata-width:${encodeURIComponent(projectMeta.path)}`
      : 'narralab:transcribe-metadata-width',
  })

  const jobActive = isTranscriptionJobActive(status)
  const usesCustomTimestampInterval = !presetTimestampIntervals.some((entry) => entry === timestampInterval)

  useEffect(() => {
    if (!jobActive) return
    const t0 = Date.now()
    const tick = () => setElapsedSec(Math.floor((Date.now() - t0) / 1000))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [jobActive])

  const refreshSetup = useCallback(async () => {
    try {
      const next = await window.narralab.transcription.getSetup()
      setSetup(next)
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load transcription setup')
    }
  }, [])

  const refreshLibrary = useCallback(async () => {
    try {
      const [folders, items] = await Promise.all([
        window.narralab.transcription.library.folders.list(),
        window.narralab.transcription.library.items.list()
      ])
      setLibraryFolders(folders)
      setLibraryItems(sortLibraryItems(items))
    } catch (e) {
      console.error('Failed to load library:', e)
    }
  }, [sortLibraryItems])

  const refreshScenes = useCallback(async () => {
    try {
      const list = await window.narralab.scenes.list()
      setScenes(list)
    } catch (e) {
      console.error('Failed to load scenes:', e)
    }
  }, [])

  useEffect(() => {
    void refreshSetup()
    void refreshLibrary()
    void refreshScenes()
  }, [refreshSetup, refreshLibrary, refreshScenes])

  useEffect(() => {
    setModelId(settings.transcription.modelId)
    setLanguage(settings.transcription.language)
    setTimestampInterval(settings.transcription.timestampInterval)
  }, [settings.transcription.language, settings.transcription.modelId, settings.transcription.timestampInterval])

  useEffect(() => {
    const dispose = window.narralab.transcription.subscribe(async (event: TranscriptionProgressEvent) => {
      if (event.type === 'status') {
        setStatus(event.payload)
        if (event.payload.phase === 'complete' && event.payload.resultText) {
          const text = event.payload.resultText
          setDraftResultText(text)

          // Auto-save to library
          if (draftFilePath) {
            const name = draftFilePath.split(/[/\\]/).pop() || 'Untitled'
            try {
              const newItem = await window.narralab.transcription.library.items.create({
                name,
                content: text,
                sourceFilePath: draftFilePath
              })
              await refreshLibrary()
              setSelectedItemId(newItem.id)
              setLibraryResultText(text)
              setLibraryMetadataCollapsed(false)
              setDraftResultText('')
              setDraftFilePath(null)
              setStatus({ phase: 'idle', message: '' })
              setActiveView(resolveTranscribeWorkspaceView('autosave-complete'))
            } catch (e) {
              console.error('Failed to auto-save:', e)
            }
          }
        }
        if (event.payload.phase === 'error') {
          setDraftResultText('')
        }
      }
    })
    return dispose
  }, [draftFilePath, refreshLibrary])

  const handleSelectItem = useCallback((itemId: string) => {
    const item = libraryItems.find(i => i.id === itemId)
    setSelectedItemId(itemId)
    setActiveView(resolveTranscribeWorkspaceView('library-selection'))
    setLibraryMetadataCollapsed(false)
    if (item) {
      setLibraryResultText(item.content)
    }
    // If we are looking at a saved item, reset live status
    setStatus({ phase: 'idle', message: '' })
  }, [libraryItems])

  const applySelectedItem = useCallback(
    (itemId: string) => {
      handleSelectItem(itemId)
      setActiveView(resolveTranscribeWorkspaceView('external-selection'))
    },
    [handleSelectItem],
  )

  // Sync from global selection
  useEffect(() => {
    const dispose = window.narralab.windows.subscribe((event) => {
      if (event.type === 'project-changed') {
        if (event.payload.scopes.includes('all') || event.payload.scopes.includes('transcription-library')) {
          void refreshLibrary()
        }
        if (event.payload.scopes.includes('all') || event.payload.scopes.includes('scenes')) {
          void refreshScenes()
        }
        return
      }

      if (event.type === 'window-context') {
        setWindowTranscriptionItemId(event.payload.transcriptionItemId ?? null)
      }

      if (event.type === 'global-ui-state' && event.payload.selectedTranscriptionItemId) {
        applySelectedItem(event.payload.selectedTranscriptionItemId)
        void window.narralab.windows.updateGlobalUiState({ selectedTranscriptionItemId: null })
      }
    })
    return dispose
  }, [applySelectedItem, refreshLibrary, refreshScenes])

  useEffect(() => {
    let cancelled = false

    const loadInitialSelections = async () => {
      try {
        const [context, state] = await Promise.all([
          window.narralab.windows.getContext(),
          window.narralab.windows.getGlobalUiState(),
        ])
        if (cancelled) return
        setWindowTranscriptionItemId(context.transcriptionItemId ?? null)
        if (context.transcriptionItemId) {
          applySelectedItem(context.transcriptionItemId)
          return
        }
        if (!state.selectedTranscriptionItemId) return
        applySelectedItem(state.selectedTranscriptionItemId)
        await window.narralab.windows.updateGlobalUiState({ selectedTranscriptionItemId: null })
      } catch (error) {
        console.error('Failed to load initial transcription selection:', error)
      }
    }

    void loadInitialSelections()
    return () => {
      cancelled = true
    }
  }, [applySelectedItem])

  useEffect(() => {
    if (!windowTranscriptionItemId) return
    applySelectedItem(windowTranscriptionItemId)
  }, [applySelectedItem, windowTranscriptionItemId])

  useEffect(() => {
    if (!selectedItemId) return
    const item = libraryItems.find((entry) => entry.id === selectedItemId)
    if (!item) return
    setLibraryResultText((current) => (current === '' ? item.content : current))
  }, [libraryItems, selectedItemId])

  useEffect(() => {
    if (!selectedItemId) {
      setSelectedLinkedSceneId(null)
      return
    }
    const item = libraryItems.find((entry) => entry.id === selectedItemId)
    setSelectedLinkedSceneId(item?.sceneId ?? null)
  }, [libraryItems, selectedItemId])

  const pickFile = async () => {
    const path = await window.narralab.transcription.pickFile()
    if (path) {
      setDraftFilePath(path)
      setActiveView(resolveTranscribeWorkspaceView('new-transcription'))
    }
  }

  const onDropMedia = (event: React.DragEvent) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files)
    const paths = window.narralab.archive.items.resolveDroppedPaths(files)
    if (paths[0]) {
      setDraftFilePath(paths[0])
      setActiveView(resolveTranscribeWorkspaceView('new-transcription'))
    }
  }

  const startTranscriptionForPath = async (filePath: string) => {
    setActiveView(resolveTranscribeWorkspaceView('new-transcription'))
    setDraftFilePath(filePath)
    setDraftResultText('')
    setLoadError(null)
    setStatus({ phase: 'preparing', message: 'Starting…' })
    try {
      await onSaveAppSettings({
        transcriptionModelId: modelId,
        transcriptionLanguage: language,
        transcriptionTimestampInterval: timestampInterval,
      })
      await window.narralab.transcription.start({ filePath, modelId, language, timestampInterval })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      setStatus({ phase: 'error', message: 'Failed to start', error: msg })
    }
  }

  const start = async () => {
    if (!draftFilePath) return
    await startTranscriptionForPath(draftFilePath)
  }

  const cancel = async () => {
    await window.narralab.transcription.cancel()
  }

  const copyText = async (text: string) => {
    if (!text) return
    await navigator.clipboard.writeText(text)
  }

  const saveTxt = async (text: string) => {
    if (!text.trim()) return
    await window.narralab.transcription.saveAs(text)
  }

  const handleSaveDraftToLibrary = async () => {
    if (!draftResultText.trim() || isSaving) return
    setIsSaving(true)
    try {
      const name = draftFilePath?.split(/[/\\]/).pop() || 'Untitled'
      const newItem = await window.narralab.transcription.library.items.create({
        name,
        content: draftResultText,
        sourceFilePath: draftFilePath
      })
      // Pre-emptively update local state so selection works immediately
      setLibraryItems((current) => sortLibraryItems([...current, newItem]))
      setSelectedItemId(newItem.id)
      setLibraryResultText(draftResultText)
      setLibraryMetadataCollapsed(false)
      setDraftResultText('')
      setDraftFilePath(null)
      setStatus({ phase: 'idle', message: '' })
      setActiveView(resolveTranscribeWorkspaceView('library-selection'))
      await refreshLibrary() // Silent background refresh
    } catch (e) {
      console.error('Failed to save to library:', e)
    } finally {
      setIsSaving(false)
    }
  }

  const appendNotebook = async (text: string) => {
    if (!text.trim()) return
    const doc = await window.narralab.transcription.appendNotebook(text)
    onNotebookSynced(doc)
  }

  const catalogRows =
    setup?.catalog ??
    TRANSCRIPTION_MODEL_CATALOG.map((entry) => ({
      ...entry,
      downloaded: false,
    }))

  const ffmpegOk = setup?.ffmpegPath
  const whisperOk = setup?.whisperPath
  const setupOk = ffmpegOk && whisperOk
  const hasDownloadedModel = catalogRows.some((e) => e.downloaded)

  // File name for display
  const fileName = draftFilePath ? (draftFilePath.split(/[/\\]/).pop() ?? null) : null

  const handleNewTranscription = () => {
    setActiveView(resolveTranscribeWorkspaceView('new-transcription'))
    setSelectedItemId(null)
    setSelectedLinkedSceneId(null)
    setLibraryResultText('')
    setDraftResultText('')
    setDraftFilePath(null)
    setLoadError(null)
    setStatus({ phase: 'idle', message: '' })
  }

  const updateLibraryItemLocally = useCallback(
    (itemId: string, patch: Partial<TranscriptionItem>) => {
      setLibraryItems((current) =>
        sortLibraryItems(
          current.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  ...patch,
                }
              : item,
          ),
        ),
      )
    },
    [sortLibraryItems],
  )

  const mergeLibraryItemsLocally = useCallback(
    (nextItems: TranscriptionItem[]) => {
      setLibraryItems((current) => {
        const byId = new Map(current.map((item) => [item.id, item]))
        nextItems.forEach((item) => {
          byId.set(item.id, item)
        })
        return sortLibraryItems(Array.from(byId.values()))
      })
    },
    [sortLibraryItems],
  )

  const saveHighlights = useCallback(
    (itemId: string, highlights: TranscriptionItem['highlights']) => {
      updateLibraryItemLocally(itemId, { highlights })
      void (async () => {
        try {
          const updatedItem = await window.narralab.transcription.library.items.update({
            id: itemId,
            highlights,
          })
          mergeLibraryItemsLocally([updatedItem])
        } catch (error) {
          console.error('Failed to save transcript highlights:', error)
          void refreshLibrary()
        }
      })()
    },
    [mergeLibraryItemsLocally, refreshLibrary, updateLibraryItemLocally],
  )

  const selectedItem = libraryItems.find(i => i.id === selectedItemId)
  const hasChanges = selectedItem ? libraryResultText !== selectedItem.content : false
  const libraryPaneStyle = {
    '--transcribe-library-width': `${libraryResize.size}px`,
  } as CSSProperties
  const libraryMetadataPaneStyle = {
    '--transcribe-library-metadata-width': `${libraryMetadataResize.size}px`,
  } as CSSProperties

  if (detachedTranscriptOnly) {
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
        {selectedItem ? (
          <TranscriptPanel
            resultText={libraryResultText}
            highlights={selectedItem.highlights}
            projectMeta={projectMeta}
            selectedItemId={selectedItemId}
            subtitle={selectedItem.name}
            isSaving={isSaving}
            hasChanges={hasChanges}
            onCopy={() => void copyText(libraryResultText)}
            onAppendNotebook={() => void appendNotebook(libraryResultText)}
            onSaveChanges={() => {
              if (!selectedItemId) return
              void (async () => {
                setIsSaving(true)
                try {
                  const updatedItem = await window.narralab.transcription.library.items.update({
                    id: selectedItemId,
                    content: libraryResultText,
                  })
                  mergeLibraryItemsLocally([updatedItem])
                  void refreshLibrary()
                } catch (error) {
                  console.error('Failed to save changes:', error)
                } finally {
                  setIsSaving(false)
                }
              })()
            }}
            onSaveToLibrary={() => undefined}
            onSaveTxt={() => void saveTxt(libraryResultText)}
            onDetach={undefined}
            onResultTextChange={setLibraryResultText}
            onHighlightsChange={(next) => {
              if (!selectedItemId) return
              saveHighlights(selectedItemId, next)
            }}
          />
        ) : selectedItemId ? (
          <LibraryEmptyState />
        ) : (
          <Panel className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 items-center justify-center p-8 text-center">
              <div className="max-w-sm text-sm text-muted">
                Open a transcript from the library to view it in a detached transcript window.
              </div>
            </div>
          </Panel>
        )}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <TranscribeWorkspaceHeader
        activeView={activeView}
        setupOk={Boolean(setupOk)}
        onChangeView={setActiveView}
        onOpenTranscribeSettings={onOpenTranscribeSettings}
      />

      {activeView === 'transcribe' ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-2">
          <NewTranscriptionPanel
            catalogRows={catalogRows}
            modelId={modelId}
            language={language}
            timestampInterval={timestampInterval}
            usesCustomTimestampInterval={usesCustomTimestampInterval}
            onModelIdChange={setModelId}
            onLanguageChange={setLanguage}
            onTimestampIntervalChange={setTimestampInterval}
            fileName={fileName}
            filePath={draftFilePath}
            onDropMedia={onDropMedia}
            onPickFile={() => void pickFile()}
            onStart={() => void start()}
            onCancel={() => void cancel()}
            setupOk={Boolean(setupOk)}
            hasDownloadedModel={hasDownloadedModel}
            jobActive={jobActive}
            elapsedSec={elapsedSec}
            status={status}
            loadError={loadError}
          />

          <TranscriptPanel
            resultText={draftResultText}
            highlights={[]}
            projectMeta={projectMeta}
            selectedItemId={null}
            subtitle={fileName ? `Draft · ${fileName}` : 'Draft transcript'}
            isSaving={isSaving}
            hasChanges={false}
            onCopy={() => void copyText(draftResultText)}
            onAppendNotebook={() => void appendNotebook(draftResultText)}
            onSaveChanges={() => undefined}
            onSaveToLibrary={() => void handleSaveDraftToLibrary()}
            onSaveTxt={() => void saveTxt(draftResultText)}
            onDetach={undefined}
            onResultTextChange={setDraftResultText}
            onHighlightsChange={undefined}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch lg:gap-4">
          <div
            className="min-h-0 shrink-0 lg:h-full lg:w-[var(--transcribe-library-width)]"
            style={libraryPaneStyle}
          >
            <TranscriptionLibrarySidebar
              folders={libraryFolders}
              items={libraryItems}
              selectedItemId={selectedItemId}
              onSelectItem={handleSelectItem}
              onCreateFolder={async (name, parentPath) => {
                await window.narralab.transcription.library.folders.create(name, parentPath)
                await refreshLibrary()
              }}
              onUpdateFolder={async (currentPath, input) => {
                await window.narralab.transcription.library.folders.update(currentPath, input)
                await refreshLibrary()
              }}
              onDeleteFolder={async (currentPath) => {
                await window.narralab.transcription.library.folders.delete(currentPath)
                await refreshLibrary()
              }}
              onMoveItemsToFolder={async (itemIds, folderPath) => {
                const updatedItems = await Promise.all(
                  itemIds.map((id) =>
                    window.narralab.transcription.library.items.update({ id, folder: folderPath }),
                  ),
                )
                mergeLibraryItemsLocally(updatedItems)
                void refreshLibrary()
              }}
              onUpdateItem={async (id, name) => {
                const updatedItem = await window.narralab.transcription.library.items.update({ id, name })
                mergeLibraryItemsLocally([updatedItem])
                void refreshLibrary()
              }}
              onDeleteItem={async (id) => {
                await window.narralab.transcription.library.items.delete(id)
                if (id === selectedItemId) {
                  setSelectedItemId(null)
                  setLibraryResultText('')
                }
                await refreshLibrary()
              }}
              onNewTranscription={handleNewTranscription}
            />
          </div>

          <div className="hidden lg:flex lg:h-full lg:items-stretch">
            <ResizeHandle
              label="Resize transcription library"
              active={libraryResize.isResizing}
              onPointerDown={libraryResize.startResize(1)}
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch lg:gap-4">
            {selectedItem ? (
              <>
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden lg:h-full">
                  <TranscriptPanel
                    resultText={libraryResultText}
                    highlights={selectedItem.highlights}
                    projectMeta={projectMeta}
                    selectedItemId={selectedItemId}
                    subtitle={selectedItem.name}
                    isSaving={isSaving}
                    hasChanges={hasChanges}
                    onCopy={() => void copyText(libraryResultText)}
                    onAppendNotebook={() => void appendNotebook(libraryResultText)}
                    onSaveChanges={() => {
                      if (!selectedItemId) return
                      void (async () => {
                        setIsSaving(true)
                        try {
                          const updatedItem = await window.narralab.transcription.library.items.update({
                            id: selectedItemId,
                            content: libraryResultText,
                          })
                          mergeLibraryItemsLocally([updatedItem])
                          void refreshLibrary()
                        } catch (error) {
                          console.error('Failed to save changes:', error)
                        } finally {
                          setIsSaving(false)
                        }
                      })()
                    }}
                    onSaveToLibrary={() => undefined}
                    onSaveTxt={() => void saveTxt(libraryResultText)}
                    onDetach={() => {
                      void (async () => {
                        if (!selectedItemId) return
                        await window.narralab.windows.updateGlobalUiState({
                          selectedTranscriptionItemId: selectedItemId,
                        })
                        await window.narralab.windows.openWorkspace('transcribe', {
                          transcriptionItemId: selectedItemId,
                        })
                      })()
                    }}
                    onResultTextChange={setLibraryResultText}
                    onHighlightsChange={(next) => {
                      if (!selectedItemId) return
                      saveHighlights(selectedItemId, next)
                    }}
                  />
                </div>

                <div className="hidden lg:flex lg:h-full lg:shrink-0 lg:items-stretch">
                  {libraryMetadataCollapsed ? (
                    <div className="w-10 shrink-0">
                      <CollapsedRail side="right" title="Metadata" onExpand={() => setLibraryMetadataCollapsed(false)} />
                    </div>
                  ) : (
                    <>
                      <div className="hidden lg:flex lg:h-full lg:items-stretch">
                        <ResizeHandle
                          label="Resize transcript metadata"
                          active={libraryMetadataResize.isResizing}
                          onPointerDown={libraryMetadataResize.startResize(-1)}
                        />
                      </div>
                      <div
                        className="min-h-0 shrink-0 overflow-hidden lg:h-full"
                        style={{ ...libraryMetadataPaneStyle, width: 'var(--transcribe-library-metadata-width)' }}
                      >
                        <SavedTranscriptionMetadataPanel
                          filePath={selectedItem.sourceFilePath}
                          selectedItem={selectedItem}
                          selectedItemId={selectedItemId}
                          selectedSceneId={selectedLinkedSceneId}
                          scenes={scenes}
                          isSaving={isSaving}
                          resultText={libraryResultText}
                          onCollapse={() => setLibraryMetadataCollapsed(true)}
                          onLinkScene={(nextSceneId) => {
                            if (!selectedItemId) return
                            const previousSceneId = selectedItem.sceneId
                            void (async () => {
                              setIsSaving(true)
                              setSelectedLinkedSceneId(nextSceneId)
                              updateLibraryItemLocally(selectedItemId, { sceneId: nextSceneId })
                              try {
                                const updatedItem = await window.narralab.transcription.library.items.update({
                                  id: selectedItemId,
                                  sceneId: nextSceneId,
                                })
                                mergeLibraryItemsLocally([updatedItem])
                                setSelectedLinkedSceneId(updatedItem.sceneId)
                                void refreshLibrary()
                              } catch (error) {
                                setSelectedLinkedSceneId(previousSceneId)
                                updateLibraryItemLocally(selectedItemId, { sceneId: previousSceneId })
                                console.error('Failed to link scene:', error)
                              } finally {
                                setIsSaving(false)
                              }
                            })()
                          }}
                          onSaveToArchive={() => {
                            void window.narralab.transcription.saveToArchive({
                              name: selectedItem.name,
                              content: libraryResultText,
                            })
                          }}
                          onTranscribeAgain={() => {
                            if (!selectedItem.sourceFilePath) return
                            void startTranscriptionForPath(selectedItem.sourceFilePath)
                          }}
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="lg:hidden">
                  <SavedTranscriptionMetadataPanel
                    filePath={selectedItem.sourceFilePath}
                    selectedItem={selectedItem}
                    selectedItemId={selectedItemId}
                    selectedSceneId={selectedLinkedSceneId}
                    scenes={scenes}
                    isSaving={isSaving}
                    resultText={libraryResultText}
                    onLinkScene={(nextSceneId) => {
                      if (!selectedItemId) return
                      const previousSceneId = selectedItem.sceneId
                      void (async () => {
                        setIsSaving(true)
                        setSelectedLinkedSceneId(nextSceneId)
                        updateLibraryItemLocally(selectedItemId, { sceneId: nextSceneId })
                        try {
                          const updatedItem = await window.narralab.transcription.library.items.update({
                            id: selectedItemId,
                            sceneId: nextSceneId,
                          })
                          mergeLibraryItemsLocally([updatedItem])
                          setSelectedLinkedSceneId(updatedItem.sceneId)
                          void refreshLibrary()
                        } catch (error) {
                          setSelectedLinkedSceneId(previousSceneId)
                          updateLibraryItemLocally(selectedItemId, { sceneId: previousSceneId })
                          console.error('Failed to link scene:', error)
                        } finally {
                          setIsSaving(false)
                        }
                      })()
                    }}
                    onSaveToArchive={() => {
                      void window.narralab.transcription.saveToArchive({
                        name: selectedItem.name,
                        content: libraryResultText,
                      })
                    }}
                    onTranscribeAgain={() => {
                      if (!selectedItem.sourceFilePath) return
                      void startTranscriptionForPath(selectedItem.sourceFilePath)
                    }}
                  />
                </div>
              </>
            ) : (
              <LibraryEmptyState />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
