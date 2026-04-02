import type { ArchiveFolder, ArchiveItem } from '@/types/archive'
import type {
  AppSettings,
  AppSettingsUpdateInput,
  ConsultantContextMode,
  ConsultantMessage,
} from '@/types/ai'
import type {
  AddSceneToBoardResult,
  BlockTemplate,
  Board,
  BoardDropPosition,
  BoardFolder,
  BoardTextItem,
  BoardTextItemKind,
  BoardUpdateInput,
} from '@/types/board'
import type {
  BoardScriptExportFormat,
  GlobalUiState,
  NotebookDocument,
  ProjectChangeScope,
  ProjectMeta,
  ProjectSettings,
  ProjectSettingsUpdateInput,
} from '@/types/project'
import type { Scene, SceneBeatUpdateInput, SceneFolder, SceneUpdateInput } from '@/types/scene'
import type { Tag } from '@/types/tag'

export type WorkspaceMode =
  | 'outline'
  | 'bank'
  | 'notebook'
  | 'archive'
  | 'consultant'
  | 'settings'
  | 'board-manager'
  | 'transcribe'

export type SceneDraftInput = Omit<Scene, 'tagIds' | 'createdAt' | 'updatedAt' | 'beats'> & {
  tagNames: string[]
}

export type BoardItemDraftInput = {
  id: string
  kind?: BoardTextItem['kind']
  title?: string
  body?: string
  boardX?: number
  boardY?: number
  boardW?: number
  boardH?: number
}

export type SceneBulkUpdateInput = {
  sceneIds: string[]
  category?: string
  status?: Scene['status']
  color?: Scene['color']
}

