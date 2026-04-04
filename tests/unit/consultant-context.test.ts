import { describe, expect, it } from 'vitest'

import {
  buildConsultantContext,
  buildConsultantContextSummary,
  inferConsultantHint,
} from '../../src/features/consultant/consultant-context'
import type { Board } from '../../src/types/board'
import type { ProjectMeta, ProjectSettings } from '../../src/types/project'
import type { Scene } from '../../src/types/scene'

const projectMeta: ProjectMeta = {
  path: '/tmp/project.narralab',
  name: 'Project',
}

const projectSettings: ProjectSettings = {
  title: 'Pilot',
  genre: '',
  format: '',
  targetRuntimeMinutes: 90,
  logline: '',
  defaultBoardView: 'outline',
  enabledBlockKinds: ['chapter', 'voiceover', 'narration', 'text-card', 'note'],
  blockKindOrder: ['chapter', 'voiceover', 'narration', 'text-card', 'note'],
}

function buildScene(id: string, overrides: Partial<Scene> = {}): Scene {
  return {
    id,
    sortOrder: 0,
    title: `Scene ${id}`,
    synopsis: `Synopsis for ${id}`,
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
    cameraNotes: '',
    audioNotes: '',
    color: 'charcoal',
    status: 'candidate',
    keyRating: 3,
    folder: '',
    category: 'Beat',
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
    ...overrides,
  }
}

function buildBoard(items: Board['items']): Board {
  return {
    id: 'board-1',
    name: 'Act 1',
    description: '',
    color: 'charcoal',
    folder: '',
    sortOrder: 0,
    createdAt: '2026-04-02T10:00:00.000Z',
    updatedAt: '2026-04-02T10:00:00.000Z',
    items,
  }
}

describe('consultant context', () => {
  it('builds automatic ambient and focused context from workspace and active board', () => {
    const scene = buildScene('scene-1', { title: 'Opening', synopsis: 'A quiet street before dawn.' })
    const board = buildBoard([
      {
        id: 'item-1',
        boardId: 'board-1',
        kind: 'scene',
        sceneId: scene.id,
        position: 0,
        boardX: 0,
        boardY: 0,
        boardW: 300,
        boardH: 132,
        createdAt: scene.createdAt,
        updatedAt: scene.updatedAt,
      },
    ])

    const context = buildConsultantContext({
      projectMeta,
      projectSettings,
      workspaceMode: 'outline',
      boards: [board],
      scenes: [scene],
      tags: [],
      activeBoardId: board.id,
      selectedSceneId: scene.id,
      selectedSceneIds: [scene.id],
      selectedBoardItemId: null,
    })

    expect(context.ambient).toContain('Project: Pilot')
    expect(context.ambient).toContain('Workspace: Outline')
    expect(context.focused).toContain('Focused scene:')
    expect(context.focused).toContain('Active board outline:')
    expect(buildConsultantContextSummary({
      projectMeta,
      projectSettings,
      workspaceMode: 'outline',
      boards: [board],
      scenes: [scene],
      tags: [],
      activeBoardId: board.id,
      selectedSceneId: scene.id,
      selectedSceneIds: [scene.id],
      selectedBoardItemId: null,
    })).toBe('Outline · Act 1 · Opening')
  })

  it('emits a proactive hint when several board scenes are underspecified', () => {
    const scenes = [
      buildScene('scene-1', { title: '', synopsis: '', category: '' }),
      buildScene('scene-2', { title: 'Scene 2', synopsis: '', category: '' }),
      buildScene('scene-3', { title: '', synopsis: 'Something', category: '' }),
    ]
    const board = buildBoard(
      scenes.map((scene, index) => ({
        id: `item-${index + 1}`,
        boardId: 'board-1',
        kind: 'scene',
        sceneId: scene.id,
        position: index,
        boardX: 0,
        boardY: 0,
        boardW: 300,
        boardH: 132,
        createdAt: scene.createdAt,
        updatedAt: scene.updatedAt,
      })),
    )

    const hint = inferConsultantHint({
      projectMeta,
      projectSettings,
      workspaceMode: 'outline',
      boards: [board],
      scenes,
      tags: [],
      activeBoardId: board.id,
      selectedSceneId: null,
      selectedSceneIds: [],
      selectedBoardItemId: null,
    })

    expect(hint).not.toBeNull()
    expect(hint?.title).toBe('Flere scener er uferdige')
  })

  it('includes the whole scene bank when the scene bank workspace has no focused scene', () => {
    const scenes = [
      buildScene('scene-1', { title: 'Opening', synopsis: 'A quiet street before dawn.', category: 'Intro', location: 'Street' }),
      buildScene('scene-2', { title: 'Kitchen', synopsis: 'Coffee and tension in the kitchen.', category: 'Observational', location: 'Apartment' }),
    ]
    const board = buildBoard([
      {
        id: 'item-1',
        boardId: 'board-1',
        kind: 'scene',
        sceneId: scenes[0]!.id,
        position: 0,
        boardX: 0,
        boardY: 0,
        boardW: 300,
        boardH: 132,
        createdAt: scenes[0]!.createdAt,
        updatedAt: scenes[0]!.updatedAt,
      },
    ])

    const context = buildConsultantContext({
      projectMeta,
      projectSettings,
      workspaceMode: 'bank',
      boards: [board],
      scenes,
      tags: [],
      activeBoardId: board.id,
      selectedSceneId: null,
      selectedSceneIds: [],
      selectedBoardItemId: null,
    })

    expect(context.ambient).toContain('Workspace: Scene Bank')
    expect(context.ambient).toContain('Focused scope: Entire scene bank (2 scenes)')
    expect(context.focused).toContain('Scene bank:')
    expect(context.focused).toContain('Total scenes: 2')
    expect(context.focused).toContain('1. Opening')
    expect(context.focused).toContain('2. Kitchen')
    expect(context.focused).toContain('Active board outline:')
  })
})
