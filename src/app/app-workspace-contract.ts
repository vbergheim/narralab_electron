import type { ReactNode } from 'react'

import type {
  AppSettings,
  AppSettingsUpdateInput,
  ConsultantContextMode,
  ConsultantMessage,
  WindowWorkspace,
} from '@/types/ai'
import type { ArchiveFolder, ArchiveItem } from '@/types/archive'
import type {
  AddSceneToBoardResult,
  BlockTemplate,
  Board,
  BoardDropPosition,
  BoardFolder,
  BoardItemUpdateInput,
  BoardTextItemKind,
  BoardUpdateInput,
  BoardViewMode,
} from '@/types/board'
import type {
  NotebookDocument,
  ProjectMeta,
  ProjectSettings,
  ProjectSettingsUpdateInput,
} from '@/types/project'
import type { Scene, SceneBeatUpdateInput, SceneFolder } from '@/types/scene'
import type { Tag } from '@/types/tag'
import type { SceneDensity } from '@/types/view'
import type { SettingsTab } from '@/features/settings/settings-workspace'

export type WorkspaceMode =
  | 'outline'
  | 'bank'
  | 'notebook'
  | 'archive'
  | 'consultant'
  | 'settings'
  | 'board-manager'
  | 'transcribe'

type ArchiveFolderUpdate = { name?: string; color?: ArchiveFolder['color'] }
type SceneFolderUpdate = { name?: string; color?: SceneFolder['color']; parentPath?: string | null }
type BoardFolderUpdate = { name?: string; color?: BoardFolder['color']; parentPath?: string | null }

export type SharedWorkspaceProps = {
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
  activeBoard: Board | null
  selectedSceneId: string | null
  selectedSceneIds: string[]
  selectedBoardItemId: string | null
  selectedArchiveFolderId: string | null
  filteredScenes: Scene[]
  filteredSceneIds: string[]
  sceneDensity: SceneDensity
  boardViewMode: BoardViewMode
  boardBlockKindsForProject: BoardTextItemKind[]
  inspectorContent: ReactNode
  onCreateProject(): void
  onOpenProject(): void
  onUpdateAppSettings(input: AppSettingsUpdateInput): Promise<void>
  onUpdateProjectSettings(input: ProjectSettingsUpdateInput): Promise<void>
  onUpdateNotebookDraft(notebook: NotebookDocument): void
  onPersistNotebook(notebook: NotebookDocument): Promise<void> | void
  onSetSelectedArchiveFolder(folderId: string | null): void
  onCreateArchiveFolder(name: string, parentId?: string | null): Promise<void> | void
  onUpdateArchiveFolder(folderId: string, input: ArchiveFolderUpdate): Promise<void> | void
  onDeleteArchiveFolder(folderId: string): Promise<void> | void
  onAddArchiveFiles(filePaths?: string[] | null, folderId?: string | null): Promise<void> | void
  onMoveArchiveItem(itemId: string, folderId: string | null): Promise<void> | void
  onOpenArchiveItem(itemId: string): Promise<void> | void
  onRevealArchiveItem(itemId: string): Promise<void> | void
  onDeleteArchiveItem(itemId: string): Promise<void> | void
  onSelectBoardForWindow(boardId: string): void
  onOpenBoardDetailsForWindow(boardId: string): void
  onUpdateBoardDraft(input: BoardUpdateInput): Promise<void> | void
  onCloneBoard(boardId: string): Promise<void> | void
  onCreateBoard(name?: string, folder?: string | null): Promise<void> | void
  onCreateBoardFolder(name: string, parentPath?: string | null): Promise<void> | void
  onUpdateBoardFolder(currentPath: string, input: BoardFolderUpdate): Promise<void> | void
  onDeleteBoardFolder(currentPath: string): Promise<void> | void
  onDeleteBoard(boardId: string): Promise<void> | void
  onMoveBoard(boardId: string, folder: string, beforeBoardId?: string | null): Promise<void> | void
  onReorderBoards(boardIds: string[]): Promise<void> | void
  onSelectScene(sceneId: string | null, boardItemId?: string | null): void
  onOpenInspector(sceneId: string | null, boardItemId?: string | null): void
  onCreateScene(): Promise<void> | void
  onToggleSceneSelection(sceneId: string): void
  onSetSceneSelection(sceneIds: string[]): void
  onClearSceneSelection(): void
  onCreateSceneFolder(name: string, parentPath?: string | null): Promise<void> | void
  onUpdateSceneFolder(currentPath: string, input: SceneFolderUpdate): Promise<void> | void
  onDeleteSceneFolder(currentPath: string): Promise<void> | void
  onMoveScenesToFolder(sceneIds: string[], folder: string): Promise<void> | void
  onToggleKeyScene(scene: Scene): void
  onDuplicateScene(sceneId: string, afterItemId?: string | null): Promise<void> | void
  onDeleteScene(sceneId: string): Promise<void> | void
  onDeleteSelectedScenes(): Promise<void> | void
  onAddSceneToCurrentBoard(
    sceneId: string,
    afterItemId?: string | null,
    boardPosition?: BoardDropPosition | null,
  ): Promise<AddSceneToBoardResult | null> | null
  onAddBlockToCurrentBoard(kind: BoardTextItemKind, afterItemId?: string | null): void
  onAddBlockTemplateToCurrentBoard(templateId: string, afterItemId?: string | null): void
  onSaveBlockTemplate(input: { kind: BoardTextItemKind; name: string; title: string; body: string }): Promise<void> | void
  onDeleteBlockTemplate(templateId: string): Promise<void> | void
  onCopyBlockToBoard(itemId: string, boardId: string): Promise<void> | void
  onDuplicateBoardItem(itemId: string): Promise<void> | void
  onRemoveBoardItem(itemId: string): Promise<void> | void
  onReorderCurrentBoard(itemIds: string[]): void
  onPersistBoardItemDraft(input: BoardItemUpdateInput): Promise<void> | void
  onInlineUpdateScene(sceneId: string, input: { title: string; synopsis: string }): void
  onInlineUpdateBlock(itemId: string, input: { title: string; body: string }): void
  onCreateSceneBeat(sceneId: string, afterBeatId?: string | null): Promise<void> | void
  onUpdateSceneBeat(input: SceneBeatUpdateInput): Promise<void> | void
  onDeleteSceneBeat(beatId: string): Promise<void> | void
  onReorderSceneBeats(sceneId: string, beatIds: string[]): Promise<void> | void
  onSendScenesToOpenOutline(sceneIds: string[]): Promise<void> | void
  onOpenTranscribeSettings(): void
}

