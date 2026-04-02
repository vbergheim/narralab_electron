import { useEffect, useState, useCallback } from 'react'

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
  NewTranscriptionPanel,
  SavedTranscriptionMetadataPanel,
  TranscriptPanel,
  TranscribeWorkspaceHeader,
} from './transcribe-workspace-sections'
import { TranscriptionLibrarySidebar } from './components/transcription-library-sidebar'
import { isTranscriptionJobActive, presetTimestampIntervals } from './transcribe-workspace-utils'

type Props = {
  projectMeta: ProjectMeta | null
  settings: AppSettings
  onSaveAppSettings(input: AppSettingsUpdateInput): Promise<void>
  onNotebookSynced(document: NotebookDocument): void
  onOpenTranscribeSettings(): void
}


export function TranscribeWorkspace({
  projectMeta,
  settings,
  onSaveAppSettings,
  onNotebookSynced,
  onOpenTranscribeSettings,
}: Props) {
  const [setup, setSetup] = useState<TranscriptionSetup | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [modelId, setModelId] = useState<TranscriptionModelId>(settings.transcription.modelId)
  const [language, setLanguage] = useState<TranscriptionLanguage>(settings.transcription.language)
  const [timestampInterval, setTimestampInterval] = useState<TranscriptionTimestampInterval>(
    settings.transcription.timestampInterval,
  )
  const [status, setStatus] = useState<TranscriptionStatus>({ phase: 'idle', message: '' })
  const [resultText, setResultText] = useState('')
  const [elapsedSec, setElapsedSec] = useState(0)

  // Library state
  const [libraryFolders, setLibraryFolders] = useState<TranscriptionFolder[]>([])
  const [libraryItems, setLibraryItems] = useState<TranscriptionItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isNewTranscription, setIsNewTranscription] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Project data for linking
  const [scenes, setScenes] = useState<Scene[]>([])

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
      setLibraryItems(items)
    } catch (e) {
      console.error('Failed to load library:', e)
    }
  }, [])

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
          setResultText(text)

          // Auto-save to library
          if (filePath) {
            const name = filePath.split(/[/\\]/).pop() || 'Untitled'
            try {
              const newItem = await window.narralab.transcription.library.items.create({
                name,
                content: text,
                sourceFilePath: filePath
              })
              await refreshLibrary()
              setSelectedItemId(newItem.id)
              setIsNewTranscription(false)
            } catch (e) {
              console.error('Failed to auto-save:', e)
            }
          }
        }
        if (event.payload.phase === 'error') {
          setResultText('')
        }
      }
    })
    return dispose
  }, [filePath, refreshLibrary])

  const handleSelectItem = useCallback((itemId: string) => {
    const item = libraryItems.find(i => i.id === itemId)
    if (item) {
      setSelectedItemId(itemId)
      setResultText(item.content)
      setIsNewTranscription(false)
      setFilePath(item.sourceFilePath)
      // If we are looking at a saved item, reset live status
      setStatus({ phase: 'idle', message: '' })
    }
  }, [libraryItems])

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

      if (event.type === 'global-ui-state' && event.payload.selectedTranscriptionItemId) {
        handleSelectItem(event.payload.selectedTranscriptionItemId)
        // Clear it so it doesn't re-trigger on next sync if we select something else
        void window.narralab.windows.updateGlobalUiState({ selectedTranscriptionItemId: null })
      }
    })
    return dispose
  }, [handleSelectItem, refreshLibrary, refreshScenes])

  const pickFile = async () => {
    const path = await window.narralab.transcription.pickFile()
    if (path) {
      setFilePath(path)
    }
  }

  const onDropMedia = (event: React.DragEvent) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files)
    const paths = window.narralab.archive.items.resolveDroppedPaths(files)
    if (paths[0]) {
      setFilePath(paths[0])
    }
  }

  const start = async () => {
    if (!filePath) return
    setResultText('')
    setLoadError(null)
    setStatus({ phase: 'preparing', message: 'Starting…' })
    try {
      setIsNewTranscription(true)
      setSelectedItemId(null)
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

  const cancel = async () => {
    await window.narralab.transcription.cancel()
  }

  const copyResult = async () => {
    if (!resultText) return
    await navigator.clipboard.writeText(resultText)
  }

  const saveTxt = async () => {
    if (!resultText.trim()) return
    await window.narralab.transcription.saveAs(resultText)
  }

  const handleSaveToLibrary = async () => {
    if (!resultText.trim() || isSaving) return
    setIsSaving(true)
    try {
      const name = filePath?.split(/[/\\]/).pop() || 'Untitled'
      const newItem = await window.narralab.transcription.library.items.create({
        name,
        content: resultText,
        sourceFilePath: filePath
      })
      // Pre-emptively update local state so selection works immediately
      setLibraryItems(prev => [...prev, newItem])
      setSelectedItemId(newItem.id)
      setIsNewTranscription(false)
      await refreshLibrary() // Silent background refresh
    } catch (e) {
      console.error('Failed to save to library:', e)
    } finally {
      setIsSaving(false)
    }
  }

  const appendNotebook = async () => {
    if (!resultText.trim()) return
    const doc = await window.narralab.transcription.appendNotebook(resultText)
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
  const fileName = filePath ? (filePath.split(/[/\\]/).pop() ?? null) : null

  const handleNewTranscription = () => {
    setIsNewTranscription(true)
    setSelectedItemId(null)
    setResultText('')
    setFilePath(null)
    setStatus({ phase: 'idle', message: '' })
  }

  const selectedItem = libraryItems.find(i => i.id === selectedItemId)
  const hasChanges = selectedItem ? resultText !== selectedItem.content : false

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <TranscribeWorkspaceHeader setupOk={Boolean(setupOk)} onOpenTranscribeSettings={onOpenTranscribeSettings} />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-[260px_1fr_1fr]">
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
            await Promise.all(
              itemIds.map((id) =>
                window.narralab.transcription.library.items.update({ id, folder: folderPath }),
              ),
            )
            await refreshLibrary()
          }}
          onUpdateItem={async (id, name) => {
            await window.narralab.transcription.library.items.update({ id, name })
            await refreshLibrary()
          }}
          onDeleteItem={async (id) => {
            await window.narralab.transcription.library.items.delete(id)
            if (id === selectedItemId) handleNewTranscription()
            await refreshLibrary()
          }}
          onNewTranscription={handleNewTranscription}
        />

        {isNewTranscription ? (
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
            filePath={filePath}
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
            resultText={resultText}
            isSaving={isSaving}
            onSaveToLibrary={() => void handleSaveToLibrary()}
          />
        ) : (
          <SavedTranscriptionMetadataPanel
            filePath={filePath}
            selectedItem={selectedItem}
            selectedItemId={selectedItemId}
            scenes={scenes}
            isSaving={isSaving}
            resultText={resultText}
            onLinkScene={(nextSceneId) => {
              if (!selectedItemId) return
              void (async () => {
                setIsSaving(true)
                try {
                  await window.narralab.transcription.library.items.update({
                    id: selectedItemId,
                    sceneId: nextSceneId,
                  })
                  await refreshLibrary()
                } catch (error) {
                  console.error('Failed to link scene:', error)
                } finally {
                  setIsSaving(false)
                }
              })()
            }}
            onSaveToArchive={() => {
              if (!selectedItem) return
              void window.narralab.transcription.saveToArchive({
                name: selectedItem.name,
                content: resultText,
              })
            }}
            onTranscribeAgain={() => {
              if (!filePath) return
              void window.narralab.transcription.start({ filePath, modelId })
            }}
          />
        )}

        <TranscriptPanel
          resultText={resultText}
          projectMeta={projectMeta}
          selectedItemId={selectedItemId}
          isSaving={isSaving}
          hasChanges={hasChanges}
          onCopy={() => void copyResult()}
          onAppendNotebook={() => void appendNotebook()}
          onSaveChanges={() => {
            if (!selectedItemId) return
            void (async () => {
              setIsSaving(true)
              try {
                await window.narralab.transcription.library.items.update({ id: selectedItemId, content: resultText })
                await refreshLibrary()
              } catch (error) {
                console.error('Failed to save changes:', error)
              } finally {
                setIsSaving(false)
              }
            })()
          }}
          onSaveToLibrary={() => void handleSaveToLibrary()}
          onSaveTxt={() => void saveTxt()}
          onResultTextChange={setResultText}
        />
      </div>
    </div>
  )
}
