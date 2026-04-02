import type { ArchiveFolder, ArchiveFolderUpdateInput, ArchiveItem, ArchiveItemUpdateInput } from './archive'
import type {
  AppSettings,
  AppSettingsUpdateInput,
  AppTranscriptionSettings,
  ConsultantChatInput,
  ConsultantChatResult,
  SavedWindowLayout,
  WindowWorkspace,
} from './ai'
import type {
  AddSceneToBoardResult,
  Board,
  BoardDropPosition,
  BoardViewMode,
  BoardFolder,
  BoardItem,
  BoardItemKind,
  BlockTemplate,
  BoardUpdateInput,
  BoardItemUpdateInput,
  BoardTextItem,
} from './board'
import type { Scene, SceneBeat, SceneBeatUpdateInput, SceneFolder, SceneUpdateInput } from './scene'
import type { Tag, TagType } from './tag'
import type {
  TranscriptionLanguage,
  TranscriptionMainDiagnostics,
  TranscriptionModelCatalogEntry,
  TranscriptionModelId,
  TranscriptionProgressEvent,
  TranscriptionStatus,
  TranscriptionTimestampInterval,
  TranscriptionFolder,
  TranscriptionItem,
  TranscriptionItemUpdateInput,
} from './transcription'

export type ProjectMeta = {
  path: string
  name: string
}

export type ProjectSettings = {
  title: string
  genre: string
  format: string
  targetRuntimeMinutes: number
  logline: string
  defaultBoardView: BoardViewMode
  enabledBlockKinds: Array<Exclude<BoardItemKind, 'scene'>>
  blockKindOrder: Array<Exclude<BoardItemKind, 'scene'>>
}

export type ProjectSettingsUpdateInput = Partial<ProjectSettings>

export type NotebookTab = {
  id: string
  title: string
  /** Rich text as HTML (project-local, trusted content). */
  contentHtml: string
  updatedAt: string | null
}

export type NotebookDocument = {
  tabs: NotebookTab[]
  activeTabId: string | null
  /** Latest save across tabs (for status / export). */
  updatedAt: string | null
}

export type GlobalUiState = {
  activeBoardId: string | null
  selectedBoardId: string | null
  selectedSceneId: string | null
  selectedSceneIds: string[]
  selectedBoardItemId: string | null
  selectedArchiveFolderId: string | null
  selectedTranscriptionItemId: string | null
}

export type WindowContext = {
  windowId: number
  role: 'main' | 'detached'
  workspace: WindowWorkspace | 'main'
  boardId: string | null
  viewMode: BoardViewMode
  sceneDensity: import('./view').SceneDensity
}

export type WindowDragSession =
  | {
      kind: 'scene'
      sceneIds: string[]
    }
  | {
      kind: 'transcription'
      itemIds: string[]
    }
  | null

export type TranscriptionSetup = {
  catalog: Array<TranscriptionModelCatalogEntry & { downloaded: boolean }>
  ffmpegPath: string | null
  ffprobePath: string | null
  whisperPath: string | null
  /** One-click FFmpeg install (same binaries as the ffmpeg-static npm package). */
  ffmpegAutoDownloadSupported: boolean
  /** One-click engine install (Windows zip / macOS Homebrew bottles). */
  engineAutoDownloadSupported: boolean
  settings: AppTranscriptionSettings
}

export type BoardScriptExportFormat = 'txt-formatted' | 'txt-plain' | 'md' | 'html-screenplay' | 'doc-screenplay'

export type ShootLogImportError = {
  sheet: string
  row: number
  message: string
}

export type ShootLogImportResult = {
  addedSceneCount: number
  addedBeatCount: number
  skippedRowCount: number
  errors: ShootLogImportError[]
}

export type ProjectSnapshotV1 = {
  schemaVersion: 1
  exportedAt: string
  project: ProjectMeta | null
  scenes: Scene[]
  tags: Tag[]
  boards: Array<
    Omit<Board, 'items'> & {
      items: Array<
        Omit<BoardItem, 'kind'> & {
          kind?: BoardItemKind
          chapter?: string
        }
      >
    }
  >
}

export type ProjectSnapshotV2 = {
  schemaVersion: 2
  exportedAt: string
  project: ProjectMeta | null
  scenes: Scene[]
  tags: Tag[]
  boards: Board[]
}

export type ProjectSnapshotV3 = {
  schemaVersion: 3
  exportedAt: string
  project: ProjectMeta | null
  scenes: Scene[]
  tags: Tag[]
  boards: Board[]
  notebook: NotebookDocument
}

