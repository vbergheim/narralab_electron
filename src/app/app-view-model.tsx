import type { ComponentProps, ReactNode } from 'react'

import { BoardInspector } from '@/features/inspector/board-inspector'
import { BoardItemInspector } from '@/features/inspector/board-item-inspector'
import { BulkSceneInspector } from '@/features/inspector/bulk-scene-inspector'
import { SceneInspector } from '@/features/inspector/scene-inspector'
import type { WorkspaceMode } from '@/app/app-workspace-contract'
import { isTextBoardItem } from '@/types/board'
import type { Board, BoardTextItemKind } from '@/types/board'
import type { ProjectSettings } from '@/types/project'
import type { Scene } from '@/types/scene'
import type { Tag } from '@/types/tag'
import type { FilterState } from '@/stores/filter-store'

type BoardItemInspectorProps = ComponentProps<typeof BoardItemInspector>
type BoardInspectorProps = ComponentProps<typeof BoardInspector>
type BulkSceneInspectorProps = ComponentProps<typeof BulkSceneInspector>
type SceneInspectorProps = ComponentProps<typeof SceneInspector>

export function matchesSceneFilters(scene: Scene, filters: FilterState) {
  const query = filters.search.trim().toLowerCase()
  const haystack = [
    scene.title,
    scene.synopsis,
    scene.notes,
    scene.location,
    scene.category,
    scene.function,
    scene.sourceReference,
    scene.quoteMoment,
    scene.quality,
    scene.sourcePaths.join(' '),
    scene.characters.join(' '),
  ]
    .join(' ')
    .toLowerCase()

  if (query && !haystack.includes(query)) return false
  if (filters.onlyKeyScenes && scene.keyRating <= 0) return false
  if (filters.selectedStatuses.length > 0 && !filters.selectedStatuses.includes(scene.status)) return false
  if (filters.selectedColors.length > 0 && !filters.selectedColors.includes(scene.color)) return false
  if (filters.selectedCategories.length > 0 && !filters.selectedCategories.includes(scene.category)) return false
  if (filters.selectedTagIds.length > 0 && !filters.selectedTagIds.every((tagId) => scene.tagIds.includes(tagId))) {
    return false
  }

  return true
}

export function deriveSelectionState({
  boards,
  boardIdForWindow,
  selectedBoardId,
  selectedSceneId,
  selectedSceneIds,
  selectedBoardItemId,
  scenes,
  workspaceMode,
}: {
  boards: Board[]
  boardIdForWindow: string | null
  selectedBoardId: string | null
  selectedSceneId: string | null
  selectedSceneIds: string[]
  selectedBoardItemId: string | null
  scenes: Scene[]
  workspaceMode: WorkspaceMode
}) {
  const activeBoard = boards.find((board) => board.id === boardIdForWindow) ?? null
  const selectedBoard = boards.find((board) => board.id === selectedBoardId) ?? null
  const selectedBoardItem = activeBoard?.items.find((item) => item.id === selectedBoardItemId) ?? null
  const selectedScene =
    scenes.find((scene) => scene.id === selectedSceneId) ??
    (activeBoard && activeBoard.items[0] && activeBoard.items[0].kind === 'scene'
      ? scenes.find((scene) => scene.id === activeBoard.items[0].sceneId) ?? null
      : null)
  const selectedBlock = selectedBoardItem && isTextBoardItem(selectedBoardItem) ? selectedBoardItem : null
  const multiSelectedSceneCount = workspaceMode === 'bank' ? selectedSceneIds.length : 0

  return {
    activeBoard,
    selectedBoard,
    selectedScene,
    selectedBlock,
    multiSelectedSceneCount,
  }
}