export type AppStore = {
  ready: boolean
  busy: boolean
  pendingProjectActionCount: number
  consultantBusy: boolean
  error: string | null
  projectMeta: ProjectMeta | null
  projectSettings: ProjectSettings | null
  appSettings: AppSettings
  notebook: NotebookDocument
  archiveFolders: ArchiveFolder[]
  archiveItems: ArchiveItem[]
  scenes: Scene[]
  sceneFolders: SceneFolder[]
  boards: Board[]
  boardFolders: BoardFolder[]
  blockTemplates: BlockTemplate[]
  tags: Tag[]
  activeBoardId: string | null
  selectedBoardId: string | null
  selectedSceneId: string | null
  selectedSceneIds: string[]
  selectedBoardItemId: string | null
  selectedArchiveFolderId: string | null
  consultantMessages: ConsultantMessage[]
  consultantContextMode: ConsultantContextMode
  workspaceMode: WorkspaceMode
  updateAppSettings(input: AppSettingsUpdateInput): Promise<void>
  updateProjectSettings(input: ProjectSettingsUpdateInput): Promise<void>
  sendConsultantMessage(content: string): Promise<void>
  setConsultantContextMode(mode: ConsultantContextMode): void
  clearConsultantConversation(): void
  initialize(): Promise<void>
  refreshAll(): Promise<void>
  syncProjectChanges(scopes: ProjectChangeScope[]): Promise<void>
  createArchiveFolder(name: string, parentId?: string | null, color?: ArchiveFolder['color']): Promise<void>
  renameArchiveFolder(folderId: string, name: string): Promise<void>
  updateArchiveFolder(folderId: string, input: { name?: string; color?: ArchiveFolder['color']; parentId?: string | null }): Promise<void>
  deleteArchiveFolder(folderId: string): Promise<void>
  addArchiveFiles(filePaths?: string[] | null, folderId?: string | null): Promise<void>
  moveArchiveItem(itemId: string, folderId: string | null): Promise<void>
  deleteArchiveItem(itemId: string): Promise<void>
  openArchiveItem(itemId: string): Promise<void>
  revealArchiveItem(itemId: string): Promise<void>
  setSelectedArchiveFolder(folderId: string | null): void
  createProject(): Promise<void>
  openProject(): Promise<void>
  saveProjectAs(): Promise<void>
  importJson(): Promise<void>
  importShootLog(): Promise<void>
  exportJson(): Promise<void>
  exportActiveBoardScript(format: BoardScriptExportFormat): Promise<void>
  createScene(): Promise<void>
  createSceneBeat(sceneId: string, afterBeatId?: string | null): Promise<void>
  updateSceneBeat(input: SceneBeatUpdateInput): Promise<void>
  deleteSceneBeat(id: string): Promise<void>
  reorderSceneBeats(sceneId: string, beatIds: string[]): Promise<void>
  createSceneFolder(name: string, parentPath?: string | null): Promise<void>
  updateSceneFolder(currentPath: string, input: { name?: string; color?: SceneFolder['color']; parentPath?: string | null }): Promise<void>
  deleteSceneFolder(currentPath: string): Promise<void>
  moveScenesToFolder(sceneIds: string[], folder: string): Promise<void>
  reorderScenes(sceneIds: string[]): Promise<void>
  createBoard(name?: string, folder?: string | null): Promise<void>
  createBoardFolder(name: string, parentPath?: string | null): Promise<void>
  renameBoardFolder(oldPath: string, newName: string): Promise<void>
  updateBoardFolder(currentPath: string, input: { name?: string; color?: BoardFolder['color']; parentPath?: string | null }): Promise<void>
  deleteBoardFolder(currentPath: string): Promise<void>
  deleteBoard(boardId: string): Promise<void>
  deleteScene(sceneId: string): Promise<void>
  deleteScenes(sceneIds: string[]): Promise<void>
  persistSceneDraft(input: SceneDraftInput): Promise<void>
  bulkUpdateScenes(input: SceneBulkUpdateInput): Promise<void>
  persistBoardItemDraft(input: BoardItemDraftInput): Promise<void>
  updateNotebookDraft(notebook: NotebookDocument): void
  persistNotebook(notebook: NotebookDocument): Promise<void>
  duplicateScene(sceneId: string, options?: { addToBoardAfterItemId?: string | null }): Promise<void>
  openBoardInspector(boardId: string): void
  selectScene(sceneId: string | null, boardItemId?: string | null): void
  toggleSceneSelection(sceneId: string): void
  setSceneSelection(sceneIds: string[]): void
  clearSceneSelection(): void
  setWorkspaceMode(mode: WorkspaceMode): void
  setActiveBoard(boardId: string): void
  applyGlobalUiState(input: Partial<GlobalUiState>): void
  updateBoardDraft(input: BoardUpdateInput): Promise<void>
  reorderBoards(boardIds: string[]): Promise<void>
  cloneBoard(boardId: string): Promise<void>
  moveBoard(boardId: string, folder: string, beforeBoardId?: string | null): Promise<void>
  addSceneToBoard(boardId: string, sceneId: string, afterItemId?: string | null, boardPosition?: BoardDropPosition | null): Promise<AddSceneToBoardResult | null>
  addSceneToActiveBoard(sceneId: string, afterItemId?: string | null, boardPosition?: BoardDropPosition | null): Promise<AddSceneToBoardResult | null>
  addBlockToBoard(boardId: string, kind: BoardTextItemKind, afterItemId?: string | null): Promise<void>
  addBlockToActiveBoard(kind: BoardTextItemKind, afterItemId?: string | null): Promise<void>
  addBlockTemplateToBoard(boardId: string, templateId: string, afterItemId?: string | null): Promise<void>
  addBlockTemplateToActiveBoard(templateId: string, afterItemId?: string | null): Promise<void>
  saveBlockTemplate(input: { kind: BoardTextItemKind; name: string; title: string; body: string }): Promise<void>
  deleteBlockTemplate(templateId: string): Promise<void>
  copyBlockToBoard(itemId: string, boardId: string): Promise<void>
  duplicateBoardItem(itemId: string): Promise<void>
  removeBoardItem(itemId: string): Promise<void>
  reorderBoard(boardId: string, itemIds: string[]): Promise<void>
  reorderActiveBoard(itemIds: string[]): Promise<void>
  cloneActiveBoard(): Promise<void>
  dismissError(): void
}

export type AppStoreSet = (
  partial: Partial<AppStore> | ((state: AppStore) => Partial<AppStore>),
) => void

export type AppStoreGet = () => AppStore

export type BoardFolderMutationInput = {
  name?: string
  color?: BoardFolder['color']
  parentPath?: string | null
}

export type SceneFolderMutationInput = {
  name?: string
  color?: SceneFolder['color']
  parentPath?: string | null
}

export type ArchiveFolderMutationInput = {
  name?: string
  color?: ArchiveFolder['color']
}

export type SceneMutationInput = SceneUpdateInput