export type DetachedWorkspacePanelProps = SharedWorkspaceProps & {
  detachedWorkspace: WindowWorkspace
  outlineImmersive: boolean
  onToggleOutlineImmersive(): Promise<void> | void
  onChangeBoardViewMode(mode: BoardViewMode): void
}

export type MainWorkspacePanelProps = SharedWorkspaceProps & {
  workspaceMode: WorkspaceMode
  busy: boolean
  consultantBusy: boolean
  consultantMessages: ConsultantMessage[]
  consultantContextMode: ConsultantContextMode
  settingsNavigate: { tab: SettingsTab; requestId: number } | null
  onSetWorkspaceMode(mode: WorkspaceMode): void
  onSetConsultantContextMode(mode: ConsultantContextMode): void
  onSendConsultantMessage(content: string): Promise<void> | void
  onClearConsultantConversation(): void
  onOpenAppSettings(): void
  onChangeBoardViewMode(mode: BoardViewMode): void
}

export type OutlineWorkspacePanelProps = Pick<
  SharedWorkspaceProps,
  | 'projectMeta'
  | 'activeBoard'
  | 'boards'
  | 'boardFolders'
  | 'scenes'
  | 'sceneFolders'
  | 'blockTemplates'
  | 'filteredSceneIds'
  | 'tags'
  | 'sceneDensity'
  | 'boardViewMode'
  | 'boardBlockKindsForProject'
  | 'selectedSceneId'
  | 'selectedSceneIds'
  | 'selectedBoardItemId'
  | 'onSelectBoardForWindow'
  | 'onOpenBoardDetailsForWindow'
  | 'onUpdateBoardDraft'
  | 'onCloneBoard'
  | 'onCreateBoard'
  | 'onCreateBoardFolder'
  | 'onUpdateBoardFolder'
  | 'onDeleteBoardFolder'
  | 'onDeleteBoard'
  | 'onMoveBoard'
  | 'onReorderBoards'
  | 'onSelectScene'
  | 'onOpenInspector'
  | 'onCreateScene'
  | 'onToggleSceneSelection'
  | 'onSetSceneSelection'
  | 'onClearSceneSelection'
  | 'onCreateSceneFolder'
  | 'onUpdateSceneFolder'
  | 'onDeleteSceneFolder'
  | 'onMoveScenesToFolder'
  | 'onToggleKeyScene'
  | 'onDuplicateScene'
  | 'onDeleteScene'
  | 'onDeleteSelectedScenes'
  | 'onAddSceneToCurrentBoard'
  | 'onAddBlockToCurrentBoard'
  | 'onAddBlockTemplateToCurrentBoard'
  | 'onSaveBlockTemplate'
  | 'onDeleteBlockTemplate'
  | 'onCopyBlockToBoard'
  | 'onDuplicateBoardItem'
  | 'onRemoveBoardItem'
  | 'onReorderCurrentBoard'
  | 'onPersistBoardItemDraft'
  | 'onInlineUpdateScene'
  | 'onInlineUpdateBlock'
  | 'onCreateSceneBeat'
  | 'onUpdateSceneBeat'
  | 'onDeleteSceneBeat'
  | 'onReorderSceneBeats'
