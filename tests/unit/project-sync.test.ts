import { describe, expect, it } from 'vitest'

import type { AppSettings } from '../../src/types/ai'
import type { ArchiveFolder } from '../../src/types/archive'
import type { Board, BoardFolder } from '../../src/types/board'
import type { NotebookDocument, ProjectMeta, ProjectSettings } from '../../src/types/project'
import type { Scene, SceneFolder } from '../../src/types/scene'
import type { Tag } from '../../src/types/tag'
import {
  buildStateFromFullSnapshot,
  mergeProjectChangeResult,
  type ProjectSyncState,
} from '../../src/stores/project-sync'

const appSettings: AppSettings = {
  ai: {
    provider: 'openai',
    openAiModel: 'gpt-5-mini',
    geminiModel: 'gemini-2.5-flash',
    systemPrompt: '',
    extraInstructions: '',
    responseStyle: 'structured',
    secretStorageMode: 'safe',
    allowPlaintextSecrets: false,
    hasOpenAiApiKey: false,
    hasGeminiApiKey: false,
  },
  ui: {
    restoreLastProject: true,
    restoreLastLayout: true,
    defaultBoardView: 'outline',
    defaultSceneDensity: 'compact',
    defaultDetachedWorkspace: 'outline',
    lastProjectPath: null,
    lastLayoutByProject: {},
    savedLayouts: [],
  },
  transcription: {
    modelId: 'small',
    language: 'auto',
    timestampInterval: 'segment',
  },
}

const projectSettings: ProjectSettings = {
  title: '',
  genre: '',
  format: '',
  targetRuntimeMinutes: 90,
  logline: '',
  defaultBoardView: 'outline',
  enabledBlockKinds: ['chapter', 'voiceover', 'narration', 'text-card', 'note'],
  blockKindOrder: ['chapter', 'voiceover', 'narration', 'text-card', 'note'],
}

const notebook: NotebookDocument = { tabs: [], activeTabId: null, updatedAt: null }

const scene: Scene = {
  id: 'scene_1',
  sortOrder: 0,
  title: 'Scene',
  synopsis: '',
  notes: '',
  color: 'charcoal',
  status: 'candidate',
  keyRating: 3,
  folder: '',
  category: '',
  estimatedDuration: 0,
  actualDuration: 0,
  location: '',
  characters: [],
  function: '',
  sourceReference: '',
  quoteMoment: '',
  quality: '',
  sourcePaths: [],
  tagIds: [],
  beats: [],
  createdAt: '2026-04-02T10:00:00.000Z',
  updatedAt: '2026-04-02T10:00:00.000Z',
}

const board: Board = {
  id: 'board_1',
  name: 'Board',
  description: '',
  color: 'charcoal',
  folder: '',
  sortOrder: 0,
  createdAt: '2026-04-02T10:00:00.000Z',
  updatedAt: '2026-04-02T10:00:00.000Z',
  items: [
    {
      id: 'item_1',
      boardId: 'board_1',
      kind: 'scene',
      sceneId: 'scene_1',
      position: 0,
      boardX: 0,
      boardY: 0,
      boardW: 300,
      boardH: 132,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:00:00.000Z',
    },
  ],
}

function createState(overrides?: Partial<ProjectSyncState>): ProjectSyncState {
  return {
    projectMeta: { path: '/tmp/project.narralab', name: 'Project' },
    projectSettings,
    appSettings,
    notebook,
    archiveFolders: [{ id: 'folder_1', name: 'Archive', color: 'slate', parentId: null, sortOrder: 0 }],
    archiveItems: [],
    scenes: [scene],
    sceneFolders: [] satisfies SceneFolder[],
    boards: [board],
    boardFolders: [] satisfies BoardFolder[],
    blockTemplates: [],
    tags: [] satisfies Tag[],
    consultantMessages: [
      {
        id: 'msg_1',
        role: 'assistant',
        content: 'Keep this',
        createdAt: '2026-04-02T10:00:00.000Z',
      },
    ],
    activeBoardId: 'board_1',
    selectedBoardId: 'board_1',
    selectedSceneId: 'scene_1',
    selectedSceneIds: ['scene_1'],
    selectedBoardItemId: 'item_1',
    selectedArchiveFolderId: 'folder_1',
    ...overrides,
  }
}

describe('project-sync', () => {
  it('builds a full snapshot state while preserving valid selections', () => {
    const state = createState()
    const meta: ProjectMeta = { path: '/tmp/project.narralab', name: 'Project' }
    const next = buildStateFromFullSnapshot(state, {
      meta,
      projectSettings,
      notebook,
      archiveFolders: state.archiveFolders,
      archiveItems: [],
      scenes: [scene],
      sceneFolders: [],
      boards: [board],
      boardFolders: [],
      blockTemplates: [],
      tags: [],
    })

    expect(next.projectMeta).toEqual(meta)
    expect(next.consultantMessages).toEqual(state.consultantMessages)
    expect(next.activeBoardId).toBe('board_1')
    expect(next.selectedBoardId).toBe('board_1')
    expect(next.selectedArchiveFolderId).toBe('folder_1')
  })

  it('drops invalid selections when partial project changes remove backing data', () => {
    const state = createState()
    const result = mergeProjectChangeResult(state, {
      kind: 'partial',
      meta: { path: '/tmp/other-project.narralab', name: 'Other' },
      appSettings: null,
      projectSettings: null,
      notebook: null,
      archiveFolders: [] satisfies ArchiveFolder[],
      archiveItems: null,
      scenes: [],
      sceneFolders: null,
      boards: [],
      boardFolders: null,
      blockTemplates: null,
      tags: null,
      resetConsultantMessages: true,
    })

    expect(result.projectMeta).toEqual({ path: '/tmp/other-project.narralab', name: 'Other' })
    expect(result.consultantMessages).toEqual([])
    expect(result.activeBoardId).toBeNull()
    expect(result.selectedBoardId).toBeNull()
    expect(result.selectedBoardItemId).toBeNull()
    expect(result.selectedSceneId).toBeNull()
    expect(result.selectedSceneIds).toEqual([])
    expect(result.selectedArchiveFolderId).toBeNull()
  })
})
