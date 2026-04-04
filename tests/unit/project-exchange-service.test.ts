import { describe, expect, it, vi } from 'vitest'

import type { Board } from '../../src/types/board'
import type { NotebookDocument } from '../../src/types/project'
import type { Scene } from '../../src/types/scene'
import type { Tag } from '../../src/types/tag'
import { ProjectExchangeService } from '../../electron/main/project-exchange'

function createContext(overrides?: {
  boards?: Board[]
  scenes?: Scene[]
  tags?: Tag[]
  notebook?: NotebookDocument
  meta?: { path: string; name: string } | null
}) {
  return {
    ensureDatabase: vi.fn(),
    getMeta: vi.fn(() => overrides?.meta ?? { path: '/tmp/project.narralab', name: 'Project' }),
    getProjectSettings: vi.fn(() => ({
      title: '',
      genre: '',
      format: '',
      targetRuntimeMinutes: 90,
      logline: '',
      defaultBoardView: 'outline' as const,
      enabledBlockKinds: ['chapter', 'voiceover', 'narration', 'text-card', 'note'],
      blockKindOrder: ['chapter', 'voiceover', 'narration', 'text-card', 'note'],
    })),
    listScenes: vi.fn(() => overrides?.scenes ?? []),
    listTags: vi.fn(() => overrides?.tags ?? []),
    listBoards: vi.fn(() => overrides?.boards ?? []),
    getNotebook: vi.fn(() => overrides?.notebook ?? { tabs: [], activeTabId: null, updatedAt: null }),
    updateProjectSettings: vi.fn(),
    updateNotebook: vi.fn(),
  }
}

describe('ProjectExchangeService', () => {
  it('renders board scripts from current scene data without note blocks', () => {
    const board: Board = {
      id: 'board_1',
      name: 'Pilot',
      description: 'Board description',
      color: 'charcoal',
      folder: '',
      sortOrder: 0,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:00:00.000Z',
      items: [
        {
          id: 'item_scene',
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
        {
          id: 'item_note',
          boardId: 'board_1',
          kind: 'note',
          title: 'Ignore me',
          body: 'This should not be exported',
          color: 'charcoal',
          position: 1,
          boardX: 0,
          boardY: 0,
          boardW: 260,
          boardH: 108,
          createdAt: '2026-04-02T10:00:00.000Z',
          updatedAt: '2026-04-02T10:00:00.000Z',
        },
      ],
    }

    const scene: Scene = {
      id: 'scene_1',
      sortOrder: 0,
      title: 'Opening scene',
      synopsis: 'A quiet street before dawn.',
      shootDate: '',
      shootBlock: '',
      shootDayPlace: '',
      shootDayProduction: '',
      shootDayDirector: '',
      shootDayPhotographer: '',
      shootDayParticipants: '',
      shootDayFolderName: '',
      shootDayFileName: '',
      shootDayClipCount: '',
      shootDayDescription: '',
      shootDayStrongestMaterial: '',
      shootDayFollowUp: '',
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

    const service = new ProjectExchangeService(
      createContext({
        boards: [board],
        scenes: [scene],
      }),
    )

    const script = service.renderBoardScript(board, 'md')
    expect(script).toContain('# Pilot')
    expect(script).toContain('## Opening scene')
    expect(script).toContain('A quiet street before dawn.')
    expect(script).not.toContain('Ignore me')
  })

  it('builds consultant context from the active board and tag map', () => {
    const board: Board = {
      id: 'board_1',
      name: 'Pilot',
      description: '',
      color: 'charcoal',
      folder: '',
      sortOrder: 0,
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:00:00.000Z',
      items: [
        {
          id: 'item_scene',
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

    const scene: Scene = {
      id: 'scene_1',
      sortOrder: 0,
      title: 'Opening scene',
      synopsis: 'A quiet street before dawn.',
      shootDate: '',
      shootBlock: '',
      shootDayPlace: '',
      shootDayProduction: '',
      shootDayDirector: '',
      shootDayPhotographer: '',
      shootDayParticipants: '',
      shootDayFolderName: '',
      shootDayFileName: '',
      shootDayClipCount: '',
      shootDayDescription: '',
      shootDayStrongestMaterial: '',
      shootDayFollowUp: '',
      notes: '',
      color: 'charcoal',
      status: 'candidate',
      keyRating: 4,
      folder: '',
      category: 'Intro',
      estimatedDuration: 0,
      actualDuration: 0,
      location: '',
      characters: [],
      function: '',
      sourceReference: '',
      quoteMoment: '',
      quality: '',
      sourcePaths: [],
      tagIds: ['tag_1'],
      beats: [],
      createdAt: '2026-04-02T10:00:00.000Z',
      updatedAt: '2026-04-02T10:00:00.000Z',
    }

    const service = new ProjectExchangeService(
      createContext({
        boards: [board],
        scenes: [scene],
        tags: [{ id: 'tag_1', name: 'Archive', type: 'general' }],
      }),
    )

    const context = service.getConsultantContext('board_1')
    expect(context).toContain('Project: Project')
    expect(context).toContain('Active board: Pilot')
    expect(context).toContain('Scene: Opening scene')
    expect(context).toContain('Tags: Archive')
    expect(context).toContain('Key rating: 4/5')
  })
})