> & {
  immersive?: boolean
  defaultBankCollapsed?: boolean
  onToggleOutlineImmersive?(): Promise<void> | void
  onChangeBoardViewMode(mode: BoardViewMode): void
}

export type SceneBankWorkspacePanelProps = Pick<
  SharedWorkspaceProps,
  | 'activeBoard'
  | 'filteredScenes'
  | 'sceneFolders'
  | 'tags'
  | 'sceneDensity'
  | 'selectedSceneId'
  | 'selectedSceneIds'
  | 'selectedBoardItemId'
  | 'onSelectScene'
  | 'onToggleSceneSelection'
  | 'onSetSceneSelection'
  | 'onClearSceneSelection'
  | 'onOpenInspector'
  | 'onInlineUpdateScene'
  | 'onToggleKeyScene'
  | 'onCreateScene'
  | 'onCreateSceneFolder'
  | 'onUpdateSceneFolder'
  | 'onDeleteSceneFolder'
  | 'onMoveScenesToFolder'
  | 'onDuplicateScene'
  | 'onDeleteScene'
  | 'onDeleteSelectedScenes'
  | 'onAddSceneToCurrentBoard'
  | 'onSendScenesToOpenOutline'
>

export type NotebookWorkspacePanelProps = Pick<
  SharedWorkspaceProps,
  'notebook' | 'onUpdateNotebookDraft' | 'onPersistNotebook'
>

export type ArchiveWorkspacePanelProps = Pick<
  SharedWorkspaceProps,
  | 'archiveFolders'
  | 'archiveItems'
  | 'selectedArchiveFolderId'
  | 'onSetSelectedArchiveFolder'
  | 'onCreateArchiveFolder'
  | 'onUpdateArchiveFolder'
  | 'onDeleteArchiveFolder'
  | 'onAddArchiveFiles'
  | 'onMoveArchiveItem'
  | 'onOpenArchiveItem'
  | 'onRevealArchiveItem'
  | 'onDeleteArchiveItem'
>

export type BoardManagerWorkspacePanelProps = Pick<
  SharedWorkspaceProps,
  | 'boards'
  | 'boardFolders'
  | 'activeBoardId'
  | 'onSelectBoardForWindow'
  | 'onOpenBoardDetailsForWindow'
  | 'onUpdateBoardDraft'
  | 'onCloneBoard'
  | 'onCreateBoard'
  | 'onCreateBoardFolder'
  | 'onUpdateBoardFolder'
  | 'onDeleteBoardFolder'
  | 'onDeleteBoard'
  | 'onMoveBoard'
  | 'onReorderBoards'
> & {
  onClose(): void
}

export type InspectorWorkspacePanelProps = Pick<SharedWorkspaceProps, 'inspectorContent'>

export type TranscribeWorkspacePanelProps = Pick<
  SharedWorkspaceProps,
  | 'projectMeta'
  | 'appSettings'
  | 'onUpdateAppSettings'
  | 'onUpdateNotebookDraft'
  | 'onOpenTranscribeSettings'
>
