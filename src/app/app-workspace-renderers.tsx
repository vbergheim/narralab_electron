import { ArchiveWorkspace } from '@/features/archive/archive-workspace'
import { OutlineWorkspace } from '@/features/boards/outline-workspace'
import { NotebookEditor } from '@/features/notebook/notebook-editor'
import { SceneBankView } from '@/features/scenes/scene-bank-view'
import { TranscribeWorkspace } from '@/features/transcribe/transcribe-workspace'
import { BoardManagerDialog } from '@/components/board-selector/board-manager-dialog'
import { Panel } from '@/components/ui/panel'
import type {
  ArchiveWorkspacePanelProps,
  BoardManagerWorkspacePanelProps,
  InspectorWorkspacePanelProps,
  NotebookWorkspacePanelProps,
  OutlineWorkspacePanelProps,
  SceneBankWorkspacePanelProps,
  TranscribeWorkspacePanelProps,
} from '@/app/app-workspace-contract'

export function OutlineWorkspacePanel({
  projectMeta,
  activeBoard,
  boards,
  boardFolders,
  scenes,
  sceneFolders,
  blockTemplates,
  filteredSceneIds,
  tags,
  sceneDensity,
  boardViewMode,
  boardBlockKindsForProject,
  selectedSceneId,
  selectedSceneIds,
  selectedBoardItemId,
  immersive = false,
  defaultBankCollapsed = false,
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
  detachedViewControl,
}: OutlineWorkspacePanelProps) {
  if (!projectMeta || !activeBoard) {
    return null
  }

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
      immersive={immersive}
      defaultBankCollapsed={defaultBankCollapsed}
      detachedViewControl={detachedViewControl}
      sceneBankWidthStorageKey={`narralab:outline-scene-bank-width:${encodeURIComponent(projectMeta.path)}`}
      onToggleImmersive={onToggleOutlineImmersive ? () => void onToggleOutlineImmersive() : undefined}
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
      onAddScene={(sceneId, afterItemId, boardPosition) =>
        onAddSceneToCurrentBoard(sceneId, afterItemId, boardPosition)
      }
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

export function SceneBankWorkspacePanel({
  activeBoard,
  filteredScenes,
  sceneFolders,
  tags,
  sceneDensity,
  selectedSceneId,
  selectedSceneIds,
  selectedBoardItemId,
  onSelectScene,
  onToggleSceneSelection,
  onSetSceneSelection,
  onClearSceneSelection,
  onOpenInspector,
  onInlineUpdateScene,
  onToggleKeyScene,
  onCreateScene,
  onCreateSceneFolder,
  onUpdateSceneFolder,
  onDeleteSceneFolder,
  onMoveScenesToFolder,
  onDuplicateScene,
  onDeleteScene,
  onDeleteSelectedScenes,
  onAddSceneToCurrentBoard,
  onSendScenesToOpenOutline,
  detachedViewControl,
}: SceneBankWorkspacePanelProps) {
  if (!activeBoard) {
    return null
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
      headerAction={detachedViewControl}
    />
  )
}

export function NotebookWorkspacePanel({
  notebook,
  onUpdateNotebookDraft,
  onPersistNotebook,
}: NotebookWorkspacePanelProps) {
  return <NotebookEditor notebook={notebook} onChange={onUpdateNotebookDraft} onSave={(content) => void onPersistNotebook(content)} />
}

export function ArchiveWorkspacePanel({
  archiveFolders,
  archiveItems,
  selectedArchiveFolderId,
  onSetSelectedArchiveFolder,
  onCreateArchiveFolder,
  onUpdateArchiveFolder,
  onDeleteArchiveFolder,
  onAddArchiveFiles,
  onMoveArchiveItem,
  onOpenArchiveItem,
  onRevealArchiveItem,
  onDeleteArchiveItem,
}: ArchiveWorkspacePanelProps) {
  return (
    <ArchiveWorkspace
      folders={archiveFolders}
      items={archiveItems}
      selectedFolderId={selectedArchiveFolderId}
      onSelectFolder={onSetSelectedArchiveFolder}
      onCreateFolder={(name, parentId, color) => void onCreateArchiveFolder(name, parentId, color)}
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

export function BoardManagerWorkspacePanel({
  boards,
  boardFolders,
  activeBoardId,
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
  onClose,
}: BoardManagerWorkspacePanelProps) {
  return (
    <BoardManagerDialog
      boards={boards}
      folders={boardFolders}
      activeBoardId={activeBoardId}
      open={true}
      embedded={true}
      onClose={onClose}
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

export function InspectorWorkspacePanel({ inspectorContent }: InspectorWorkspacePanelProps) {
  return <Panel className="h-full overflow-y-auto overscroll-contain">{inspectorContent}</Panel>
}

export function TranscribeWorkspacePanel({
  projectMeta,
  appSettings,
  onUpdateAppSettings,
  onUpdateNotebookDraft,
  onOpenTranscribeSettings,
}: TranscribeWorkspacePanelProps) {
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