export function getWorkspaceSummary({
  workspaceMode,
  consultantMessagesCount,
  archiveItemsCount,
  boardsCount,
  boardFoldersCount,
  notebookUpdatedAt,
  activeBoard,
}: {
  workspaceMode: WorkspaceMode
  consultantMessagesCount: number
  archiveItemsCount: number
  boardsCount: number
  boardFoldersCount: number
  notebookUpdatedAt: string | null
  activeBoard: Board | null
}) {
  if (workspaceMode === 'settings') {
    return 'App, project and AI preferences'
  }
  if (workspaceMode === 'consultant') {
    return `${consultantMessagesCount} messages in current conversation`
  }
  if (workspaceMode === 'archive') {
    return `${archiveItemsCount} files in archive`
  }
  if (workspaceMode === 'board-manager') {
    return `${boardsCount} boards, ${boardFoldersCount} folders`
  }
  if (workspaceMode === 'transcribe') {
    return 'Local Whisper transcription'
  }
  if (workspaceMode === 'notebook') {
    return notebookUpdatedAt
      ? `Notebook saved ${new Date(notebookUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : 'Project notebook'
  }

  return activeBoard ? `${activeBoard.items.length} rows in active outline` : 'No board selected'
}

export function getBoardBlockKindsForProject(projectSettings: ProjectSettings | null): BoardTextItemKind[] {
  const enabled = projectSettings?.enabledBlockKinds ?? ['chapter', 'voiceover', 'narration', 'text-card', 'note']
  const order = projectSettings?.blockKindOrder ?? enabled
  return order.filter((kind) => enabled.includes(kind))
}

export function buildInspectorContent({
  selectedBlock,
  selectedBoard,
  selectedScene,
  selectedSceneId,
  selectedSceneIds,
  multiSelectedSceneCount,
  tags,
  onCollapse,
  onSaveBoardItem,
  onSaveBlockTemplate,
  onDeleteBoardItem,
  onSaveBoard,
  onBulkUpdateScenes,
  onDeleteScenes,
  onClearSceneSelection,
  onSaveScene,
  onCreateSceneBeat,
  onUpdateSceneBeat,
  onDeleteSceneBeat,
  onReorderSceneBeats,
  onDeleteScene,
}: {
  selectedBlock: BoardItemInspectorProps['item']
  selectedBoard: BoardInspectorProps['board']
  selectedScene: SceneInspectorProps['scene']
  selectedSceneId: string | null
  selectedSceneIds: string[]
  multiSelectedSceneCount: number
  tags: Tag[]
  onCollapse(): void
  onSaveBoardItem: BoardItemInspectorProps['onSave']
  onSaveBlockTemplate: BoardItemInspectorProps['onSaveTemplate']
  onDeleteBoardItem: BoardItemInspectorProps['onDelete']
  onSaveBoard: BoardInspectorProps['onSave']
  onBulkUpdateScenes: BulkSceneInspectorProps['onApply']
  onDeleteScenes(sceneIds: string[]): void
  onClearSceneSelection(): void
  onSaveScene: SceneInspectorProps['onSave']
  onCreateSceneBeat: SceneInspectorProps['onCreateBeat']
  onUpdateSceneBeat: SceneInspectorProps['onUpdateBeat']
  onDeleteSceneBeat: SceneInspectorProps['onDeleteBeat']
  onReorderSceneBeats: SceneInspectorProps['onReorderBeats']
  onDeleteScene: SceneInspectorProps['onDelete']
}): ReactNode {
  if (selectedBlock) {
    return (
      <BoardItemInspector
        key={selectedBlock.id}
        item={selectedBlock}
        onCollapse={onCollapse}
        onSave={onSaveBoardItem}
        onSaveTemplate={onSaveBlockTemplate}
        onDelete={onDeleteBoardItem}
      />
    )
  }

  if (selectedBoard) {
    return (
      <BoardInspector
        key={selectedBoard.id}
        board={selectedBoard}
        onCollapse={onCollapse}
        onSave={onSaveBoard}
      />
    )
  }

  if (multiSelectedSceneCount > 1) {
    return (
      <BulkSceneInspector
        key={`bulk-${selectedSceneIds.join('-')}`}
        count={multiSelectedSceneCount}
        onCollapse={onCollapse}
        onApply={onBulkUpdateScenes}
        onDelete={() => onDeleteScenes(selectedSceneIds)}
        onClear={onClearSceneSelection}
      />
    )
  }

  return (
    <SceneInspector
      key={selectedSceneId ?? 'empty'}
      scene={selectedSceneId ? selectedScene ?? null : null}
      tags={tags}
      onCollapse={onCollapse}
      onSave={onSaveScene}
      onCreateBeat={onCreateSceneBeat}
      onUpdateBeat={onUpdateSceneBeat}
      onDeleteBeat={onDeleteSceneBeat}
      onReorderBeats={onReorderSceneBeats}
      onDelete={onDeleteScene}
    />
  )
}
