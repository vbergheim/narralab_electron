import { emptyNotebookDocument } from '@/lib/notebook-document'
import type { AppSettings, ConsultantMessage } from '@/types/ai'
import type { ArchiveFolder, ArchiveItem } from '@/types/archive'
import type { BlockTemplate, Board, BoardFolder } from '@/types/board'
import type {
  NarraLabApi,
  NotebookDocument,
  ProjectChangeScope,
  ProjectMeta,
  ProjectSettings,
} from '@/types/project'
import type { Scene, SceneFolder } from '@/types/scene'
import type { Tag } from '@/types/tag'

export type ProjectSyncState = {
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
  consultantMessages: ConsultantMessage[]
  activeBoardId: string | null
  selectedBoardId: string | null
  selectedSceneId: string | null
  selectedSceneIds: string[]
  selectedBoardItemId: string | null
  selectedArchiveFolderId: string | null
}

export type ProjectDataSnapshot = {
  meta: ProjectMeta
  projectSettings: ProjectSettings
  notebook: NotebookDocument
  archiveFolders: ArchiveFolder[]
  archiveItems: ArchiveItem[]
  scenes: Scene[]
  sceneFolders: SceneFolder[]
  boards: Board[]
  boardFolders: BoardFolder[]
  blockTemplates: BlockTemplate[]
  tags: Tag[]
}

type ScopedProjectChangeData = {
  kind: 'partial'
  meta: ProjectMeta
  appSettings: AppSettings | null
  projectSettings: ProjectSettings | null
  notebook: NotebookDocument | null
  archiveFolders: ArchiveFolder[] | null
  archiveItems: ArchiveItem[] | null
  scenes: Scene[] | null
  sceneFolders: SceneFolder[] | null
  boards: Board[] | null
  boardFolders: BoardFolder[] | null
  blockTemplates: BlockTemplate[] | null
  tags: Tag[] | null
  resetConsultantMessages: boolean
}

export type ProjectChangeLoadResult =
  | { kind: 'reset' }
  | { kind: 'full'; snapshot: ProjectDataSnapshot | null }
  | ScopedProjectChangeData

export function resetProjectState() {
  return {
    projectMeta: null,
    projectSettings: null,
    notebook: emptyNotebookDocument(),
    archiveFolders: [],
    archiveItems: [],
    scenes: [],
    sceneFolders: [],
    boards: [],
    boardFolders: [],
    blockTemplates: [],
    tags: [],
    activeBoardId: null,
    selectedBoardId: null,
    selectedSceneId: null,
    selectedSceneIds: [],
    selectedBoardItemId: null,
    selectedArchiveFolderId: null,
  }
}

export function normalizeProjectChangeScopes(scopes: ProjectChangeScope[]) {
  if (scopes.length === 0) {
    return ['all'] satisfies ProjectChangeScope[]
  }

  return [...new Set(scopes)]
}

export async function loadFullProjectSnapshot(api: NarraLabApi): Promise<ProjectDataSnapshot | null> {
  const meta = await api.project.getMeta()
  if (!meta) {
    return null
  }

  const [projectSettings, notebook, archiveFolders, archiveItems, scenes, sceneFolders, boards, boardFolders, blockTemplates, tags] =
    await Promise.all([
      api.project.getSettings(),
      api.notebook.get(),
      api.archive.folders.list(),
      api.archive.items.list(),
      api.scenes.list(),
      api.sceneFolders.list(),
      api.boards.list(),
      api.boardFolders.list(),
      api.blockTemplates.list(),
      api.tags.list(),
    ])

  return {
    meta,
    projectSettings,
    notebook,
    archiveFolders,
    archiveItems,
    scenes,
    sceneFolders,
    boards,
    boardFolders,
    blockTemplates,
    tags,
  }
}

export function buildStateFromFullSnapshot(state: ProjectSyncState, snapshot: ProjectDataSnapshot) {
  const { meta, projectSettings, notebook, archiveFolders, archiveItems, scenes, sceneFolders, boards, boardFolders, blockTemplates, tags } =
    snapshot

  return {
    projectMeta: meta,
    projectSettings,
    notebook,
    archiveFolders,
    archiveItems,
    scenes,
    sceneFolders,
    boards,
    boardFolders,
    blockTemplates,
    tags,
    consultantMessages: state.projectMeta?.path === meta.path ? state.consultantMessages : [],
    activeBoardId:
      state.activeBoardId && boards.some((board) => board.id === state.activeBoardId)
        ? state.activeBoardId
        : boards[0]?.id ?? null,
    selectedBoardId:
      state.selectedBoardId && boards.some((board) => board.id === state.selectedBoardId)
        ? state.selectedBoardId
        : null,
    selectedArchiveFolderId:
      state.selectedArchiveFolderId &&
      archiveFolders.some((folder) => folder.id === state.selectedArchiveFolderId)
        ? state.selectedArchiveFolderId
        : null,
  }
}

