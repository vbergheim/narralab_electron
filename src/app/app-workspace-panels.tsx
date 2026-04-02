import type { ReactNode } from 'react'
import { Film } from 'lucide-react'

import { ArchiveWorkspace } from '@/features/archive/archive-workspace'
import { OutlineWorkspace } from '@/features/boards/outline-workspace'
import { ConsultantWorkspace } from '@/features/consultant/consultant-workspace'
import { NotebookEditor } from '@/features/notebook/notebook-editor'
import { SceneBankView } from '@/features/scenes/scene-bank-view'
import { SettingsWorkspace, type SettingsTab } from '@/features/settings/settings-workspace'
import { TranscribeWorkspace } from '@/features/transcribe/transcribe-workspace'
import { BoardManagerDialog } from '@/components/board-selector/board-manager-dialog'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
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

type WorkspaceMode =
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

type SharedWorkspaceProps = {
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

type DetachedWorkspacePanelProps = SharedWorkspaceProps & {
  detachedWorkspace: WindowWorkspace
  outlineImmersive: boolean
  onToggleOutlineImmersive(): Promise<void> | void
  onChangeBoardViewMode(mode: BoardViewMode): void
}

type MainWorkspacePanelProps = SharedWorkspaceProps & {
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

export function DetachedWorkspacePanel({
  projectMeta,
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
  boardViewMode,
  boardBlockKindsForProject,
  inspectorContent,
  detachedWorkspace,
  outlineImmersive,
  onCreateProject,
  onOpenProject,
  onUpdateAppSettings,
  onUpdateNotebookDraft,
  onPersistNotebook,
  onSetSelectedArchiveFolder,
  onCreateArchiveFolder,
  onUpdateArchiveFolder,
  onDeleteArchiveFolder,
  onAddArchiveFiles,
  onMoveArchiveItem,
  onOpenArchiveItem,
  onRevealArchiveItem,
  onDeleteArchiveItem,
  onToggleOutlineImmersive,
  onChangeBoardViewMode,
  onSelectBoardForWindow,
  onOpenBoardDetailsForWindow,
  onUpdateBoardDraft,
  onCloneBoard,
  onCreateBoard,
  onCreateBoardFolder,
  onUpdateBoardFolder,
  onDeleteBoardFolder,
  onDeleteBoard,
  onMoveBoard,
  onReorderBoards,
  onSelectScene,
  onOpenInspector,
  onCreateScene,
  onToggleSceneSelection,
  onSetSceneSelection,
  onClearSceneSelection,
  onCreateSceneFolder,
  onUpdateSceneFolder,
  onDeleteSceneFolder,
  onMoveScenesToFolder,
  onToggleKeyScene,
  onDuplicateScene,
  onDeleteScene,
  onDeleteSelectedScenes,
  onAddSceneToCurrentBoard,
  onAddBlockToCurrentBoard,
  onAddBlockTemplateToCurrentBoard,
  onSaveBlockTemplate,
  onDeleteBlockTemplate,
  onCopyBlockToBoard,
  onDuplicateBoardItem,
  onRemoveBoardItem,
  onReorderCurrentBoard,
  onPersistBoardItemDraft,
  onInlineUpdateScene,
  onInlineUpdateBlock,
  onCreateSceneBeat,
  onUpdateSceneBeat,
  onDeleteSceneBeat,
  onReorderSceneBeats,
  onSendScenesToOpenOutline,
  onOpenTranscribeSettings,
}: DetachedWorkspacePanelProps) {
  if (!projectMeta) {
    return <WelcomePanel onCreate={onCreateProject} onOpen={onOpenProject} />
  }

  if (detachedWorkspace === 'outline' && activeBoard) {
    return (
      <OutlineWorkspace
        board={activeBoard}
        allBoards={boards}
        boardFolders={boardFolders}
        scenes={scenes}
        sceneFolders={sceneFolders}
        blockTemplates={blockTemplates}
        filteredSceneIds={filteredSceneIds}
        tags={tags}
        density={sceneDensity}
        viewMode={boardViewMode}
        availableBlockKinds={boardBlockKindsForProject}
        immersive={outlineImmersive}
        defaultBankCollapsed
        sceneBankWidthStorageKey={`narralab:outline-scene-bank-width:${encodeURIComponent(projectMeta.path)}`}
        onToggleImmersive={() => void onToggleOutlineImmersive()}
        onChangeViewMode={onChangeBoardViewMode}
        onSelectBoard={onSelectBoardForWindow}
        onOpenBoardInspector={onOpenBoardDetailsForWindow}
        onInlineUpdateBoard={(boardId, input) => void onUpdateBoardDraft({ id: boardId, ...input })}
        onDuplicateBoard={(boardId) => void onCloneBoard(boardId)}
        onCreateBoard={(folder) => void onCreateBoard('New Board', folder)}
        onCreateBoardFolder={(name, parentPath) => void onCreateBoardFolder(name, parentPath)}
        onUpdateBoardFolder={(currentPath, input) => void onUpdateBoardFolder(currentPath, input)}
        onDeleteBoardFolder={(currentPath) => void onDeleteBoardFolder(currentPath)}
        onDeleteBoard={(boardId) => void onDeleteBoard(boardId)}
        onMoveBoard={(boardId, folder, beforeBoardId) => void onMoveBoard(boardId, folder, beforeBoardId)}
        onReorderBoards={(boardIds) => void onReorderBoards(boardIds)}
        selectedSceneId={selectedSceneId}
        selectedSceneIds={selectedSceneIds}
        selectedBoardItemId={selectedBoardItemId}
        onSelect={(sceneId, boardItemId) => onSelectScene(sceneId, boardItemId)}
        onOpenInspector={onOpenInspector}
        onCreateScene={() => void onCreateScene()}
        onToggleSceneSelection={onToggleSceneSelection}
        onSetSceneSelection={onSetSceneSelection}
        onClearSceneSelection={onClearSceneSelection}
        onCreateSceneFolder={(name, parentPath) => void onCreateSceneFolder(name, parentPath)}
        onUpdateSceneFolder={(currentPath, input) => void onUpdateSceneFolder(currentPath, input)}
        onDeleteSceneFolder={(currentPath) => void onDeleteSceneFolder(currentPath)}
        onMoveScenesToFolder={(sceneIds, folder) => void onMoveScenesToFolder(sceneIds, folder)}
        onToggleKeyScene={onToggleKeyScene}
        onDuplicateScene={(sceneId, afterItemId) => void onDuplicateScene(sceneId, afterItemId ?? null)}
        onDeleteScene={(sceneId) => void onDeleteScene(sceneId)}
        onDeleteSelectedScenes={() => void onDeleteSelectedScenes()}
        onAddScene={(sceneId, afterItemId, boardPosition) => void onAddSceneToCurrentBoard(sceneId, afterItemId, boardPosition)}
        onAddBlock={(kind, afterItemId) => onAddBlockToCurrentBoard(kind, afterItemId)}
        onAddTemplate={(templateId, afterItemId) => onAddBlockTemplateToCurrentBoard(templateId, afterItemId)}
        onSaveTemplate={(input) => void onSaveBlockTemplate(input)}
        onDeleteTemplate={(templateId) => void onDeleteBlockTemplate(templateId)}
        onCopyBlockToBoard={(itemId, boardId) => void onCopyBlockToBoard(itemId, boardId)}
        onDuplicateBlock={(itemId) => void onDuplicateBoardItem(itemId)}
        onRemoveBoardItem={(itemId) => void onRemoveBoardItem(itemId)}
        onReorder={(itemIds) => onReorderCurrentBoard(itemIds)}
        onUpdateItemPosition={(itemId, boardX, boardY) => void onPersistBoardItemDraft({ id: itemId, boardX, boardY })}
        onInlineUpdateScene={onInlineUpdateScene}
        onInlineUpdateBlock={onInlineUpdateBlock}
        onCreateBeat={(sceneId, afterBeatId) => void onCreateSceneBeat(sceneId, afterBeatId)}
        onUpdateBeat={(input) => void onUpdateSceneBeat(input)}
        onDeleteBeat={(beatId) => void onDeleteSceneBeat(beatId)}
        onReorderBeats={(sceneId, beatIds) => void onReorderSceneBeats(sceneId, beatIds)}
      />
    )
  }

  if (detachedWorkspace === 'bank' && activeBoard) {
    return (
      <SceneBankView
        scenes={filteredScenes}
        folders={sceneFolders}
        tags={tags}
        board={activeBoard}
        density={sceneDensity}
        selectedSceneId={selectedSceneId}
        selectedSceneIds={selectedSceneIds}
        onSelect={(sceneId) => onSelectScene(sceneId)}
        onToggleSelection={onToggleSceneSelection}
        onSelectAllVisible={onSetSceneSelection}
        onClearSelection={onClearSceneSelection}
        onOpenInspector={onOpenInspector}
        onInlineUpdateScene={onInlineUpdateScene}
        onToggleKeyScene={onToggleKeyScene}
        onCreateScene={() => void onCreateScene()}
        onCreateFolder={(name, parentPath) => void onCreateSceneFolder(name, parentPath)}
        onUpdateFolder={(currentPath, input) => void onUpdateSceneFolder(currentPath, input)}
        onDeleteFolder={(currentPath) => void onDeleteSceneFolder(currentPath)}
        onMoveToFolder={(sceneIds, folder) => void onMoveScenesToFolder(sceneIds, folder)}
        onDuplicate={(sceneId) => void onDuplicateScene(sceneId)}
        onDelete={(sceneId) => void onDeleteScene(sceneId)}
        onDeleteSelected={() => void onDeleteSelectedScenes()}
        onAdd={(sceneId) => void onAddSceneToCurrentBoard(sceneId, selectedBoardItemId)}
        onSendToOpenOutline={(sceneIds) => void onSendScenesToOpenOutline(sceneIds)}
      />
    )
  }

  if (detachedWorkspace === 'notebook') {
    return <NotebookEditor notebook={notebook} onChange={onUpdateNotebookDraft} onSave={(content) => void onPersistNotebook(content)} />
  }

  if (detachedWorkspace === 'archive') {
    return (
      <ArchiveWorkspace
        folders={archiveFolders}
        items={archiveItems}
        selectedFolderId={selectedArchiveFolderId}
        onSelectFolder={onSetSelectedArchiveFolder}
        onCreateFolder={(name, parentId) => void onCreateArchiveFolder(name, parentId)}
        onUpdateFolder={(folderId, input) => void onUpdateArchiveFolder(folderId, input)}
        onDeleteFolder={(folderId) => void onDeleteArchiveFolder(folderId)}
        onAddFiles={(filePaths, folderId) => void onAddArchiveFiles(filePaths, folderId)}
        onMoveItem={(itemId, folderId) => void onMoveArchiveItem(itemId, folderId)}
        onOpenItem={(itemId) => void onOpenArchiveItem(itemId)}
        onRevealItem={(itemId) => void onRevealArchiveItem(itemId)}
        onDeleteItem={(itemId) => void onDeleteArchiveItem(itemId)}
      />
    )
  }

  if (detachedWorkspace === 'inspector') {
    return <Panel className="h-full overflow-y-auto overscroll-contain">{inspectorContent}</Panel>
  }

  if (detachedWorkspace === 'board-manager') {
    return (
      <BoardManagerDialog
        boards={boards}
        folders={boardFolders}
        activeBoardId={activeBoardId}
        open={true}
        embedded={true}
        onClose={() => void window.close()}
        onSelectBoard={onSelectBoardForWindow}
        onOpenBoardInspector={onOpenBoardDetailsForWindow}
        onInlineUpdateBoard={(boardId, input) => void onUpdateBoardDraft({ id: boardId, ...input })}
        onDuplicateBoard={(boardId) => void onCloneBoard(boardId)}
        onCreateBoard={(folder) => void onCreateBoard('New Board', folder)}
        onCreateFolder={(name, parentPath) => void onCreateBoardFolder(name, parentPath)}
        onUpdateFolder={(currentPath, input) => void onUpdateBoardFolder(currentPath, input)}
        onDeleteFolder={(currentPath) => void onDeleteBoardFolder(currentPath)}
        onDeleteBoard={(boardId) => void onDeleteBoard(boardId)}
        onMoveBoard={(boardId, folder, beforeBoardId) => void onMoveBoard(boardId, folder, beforeBoardId)}
        onReorderBoards={(boardIds) => void onReorderBoards(boardIds)}
      />
    )
  }

  if (detachedWorkspace === 'transcribe') {
    return (
      <TranscribeWorkspace
        projectMeta={projectMeta}
        settings={appSettings}
        onSaveAppSettings={onUpdateAppSettings}
        onNotebookSynced={onUpdateNotebookDraft}
        onOpenTranscribeSettings={onOpenTranscribeSettings}
      />
    )
  }

  return null
}

export function MainWorkspacePanel({
  workspaceMode,
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
  consultantBusy,
  consultantMessages,
  consultantContextMode,
  filteredScenes,
  filteredSceneIds,
  sceneDensity,
  boardViewMode,
  boardBlockKindsForProject,
  busy,
  settingsNavigate,
  onUpdateAppSettings,
  onUpdateProjectSettings,
  onUpdateNotebookDraft,
  onPersistNotebook,
  onSetSelectedArchiveFolder,
  onCreateArchiveFolder,
  onUpdateArchiveFolder,
  onDeleteArchiveFolder,
  onAddArchiveFiles,
  onMoveArchiveItem,
  onOpenArchiveItem,
  onRevealArchiveItem,
  onDeleteArchiveItem,
  onSelectBoardForWindow,
  onOpenBoardDetailsForWindow,
  onUpdateBoardDraft,
  onCloneBoard,
  onCreateBoard,
  onCreateBoardFolder,
  onUpdateBoardFolder,
  onDeleteBoardFolder,
  onDeleteBoard,
  onMoveBoard,
  onReorderBoards,
  onSelectScene,
  onOpenInspector,
  onCreateScene,
  onToggleSceneSelection,
  onSetSceneSelection,
  onClearSceneSelection,
  onCreateSceneFolder,
  onUpdateSceneFolder,
  onDeleteSceneFolder,
  onMoveScenesToFolder,
  onToggleKeyScene,
  onDuplicateScene,
  onDeleteScene,
  onDeleteSelectedScenes,
  onAddSceneToCurrentBoard,
  onAddBlockToCurrentBoard,
  onAddBlockTemplateToCurrentBoard,
  onSaveBlockTemplate,
  onDeleteBlockTemplate,
  onCopyBlockToBoard,
  onDuplicateBoardItem,
  onRemoveBoardItem,
  onReorderCurrentBoard,
  onPersistBoardItemDraft,
  onInlineUpdateScene,
  onInlineUpdateBlock,
  onCreateSceneBeat,
  onUpdateSceneBeat,
  onDeleteSceneBeat,
  onReorderSceneBeats,
  onSendScenesToOpenOutline,
  onOpenTranscribeSettings,
  onSetWorkspaceMode,
  onSetConsultantContextMode,
  onSendConsultantMessage,
  onClearConsultantConversation,
  onOpenAppSettings,
  onChangeBoardViewMode,
  onCreateProject,
  onOpenProject,
}: MainWorkspacePanelProps) {
  if (workspaceMode === 'settings') {
    return (
      <SettingsWorkspace
        settings={appSettings}
        projectSettings={projectSettings}
        busy={busy}
        onSaveApp={(input) => void onUpdateAppSettings(input)}
        onSaveProject={(input) => void onUpdateProjectSettings(input)}
        navigateToTab={settingsNavigate ?? undefined}
      />
    )
  }

  if (workspaceMode === 'consultant') {
    return (
      <ConsultantWorkspace
        settings={appSettings}
        messages={consultantMessages}
        busy={consultantBusy}
        activeBoardName={activeBoard?.name ?? null}
        contextMode={consultantContextMode}
        onChangeContextMode={onSetConsultantContextMode}
        onSend={(content) => void onSendConsultantMessage(content)}
        onClear={onClearConsultantConversation}
        onOpenSettings={onOpenAppSettings}
      />
    )
  }

  if (workspaceMode === 'transcribe') {
    return (
      <TranscribeWorkspace
        projectMeta={projectMeta}
        settings={appSettings}
        onSaveAppSettings={onUpdateAppSettings}
        onNotebookSynced={onUpdateNotebookDraft}
        onOpenTranscribeSettings={onOpenTranscribeSettings}
      />
    )
  }

  if (workspaceMode === 'archive' && projectMeta) {
    return (
      <ArchiveWorkspace
        folders={archiveFolders}
        items={archiveItems}
        selectedFolderId={selectedArchiveFolderId}
        onSelectFolder={onSetSelectedArchiveFolder}
        onCreateFolder={(name, parentId) => void onCreateArchiveFolder(name, parentId)}
        onUpdateFolder={(folderId, input) => void onUpdateArchiveFolder(folderId, input)}
        onDeleteFolder={(folderId) => void onDeleteArchiveFolder(folderId)}
        onAddFiles={(filePaths, folderId) => void onAddArchiveFiles(filePaths, folderId)}
        onMoveItem={(itemId, folderId) => void onMoveArchiveItem(itemId, folderId)}
        onOpenItem={(itemId) => void onOpenArchiveItem(itemId)}
        onRevealItem={(itemId) => void onRevealArchiveItem(itemId)}
        onDeleteItem={(itemId) => void onDeleteArchiveItem(itemId)}
      />
    )
  }

  if (workspaceMode === 'board-manager' && projectMeta) {
    return (
      <BoardManagerDialog
        boards={boards}
        folders={boardFolders}
        activeBoardId={activeBoardId}
        open={true}
        embedded={true}
        onClose={() => onSetWorkspaceMode('outline')}
        onSelectBoard={onSelectBoardForWindow}
        onOpenBoardInspector={onOpenBoardDetailsForWindow}
        onInlineUpdateBoard={(boardId, input) => void onUpdateBoardDraft({ id: boardId, ...input })}
        onDuplicateBoard={(boardId) => void onCloneBoard(boardId)}
        onCreateBoard={(folder) => void onCreateBoard('New Board', folder)}
        onCreateFolder={(name, parentPath) => void onCreateBoardFolder(name, parentPath)}
        onUpdateFolder={(currentPath, input) => void onUpdateBoardFolder(currentPath, input)}
        onDeleteFolder={(currentPath) => void onDeleteBoardFolder(currentPath)}
        onDeleteBoard={(boardId) => void onDeleteBoard(boardId)}
        onMoveBoard={(boardId, folder, beforeBoardId) => void onMoveBoard(boardId, folder, beforeBoardId)}
        onReorderBoards={(boardIds) => void onReorderBoards(boardIds)}
      />
    )
  }

  if (projectMeta && activeBoard) {
    if (workspaceMode === 'outline') {
      return (
        <OutlineWorkspace
          board={activeBoard}
          allBoards={boards}
          boardFolders={boardFolders}
          scenes={scenes}
          sceneFolders={sceneFolders}
          blockTemplates={blockTemplates}
          filteredSceneIds={filteredSceneIds}
          tags={tags}
          density={sceneDensity}
          viewMode={boardViewMode}
          availableBlockKinds={boardBlockKindsForProject}
          sceneBankWidthStorageKey={`narralab:outline-scene-bank-width:${encodeURIComponent(projectMeta.path)}`}
          onChangeViewMode={onChangeBoardViewMode}
          onSelectBoard={onSelectBoardForWindow}
          onOpenBoardInspector={onOpenBoardDetailsForWindow}
          onInlineUpdateBoard={(boardId, input) => void onUpdateBoardDraft({ id: boardId, ...input })}
          onDuplicateBoard={(boardId) => void onCloneBoard(boardId)}
          onCreateBoard={(folder) => void onCreateBoard('New Board', folder)}
          onCreateBoardFolder={(name, parentPath) => void onCreateBoardFolder(name, parentPath)}
          onUpdateBoardFolder={(currentPath, input) => void onUpdateBoardFolder(currentPath, input)}
          onDeleteBoardFolder={(currentPath) => void onDeleteBoardFolder(currentPath)}
          onDeleteBoard={(boardId) => void onDeleteBoard(boardId)}
          onMoveBoard={(boardId, folder, beforeBoardId) => void onMoveBoard(boardId, folder, beforeBoardId)}
          onReorderBoards={(boardIds) => void onReorderBoards(boardIds)}
          selectedSceneId={selectedSceneId}
          selectedSceneIds={selectedSceneIds}
          selectedBoardItemId={selectedBoardItemId}
          onSelect={(sceneId, boardItemId) => onSelectScene(sceneId, boardItemId)}
          onOpenInspector={onOpenInspector}
          onCreateScene={() => void onCreateScene()}
          onToggleSceneSelection={onToggleSceneSelection}
          onSetSceneSelection={onSetSceneSelection}
          onClearSceneSelection={onClearSceneSelection}
          onCreateSceneFolder={(name, parentPath) => void onCreateSceneFolder(name, parentPath)}
          onUpdateSceneFolder={(currentPath, input) => void onUpdateSceneFolder(currentPath, input)}
          onDeleteSceneFolder={(currentPath) => void onDeleteSceneFolder(currentPath)}
          onMoveScenesToFolder={(sceneIds, folder) => void onMoveScenesToFolder(sceneIds, folder)}
          onToggleKeyScene={onToggleKeyScene}
          onDuplicateScene={(sceneId, afterItemId) => void onDuplicateScene(sceneId, afterItemId ?? null)}
          onDeleteScene={(sceneId) => void onDeleteScene(sceneId)}
          onDeleteSelectedScenes={() => void onDeleteSelectedScenes()}
          onAddScene={(sceneId, afterItemId, boardPosition) => void onAddSceneToCurrentBoard(sceneId, afterItemId, boardPosition)}
          onAddBlock={(kind, afterItemId) => onAddBlockToCurrentBoard(kind, afterItemId)}
          onAddTemplate={(templateId, afterItemId) => onAddBlockTemplateToCurrentBoard(templateId, afterItemId)}
          onSaveTemplate={(input) => void onSaveBlockTemplate(input)}
          onDeleteTemplate={(templateId) => void onDeleteBlockTemplate(templateId)}
          onCopyBlockToBoard={(itemId, boardId) => void onCopyBlockToBoard(itemId, boardId)}
          onDuplicateBlock={(itemId) => void onDuplicateBoardItem(itemId)}
          onRemoveBoardItem={(itemId) => void onRemoveBoardItem(itemId)}
          onReorder={(itemIds) => onReorderCurrentBoard(itemIds)}
          onUpdateItemPosition={(itemId, boardX, boardY) => void onPersistBoardItemDraft({ id: itemId, boardX, boardY })}
          onInlineUpdateScene={onInlineUpdateScene}
          onInlineUpdateBlock={onInlineUpdateBlock}
          onCreateBeat={(sceneId, afterBeatId) => void onCreateSceneBeat(sceneId, afterBeatId)}
          onUpdateBeat={(input) => void onUpdateSceneBeat(input)}
          onDeleteBeat={(beatId) => void onDeleteSceneBeat(beatId)}
          onReorderBeats={(sceneId, beatIds) => void onReorderSceneBeats(sceneId, beatIds)}
        />
      )
    }

    if (workspaceMode === 'notebook') {
      return <NotebookEditor notebook={notebook} onChange={onUpdateNotebookDraft} onSave={(content) => void onPersistNotebook(content)} />
    }

    return (
      <SceneBankView
        scenes={filteredScenes}
        folders={sceneFolders}
        tags={tags}
        board={activeBoard}
        density={sceneDensity}
        selectedSceneId={selectedSceneId}
        selectedSceneIds={selectedSceneIds}
        onSelect={(sceneId) => onSelectScene(sceneId)}
        onToggleSelection={onToggleSceneSelection}
        onSelectAllVisible={onSetSceneSelection}
        onClearSelection={onClearSceneSelection}
        onOpenInspector={onOpenInspector}
        onInlineUpdateScene={onInlineUpdateScene}
        onToggleKeyScene={onToggleKeyScene}
        onCreateScene={() => void onCreateScene()}
        onCreateFolder={(name, parentPath) => void onCreateSceneFolder(name, parentPath)}
        onUpdateFolder={(currentPath, input) => void onUpdateSceneFolder(currentPath, input)}
        onDeleteFolder={(currentPath) => void onDeleteSceneFolder(currentPath)}
        onMoveToFolder={(sceneIds, folder) => void onMoveScenesToFolder(sceneIds, folder)}
        onDuplicate={(sceneId) => void onDuplicateScene(sceneId)}
        onDelete={(sceneId) => void onDeleteScene(sceneId)}
        onDeleteSelected={() => void onDeleteSelectedScenes()}
        onAdd={(sceneId) => void onAddSceneToCurrentBoard(sceneId, selectedBoardItemId)}
        onSendToOpenOutline={(sceneIds) => void onSendScenesToOpenOutline(sceneIds)}
      />
    )
  }

  return <WelcomePanel onCreate={onCreateProject} onOpen={onOpenProject} />
}

export function WelcomePanel({ onCreate, onOpen }: { onCreate(): void; onOpen(): void }) {
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
