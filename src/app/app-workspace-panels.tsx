import { Film } from 'lucide-react'

import { ConsultantWorkspace } from '@/features/consultant/consultant-workspace'
import { SettingsWorkspace } from '@/features/settings/settings-workspace'
import type { DetachedWorkspacePanelProps, MainWorkspacePanelProps } from '@/app/app-workspace-contract'
import {
  ArchiveWorkspacePanel,
  BoardManagerWorkspacePanel,
  InspectorWorkspacePanel,
  NotebookWorkspacePanel,
  OutlineWorkspacePanel,
  ProPlayerWorkspacePanel,
  SceneBankWorkspacePanel,
  TranscribeWorkspacePanel,
} from '@/app/app-workspace-renderers'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'

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
  mediaPathForWindow,
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
  detachedViewControl,
}: DetachedWorkspacePanelProps) {
  if (detachedWorkspace === 'pro-player') {
    return <ProPlayerWorkspacePanel mediaPath={mediaPathForWindow} />
  }

  if (!projectMeta) {
    return <WelcomePanel onCreate={onCreateProject} onOpen={onOpenProject} />
  }

  if (detachedWorkspace === 'outline' && activeBoard) {
    return (
      <OutlineWorkspacePanel
        projectMeta={projectMeta}
        activeBoard={activeBoard}
        boards={boards}
        boardFolders={boardFolders}
        scenes={scenes}
        sceneFolders={sceneFolders}
        blockTemplates={blockTemplates}
        filteredSceneIds={filteredSceneIds}
        tags={tags}
        sceneDensity={sceneDensity}
        boardViewMode={boardViewMode}
        boardBlockKindsForProject={boardBlockKindsForProject}
        selectedSceneId={selectedSceneId}
        selectedSceneIds={selectedSceneIds}
        selectedBoardItemId={selectedBoardItemId}
        immersive={outlineImmersive}
        defaultBankCollapsed
        detachedViewControl={detachedViewControl}
        onToggleOutlineImmersive={onToggleOutlineImmersive}
        onChangeBoardViewMode={onChangeBoardViewMode}
        onSelectBoardForWindow={onSelectBoardForWindow}
        onOpenBoardDetailsForWindow={onOpenBoardDetailsForWindow}
        onUpdateBoardDraft={onUpdateBoardDraft}
        onCloneBoard={onCloneBoard}
        onCreateBoard={onCreateBoard}
        onCreateBoardFolder={onCreateBoardFolder}
        onUpdateBoardFolder={onUpdateBoardFolder}
        onDeleteBoardFolder={onDeleteBoardFolder}
        onDeleteBoard={onDeleteBoard}
        onMoveBoard={onMoveBoard}
        onReorderBoards={onReorderBoards}
        onSelectScene={onSelectScene}
        onOpenInspector={onOpenInspector}
        onCreateScene={onCreateScene}
        onToggleSceneSelection={onToggleSceneSelection}
        onSetSceneSelection={onSetSceneSelection}
        onClearSceneSelection={onClearSceneSelection}
        onCreateSceneFolder={onCreateSceneFolder}
        onUpdateSceneFolder={onUpdateSceneFolder}
        onDeleteSceneFolder={onDeleteSceneFolder}
        onMoveScenesToFolder={onMoveScenesToFolder}
        onToggleKeyScene={onToggleKeyScene}
        onDuplicateScene={onDuplicateScene}
        onDeleteScene={onDeleteScene}
        onDeleteSelectedScenes={onDeleteSelectedScenes}
        onAddSceneToCurrentBoard={onAddSceneToCurrentBoard}
        onAddBlockToCurrentBoard={onAddBlockToCurrentBoard}
        onAddBlockTemplateToCurrentBoard={onAddBlockTemplateToCurrentBoard}
        onSaveBlockTemplate={onSaveBlockTemplate}
        onDeleteBlockTemplate={onDeleteBlockTemplate}
        onCopyBlockToBoard={onCopyBlockToBoard}
        onDuplicateBoardItem={onDuplicateBoardItem}
        onRemoveBoardItem={onRemoveBoardItem}
        onReorderCurrentBoard={onReorderCurrentBoard}
        onPersistBoardItemDraft={onPersistBoardItemDraft}
        onInlineUpdateScene={onInlineUpdateScene}
        onInlineUpdateBlock={onInlineUpdateBlock}
        onCreateSceneBeat={onCreateSceneBeat}
        onUpdateSceneBeat={onUpdateSceneBeat}
        onDeleteSceneBeat={onDeleteSceneBeat}
        onReorderSceneBeats={onReorderSceneBeats}
      />
    )
  }

  if (detachedWorkspace === 'bank' && activeBoard) {
    return (
      <SceneBankWorkspacePanel
        activeBoard={activeBoard}
        filteredScenes={filteredScenes}
        sceneFolders={sceneFolders}
        tags={tags}
        sceneDensity={sceneDensity}
        selectedSceneId={selectedSceneId}
        selectedSceneIds={selectedSceneIds}
        selectedBoardItemId={selectedBoardItemId}
        onSelectScene={onSelectScene}
        onToggleSceneSelection={onToggleSceneSelection}
        onSetSceneSelection={onSetSceneSelection}
        onClearSceneSelection={onClearSceneSelection}
        onOpenInspector={onOpenInspector}
        onInlineUpdateScene={onInlineUpdateScene}
        onToggleKeyScene={onToggleKeyScene}
        onCreateScene={onCreateScene}
        onCreateSceneFolder={onCreateSceneFolder}
        onUpdateSceneFolder={onUpdateSceneFolder}
        onDeleteSceneFolder={onDeleteSceneFolder}
        onMoveScenesToFolder={onMoveScenesToFolder}
        onDuplicateScene={onDuplicateScene}
        onDeleteScene={onDeleteScene}
        onDeleteSelectedScenes={onDeleteSelectedScenes}
        onAddSceneToCurrentBoard={onAddSceneToCurrentBoard}
        onSendScenesToOpenOutline={onSendScenesToOpenOutline}
        detachedViewControl={detachedViewControl}
      />
    )
  }

  if (detachedWorkspace === 'notebook') {
    return <NotebookWorkspacePanel notebook={notebook} onUpdateNotebookDraft={onUpdateNotebookDraft} onPersistNotebook={onPersistNotebook} />
  }

  if (detachedWorkspace === 'archive') {
    return (
      <ArchiveWorkspacePanel
        archiveFolders={archiveFolders}
        archiveItems={archiveItems}
        selectedArchiveFolderId={selectedArchiveFolderId}
        onSetSelectedArchiveFolder={onSetSelectedArchiveFolder}
        onCreateArchiveFolder={onCreateArchiveFolder}
        onUpdateArchiveFolder={onUpdateArchiveFolder}
        onDeleteArchiveFolder={onDeleteArchiveFolder}
        onAddArchiveFiles={onAddArchiveFiles}
        onMoveArchiveItem={onMoveArchiveItem}
        onOpenArchiveItem={onOpenArchiveItem}
        onRevealArchiveItem={onRevealArchiveItem}
        onDeleteArchiveItem={onDeleteArchiveItem}
      />
    )
  }

  if (detachedWorkspace === 'inspector') {
    return <InspectorWorkspacePanel inspectorContent={inspectorContent} />
  }

  if (detachedWorkspace === 'board-manager') {
    return (
      <BoardManagerWorkspacePanel
        boards={boards}
        boardFolders={boardFolders}
        activeBoardId={activeBoardId}
        onSelectBoardForWindow={onSelectBoardForWindow}
        onOpenBoardDetailsForWindow={onOpenBoardDetailsForWindow}
        onUpdateBoardDraft={onUpdateBoardDraft}
        onCloneBoard={onCloneBoard}
        onCreateBoard={onCreateBoard}
        onCreateBoardFolder={onCreateBoardFolder}
        onUpdateBoardFolder={onUpdateBoardFolder}
        onDeleteBoardFolder={onDeleteBoardFolder}
        onDeleteBoard={onDeleteBoard}
        onMoveBoard={onMoveBoard}
        onReorderBoards={onReorderBoards}
        onClose={() => void window.close()}
      />
    )
  }

  if (detachedWorkspace === 'transcribe') {
    return (
      <TranscribeWorkspacePanel
        projectMeta={projectMeta}
        appSettings={appSettings}
        onUpdateAppSettings={onUpdateAppSettings}
        onUpdateNotebookDraft={onUpdateNotebookDraft}
        onOpenTranscribeSettings={onOpenTranscribeSettings}
        detachedTranscriptOnly
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
  consultantContextSummary,
  consultantProactiveHint,
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
        contextSummary={consultantContextSummary}
        proactiveHint={consultantProactiveHint}
        onSend={(content) => void onSendConsultantMessage(content)}
        onClear={onClearConsultantConversation}
        onOpenSettings={onOpenAppSettings}
      />
    )
  }

  if (workspaceMode === 'transcribe') {
    return (
      <TranscribeWorkspacePanel
        projectMeta={projectMeta}
        appSettings={appSettings}
        onUpdateAppSettings={onUpdateAppSettings}
        onUpdateNotebookDraft={onUpdateNotebookDraft}
        onOpenTranscribeSettings={onOpenTranscribeSettings}
      />
    )
  }

  if (workspaceMode === 'archive' && projectMeta) {
    return (
      <ArchiveWorkspacePanel
        archiveFolders={archiveFolders}
        archiveItems={archiveItems}
        selectedArchiveFolderId={selectedArchiveFolderId}
        onSetSelectedArchiveFolder={onSetSelectedArchiveFolder}
        onCreateArchiveFolder={onCreateArchiveFolder}
        onUpdateArchiveFolder={onUpdateArchiveFolder}
        onDeleteArchiveFolder={onDeleteArchiveFolder}
        onAddArchiveFiles={onAddArchiveFiles}
        onMoveArchiveItem={onMoveArchiveItem}
        onOpenArchiveItem={onOpenArchiveItem}
        onRevealArchiveItem={onRevealArchiveItem}
        onDeleteArchiveItem={onDeleteArchiveItem}
      />
    )
  }

  if (workspaceMode === 'board-manager' && projectMeta) {
    return (
      <BoardManagerWorkspacePanel
        boards={boards}
        boardFolders={boardFolders}
        activeBoardId={activeBoardId}
        onSelectBoardForWindow={onSelectBoardForWindow}
        onOpenBoardDetailsForWindow={onOpenBoardDetailsForWindow}
        onUpdateBoardDraft={onUpdateBoardDraft}
        onCloneBoard={onCloneBoard}
        onCreateBoard={onCreateBoard}
        onCreateBoardFolder={onCreateBoardFolder}
        onUpdateBoardFolder={onUpdateBoardFolder}
        onDeleteBoardFolder={onDeleteBoardFolder}
        onDeleteBoard={onDeleteBoard}
        onMoveBoard={onMoveBoard}
        onReorderBoards={onReorderBoards}
        onClose={() => onSetWorkspaceMode('outline')}
      />
    )
  }

  if (projectMeta && activeBoard) {
    if (workspaceMode === 'outline') {
      return (
        <OutlineWorkspacePanel
          projectMeta={projectMeta}
          activeBoard={activeBoard}
          boards={boards}
          boardFolders={boardFolders}
          scenes={scenes}
          sceneFolders={sceneFolders}
          blockTemplates={blockTemplates}
          filteredSceneIds={filteredSceneIds}
          tags={tags}
          sceneDensity={sceneDensity}
          boardViewMode={boardViewMode}
          boardBlockKindsForProject={boardBlockKindsForProject}
          selectedSceneId={selectedSceneId}
          selectedSceneIds={selectedSceneIds}
          selectedBoardItemId={selectedBoardItemId}
          onChangeBoardViewMode={onChangeBoardViewMode}
          onSelectBoardForWindow={onSelectBoardForWindow}
          onOpenBoardDetailsForWindow={onOpenBoardDetailsForWindow}
          onUpdateBoardDraft={onUpdateBoardDraft}
          onCloneBoard={onCloneBoard}
          onCreateBoard={onCreateBoard}
          onCreateBoardFolder={onCreateBoardFolder}
          onUpdateBoardFolder={onUpdateBoardFolder}
          onDeleteBoardFolder={onDeleteBoardFolder}
          onDeleteBoard={onDeleteBoard}
          onMoveBoard={onMoveBoard}
          onReorderBoards={onReorderBoards}
          onSelectScene={onSelectScene}
          onOpenInspector={onOpenInspector}
          onCreateScene={onCreateScene}
          onToggleSceneSelection={onToggleSceneSelection}
          onSetSceneSelection={onSetSceneSelection}
          onClearSceneSelection={onClearSceneSelection}
          onCreateSceneFolder={onCreateSceneFolder}
          onUpdateSceneFolder={onUpdateSceneFolder}
          onDeleteSceneFolder={onDeleteSceneFolder}
          onMoveScenesToFolder={onMoveScenesToFolder}
          onToggleKeyScene={onToggleKeyScene}
          onDuplicateScene={onDuplicateScene}
          onDeleteScene={onDeleteScene}
          onDeleteSelectedScenes={onDeleteSelectedScenes}
          onAddSceneToCurrentBoard={onAddSceneToCurrentBoard}
          onAddBlockToCurrentBoard={onAddBlockToCurrentBoard}
          onAddBlockTemplateToCurrentBoard={onAddBlockTemplateToCurrentBoard}
          onSaveBlockTemplate={onSaveBlockTemplate}
          onDeleteBlockTemplate={onDeleteBlockTemplate}
          onCopyBlockToBoard={onCopyBlockToBoard}
          onDuplicateBoardItem={onDuplicateBoardItem}
          onRemoveBoardItem={onRemoveBoardItem}
          onReorderCurrentBoard={onReorderCurrentBoard}
          onPersistBoardItemDraft={onPersistBoardItemDraft}
          onInlineUpdateScene={onInlineUpdateScene}
          onInlineUpdateBlock={onInlineUpdateBlock}
          onCreateSceneBeat={onCreateSceneBeat}
          onUpdateSceneBeat={onUpdateSceneBeat}
          onDeleteSceneBeat={onDeleteSceneBeat}
          onReorderSceneBeats={onReorderSceneBeats}
        />
      )
    }

    if (workspaceMode === 'notebook') {
      return <NotebookWorkspacePanel notebook={notebook} onUpdateNotebookDraft={onUpdateNotebookDraft} onPersistNotebook={onPersistNotebook} />
    }

    return (
      <SceneBankWorkspacePanel
        activeBoard={activeBoard}
        filteredScenes={filteredScenes}
        sceneFolders={sceneFolders}
        tags={tags}
        sceneDensity={sceneDensity}
        selectedSceneId={selectedSceneId}
        selectedSceneIds={selectedSceneIds}
        selectedBoardItemId={selectedBoardItemId}
        onSelectScene={onSelectScene}
        onToggleSceneSelection={onToggleSceneSelection}
        onSetSceneSelection={onSetSceneSelection}
        onClearSceneSelection={onClearSceneSelection}
        onOpenInspector={onOpenInspector}
        onInlineUpdateScene={onInlineUpdateScene}
        onToggleKeyScene={onToggleKeyScene}
        onCreateScene={onCreateScene}
        onCreateSceneFolder={onCreateSceneFolder}
        onUpdateSceneFolder={onUpdateSceneFolder}
        onDeleteSceneFolder={onDeleteSceneFolder}
        onMoveScenesToFolder={onMoveScenesToFolder}
        onDuplicateScene={onDuplicateScene}
        onDeleteScene={onDeleteScene}
        onDeleteSelectedScenes={onDeleteSelectedScenes}
        onAddSceneToCurrentBoard={onAddSceneToCurrentBoard}
        onSendScenesToOpenOutline={onSendScenesToOpenOutline}
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
