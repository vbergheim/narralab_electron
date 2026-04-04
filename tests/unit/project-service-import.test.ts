import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => (name === 'temp' ? os.tmpdir() : os.tmpdir()),
    getVersion: () => 'test',
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  shell: {
    openPath: vi.fn(),
    showItemInFolder: vi.fn(),
  },
}))

import { ProjectService } from '../../electron/main/project-service'

describe('ProjectService importJson', () => {
  it('imports tagged scenes without violating foreign key order', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'narralab-import-'))
    const projectPath = path.join(tempDir, 'project.narralab')
    const importPath = path.join(tempDir, 'snapshot.json')
    const service = new ProjectService()

    const snapshot = {
      version: 7,
      scenes: [
        {
          id: 'scene_1',
          sortOrder: 0,
          title: 'Tagged scene',
          synopsis: '',
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
          keyRating: false,
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
          tagIds: ['tag_1'],
          beats: [],
          createdAt: '2026-04-02T10:00:00.000Z',
          updatedAt: '2026-04-02T10:00:00.000Z',
        },
      ],
      tags: [{ id: 'tag_1', name: 'Archive', type: 'general' }],
      boards: [],
      notebook: { tabs: [], activeTabId: null, updatedAt: null },
      projectSettings: {
        title: '',
        genre: '',
        format: '',
        targetRuntimeMinutes: 90,
        logline: '',
        defaultBoardView: 'outline',
        enabledBlockKinds: ['chapter', 'voiceover', 'narration', 'text-card', 'note'],
        blockKindOrder: ['chapter', 'voiceover', 'narration', 'text-card', 'note'],
      },
    }

    try {
      await service.createProject(projectPath)
      fs.writeFileSync(importPath, JSON.stringify(snapshot), 'utf8')

      const meta = await service.importJson(importPath)
      expect(meta?.path).toBe(projectPath)
      expect(service.listScenes()[0]?.tagIds).toEqual(['tag_1'])
      expect(service.listTags()[0]).toMatchObject({ id: 'tag_1', name: 'Archive' })
    } finally {
      service.close()
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
