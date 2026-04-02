import { describe, expect, it } from 'vitest'

import { ProjectMetadataRepository, NOTEBOOK_META_KEY } from '../../electron/main/db/repositories/project-metadata-repository'
import { createTestDatabase } from '../helpers/test-database'

describe('ProjectMetadataRepository', () => {
  it('round-trips metadata blobs through app_meta keys', () => {
    const harness = createTestDatabase()

    try {
      const metadata = new ProjectMetadataRepository(harness.db)
      const boardFolders = JSON.stringify([{ path: 'Act 1', color: 'slate', sortOrder: 0 }])
      const sceneFolders = JSON.stringify([{ path: 'Scenes/Open', color: 'amber', sortOrder: 0 }])
      const transcriptionFolders = JSON.stringify([{ path: 'Interviews', color: 'sage', sortOrder: 0 }])
      const blockTemplates = JSON.stringify([{ id: 'template_1', kind: 'note', name: 'Prompt', title: 'Prompt', body: '', createdAt: '2026-04-02T10:00:00.000Z', updatedAt: '2026-04-02T10:00:00.000Z' }])

      metadata.setBoardFolders(boardFolders)
      metadata.setSceneFolders(sceneFolders)
      metadata.setTranscriptionFolders(transcriptionFolders)
      metadata.setBlockTemplates(blockTemplates)

      expect(metadata.getBoardFolders()).toBe(boardFolders)
      expect(metadata.getSceneFolders()).toBe(sceneFolders)
      expect(metadata.getTranscriptionFolders()).toBe(transcriptionFolders)
      expect(metadata.getBlockTemplates()).toBe(blockTemplates)
    } finally {
      harness.cleanup()
    }
  })

  it('stores notebook JSON and clears legacy notebook keys', () => {
    const harness = createTestDatabase()

    try {
      const metadata = new ProjectMetadataRepository(harness.db)
      const legacyInsert = harness.db.prepare(`
        INSERT INTO app_meta (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)

      legacyInsert.run('project_notebook', 'Legacy notes')
      legacyInsert.run('project_notebook_updated_at', '2026-04-02T10:00:00.000Z')

      const notebook = JSON.stringify({
        tabs: [{ id: 'tab_1', title: 'Notes', contentHtml: '<p>Fresh notes</p>', updatedAt: '2026-04-02T10:05:00.000Z' }],
        activeTabId: 'tab_1',
        updatedAt: '2026-04-02T10:05:00.000Z',
      })

      metadata.setNotebook(notebook)

      expect(metadata.getNotebook()).toBe(notebook)
      expect(metadata.getLegacyNotebook()).toEqual({ content: '', updatedAt: null })
      expect(
        harness.db.prepare('SELECT value FROM app_meta WHERE key = ?').get(NOTEBOOK_META_KEY),
      ).toEqual({ value: notebook })
    } finally {
      harness.cleanup()
    }
  })
})