export type ProjectSnapshotV4 = {
  schemaVersion: 4
  exportedAt: string
  project: ProjectMeta | null
  scenes: Scene[]
  tags: Tag[]
  boards: Board[]
  notebook: NotebookDocument
}

export type ProjectSnapshotV5 = {
  schemaVersion: 5
  exportedAt: string
  project: ProjectMeta | null
  projectSettings: ProjectSettings
  scenes: Scene[]
  tags: Tag[]
  boards: Board[]
  notebook: NotebookDocument
}

export type ProjectSnapshotV6 = {
  schemaVersion: 6
  exportedAt: string
  project: ProjectMeta | null
  projectSettings: ProjectSettings
  scenes: Scene[]
  tags: Tag[]
  boards: Board[]
  notebook: NotebookDocument
}

export type ProjectSnapshotV7 = {
  schemaVersion: 7
  exportedAt: string
  project: ProjectMeta | null
  projectSettings: ProjectSettings
  scenes: Scene[]
  tags: Tag[]
  boards: Board[]
  notebook: NotebookDocument
}

export type ProjectSnapshot =
  | ProjectSnapshotV1
  | ProjectSnapshotV2
  | ProjectSnapshotV3
  | ProjectSnapshotV4
  | ProjectSnapshotV5
  | ProjectSnapshotV6
  | ProjectSnapshotV7