export async function loadProjectChangeData(
  api: NarraLabApi,
  currentMeta: ProjectMeta | null,
  scopes: ProjectChangeScope[],
): Promise<ProjectChangeLoadResult> {
  const normalizedScopes = normalizeProjectChangeScopes(scopes)
  if (normalizedScopes.includes('all')) {
    return {
      kind: 'full',
      snapshot: await loadFullProjectSnapshot(api),
    }
  }

  let meta = currentMeta
  let resetConsultantMessages = false

  if (normalizedScopes.includes('meta') || !meta) {
    meta = await api.project.getMeta()
    if (!meta) {
      return { kind: 'reset' }
    }
    resetConsultantMessages = currentMeta?.path !== meta.path
  }

  const loaders = {
    appSettings: normalizedScopes.includes('app-settings') ? api.settings.get() : null,
    projectSettings: normalizedScopes.includes('project-settings') ? api.project.getSettings() : null,
    notebook: normalizedScopes.includes('notebook') ? api.notebook.get() : null,
    archiveFolders: normalizedScopes.includes('archive') ? api.archive.folders.list() : null,
    archiveItems: normalizedScopes.includes('archive') ? api.archive.items.list() : null,
    scenes: normalizedScopes.includes('scenes') ? api.scenes.list() : null,
    sceneFolders: normalizedScopes.includes('scene-folders') ? api.sceneFolders.list() : null,
    boards: normalizedScopes.includes('boards') ? api.boards.list() : null,
    boardFolders: normalizedScopes.includes('board-folders') ? api.boardFolders.list() : null,
    blockTemplates: normalizedScopes.includes('block-templates') ? api.blockTemplates.list() : null,
    tags: normalizedScopes.includes('tags') ? api.tags.list() : null,
  }

  const [
    appSettings,
    projectSettings,
    notebook,
    archiveFolders,
    archiveItems,
    scenes,
    sceneFolders,
    boards,
    boardFolders,
    blockTemplates,
    tags,
  ] = await Promise.all([
    loaders.appSettings,
    loaders.projectSettings,
    loaders.notebook,
    loaders.archiveFolders,
    loaders.archiveItems,
    loaders.scenes,
    loaders.sceneFolders,
    loaders.boards,
    loaders.boardFolders,
    loaders.blockTemplates,
    loaders.tags,
  ])

  return {
    kind: 'partial',
    meta,
    appSettings,
    projectSettings,
    notebook,
    archiveFolders,
    archiveItems,
    scenes,
    sceneFolders,
    boards,
    boardFolders,
    blockTemplates,
    tags,
    resetConsultantMessages,
  }
}

export function mergeProjectChangeResult(state: ProjectSyncState, result: ScopedProjectChangeData) {
  const nextBoards = result.boards ?? state.boards
  const nextArchiveFolders = result.archiveFolders ?? state.archiveFolders
  const nextScenes = result.scenes ?? state.scenes
  const nextSelectedSceneIds = result.scenes
    ? state.selectedSceneIds.filter((sceneId) => nextScenes.some((scene) => scene.id === sceneId))
    : state.selectedSceneIds

  return {
    projectMeta: result.meta,
    consultantMessages: result.resetConsultantMessages ? [] : state.consultantMessages,
    ...(result.appSettings ? { appSettings: result.appSettings } : {}),
    ...(result.projectSettings ? { projectSettings: result.projectSettings } : {}),
    ...(result.notebook ? { notebook: result.notebook } : {}),
    ...(result.archiveFolders ? { archiveFolders: result.archiveFolders } : {}),
    ...(result.archiveItems ? { archiveItems: result.archiveItems } : {}),
    ...(result.scenes
      ? {
          scenes: result.scenes,
          selectedSceneIds: nextSelectedSceneIds,
          selectedSceneId:
            state.selectedSceneId && nextScenes.some((scene) => scene.id === state.selectedSceneId)
              ? state.selectedSceneId
              : null,
        }
      : {}),
    ...(result.sceneFolders ? { sceneFolders: result.sceneFolders } : {}),
    ...(result.boards
      ? {
          boards: result.boards,
          activeBoardId:
            state.activeBoardId && nextBoards.some((board) => board.id === state.activeBoardId)
              ? state.activeBoardId
              : nextBoards[0]?.id ?? null,
          selectedBoardId:
            state.selectedBoardId && nextBoards.some((board) => board.id === state.selectedBoardId)
              ? state.selectedBoardId
              : null,
          selectedBoardItemId:
            state.selectedBoardItemId &&
            nextBoards.some((board) => board.items.some((item) => item.id === state.selectedBoardItemId))
              ? state.selectedBoardItemId
              : null,
        }
      : {}),
    ...(result.boardFolders ? { boardFolders: result.boardFolders } : {}),
    ...(result.blockTemplates ? { blockTemplates: result.blockTemplates } : {}),
    ...(result.tags ? { tags: result.tags } : {}),
    ...(result.archiveFolders
      ? {
          selectedArchiveFolderId:
            state.selectedArchiveFolderId &&
            nextArchiveFolders.some((folder) => folder.id === state.selectedArchiveFolderId)
              ? state.selectedArchiveFolderId
              : null,
        }
      : {}),
  }
}