export interface NarraLabApi {
  project: {
    create(path?: string | null): Promise<ProjectMeta | null>
    open(path?: string | null): Promise<ProjectMeta | null>
    saveAs(path?: string | null): Promise<ProjectMeta | null>
    exportJson(path?: string | null): Promise<string | null>
    exportBoardScript(boardId: string, path?: string | null, format?: BoardScriptExportFormat): Promise<string | null>
    importJson(path?: string | null): Promise<ProjectMeta | null>
    importShootLog(path?: string | null): Promise<ShootLogImportResult | null>
    getMeta(): Promise<ProjectMeta | null>
    getSettings(): Promise<ProjectSettings>
    updateSettings(input: ProjectSettingsUpdateInput): Promise<ProjectSettings>
  }
  notebook: {
    get(): Promise<NotebookDocument>
    update(document: NotebookDocument): Promise<NotebookDocument>
  }
  archive: {
    folders: {
      list(): Promise<ArchiveFolder[]>
      create(name: string, parentId?: string | null): Promise<ArchiveFolder[]>
      rename(folderId: string, name: string): Promise<ArchiveFolder[]>
      update(input: ArchiveFolderUpdateInput): Promise<ArchiveFolder[]>
      delete(folderId: string): Promise<ArchiveFolder[]>
    }
    items: {
      list(): Promise<ArchiveItem[]>
      add(filePaths?: string[] | null, folderId?: string | null): Promise<ArchiveItem[]>
      resolveDroppedPaths(files: File[]): string[]
      update(input: ArchiveItemUpdateInput): Promise<ArchiveItem>
      delete(itemId: string): Promise<void>
      open(itemId: string): Promise<void>
      reveal(itemId: string): Promise<void>
    }
  }
  scenes: {
    list(): Promise<Scene[]>
    create(): Promise<Scene>
    update(input: SceneUpdateInput): Promise<Scene>
    delete(id: string): Promise<void>
    reorder(sceneIds: string[]): Promise<Scene[]>
  }
  sceneBeats: {
    create(sceneId: string, afterBeatId?: string | null): Promise<SceneBeat>
    update(input: SceneBeatUpdateInput): Promise<SceneBeat>
    delete(id: string): Promise<void>
    reorder(sceneId: string, beatIds: string[]): Promise<SceneBeat[]>
  }
  sceneFolders: {
    list(): Promise<SceneFolder[]>
    create(name: string, parentPath?: string | null): Promise<SceneFolder[]>
    update(currentPath: string, input: { name?: string; color?: Scene['color']; parentPath?: string | null }): Promise<SceneFolder[]>
    delete(currentPath: string): Promise<SceneFolder[]>
  }
  boards: {
    list(): Promise<Board[]>
    create(name: string, folder?: string | null): Promise<Board>
    createClone(sourceBoardId: string, name?: string): Promise<Board>
    delete(boardId: string): Promise<Board[]>
    updateBoard(input: BoardUpdateInput): Promise<Board>
    reorderBoards(boardIds: string[]): Promise<Board[]>
    addScene(boardId: string, sceneId: string, afterItemId?: string | null, boardPosition?: BoardDropPosition | null): Promise<AddSceneToBoardResult>
    addBlock(boardId: string, kind: Exclude<BoardItemKind, 'scene'>, afterItemId?: string | null): Promise<BoardTextItem>
    duplicateItem(itemId: string): Promise<BoardItem>
    removeItem(itemId: string): Promise<void>
    reorder(boardId: string, itemIds: string[]): Promise<BoardItem[]>
    updateItem(input: BoardItemUpdateInput): Promise<BoardItem>
  }
  boardFolders: {
    list(): Promise<BoardFolder[]>
    create(name: string, parentPath?: string | null): Promise<BoardFolder[]>
    rename(oldPath: string, newName: string): Promise<BoardFolder[]>
    update(currentPath: string, input: { name?: string; color?: Scene['color']; parentPath?: string | null }): Promise<BoardFolder[]>
    delete(currentPath: string): Promise<BoardFolder[]>
  }
  blockTemplates: {
    list(): Promise<BlockTemplate[]>
    create(input: { kind: Exclude<BoardItemKind, 'scene'>; name: string; title: string; body: string }): Promise<BlockTemplate[]>
    delete(id: string): Promise<BlockTemplate[]>
  }
  settings: {
    get(): Promise<AppSettings>
    update(input: AppSettingsUpdateInput): Promise<AppSettings>
  }
  windows: {
    getContext(): Promise<WindowContext>
    listContexts(): Promise<WindowContext[]>
    openWorkspace(workspace: WindowWorkspace, options?: Partial<WindowContext>): Promise<WindowContext>
    updateContext(input: Partial<Pick<WindowContext, 'boardId' | 'viewMode' | 'sceneDensity'>>): Promise<WindowContext>
    refreshProject(): Promise<void>
    getDragSession(): WindowDragSession
    readDragSession(): Promise<WindowDragSession>
    consumeDragSession(): Promise<WindowDragSession>
    setDragSession(session: WindowDragSession): Promise<WindowDragSession>
    getGlobalUiState(): Promise<GlobalUiState>
    updateGlobalUiState(input: Partial<GlobalUiState>): Promise<GlobalUiState>
    listLayouts(): Promise<SavedWindowLayout[]>
    saveLayout(name: string): Promise<SavedWindowLayout>
    applyLayout(layoutId: string): Promise<SavedWindowLayout | null>
    deleteLayout(layoutId: string): Promise<SavedWindowLayout[]>
    subscribe(
      listener: (event:
        | { type: 'project-changed' }
        | { type: 'window-context'; payload: WindowContext }
        | { type: 'global-ui-state'; payload: GlobalUiState }
        | { type: 'drag-session'; payload: WindowDragSession }) => void,
    ): () => void
  }
  consultant: {
    chat(input: ConsultantChatInput): Promise<ConsultantChatResult>
  }
  tags: {
    list(): Promise<Tag[]>
    upsert(input: { id?: string; name: string; type?: TagType }): Promise<Tag>
    delete(id: string): Promise<void>
  }
  transcription: {
    pickFile(): Promise<string | null>
    getSetup(): Promise<TranscriptionSetup>
    downloadEngine(): Promise<void>
    downloadFfmpeg(): Promise<void>
    downloadModel(modelId: TranscriptionModelId): Promise<void>
    deleteModel(modelId: TranscriptionModelId): Promise<void>
    start(input: {
      filePath: string
      modelId?: TranscriptionModelId
      language?: TranscriptionLanguage
      timestampInterval?: TranscriptionTimestampInterval
    }): Promise<{ ok: true }>
    cancel(): Promise<{ ok: true }>
    getStatus(): Promise<TranscriptionStatus>
    getDiagnostics(): Promise<TranscriptionMainDiagnostics>
    appendNotebook(text: string): Promise<NotebookDocument>
    saveAs(text: string): Promise<string | null>
    saveToArchive(input: { name: string; content: string }): Promise<ArchiveItem | null>
    subscribe(listener: (event: TranscriptionProgressEvent) => void): () => void
    library: {
      folders: {
        list(): Promise<TranscriptionFolder[]>
        create(name: string, parentPath?: string | null): Promise<TranscriptionFolder[]>
        update(
          currentPath: string,
          input: { name?: string; color?: TranscriptionFolder['color']; parentPath?: string | null },
        ): Promise<TranscriptionFolder[]>
        delete(currentPath: string): Promise<TranscriptionFolder[]>
      }
      items: {
        list(): Promise<TranscriptionItem[]>
        create(input: {
          name: string
          content: string
          folder?: string
          sourceFilePath?: string | null
        }): Promise<TranscriptionItem>
        update(input: TranscriptionItemUpdateInput): Promise<TranscriptionItem>
        delete(itemId: string): Promise<void>
      }
    }
  }
}
