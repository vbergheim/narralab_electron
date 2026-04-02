import { describe, expect, it } from 'vitest'

import { ProjectMetadataRepository } from '../../electron/main/db/repositories/project-metadata-repository'
import { NotebookService } from '../../electron/main/notebook-service'
import { createTestDatabase } from '../helpers/test-database'

describe('NotebookService', () => {
  it('migrates legacy notebook content and clears it on structured update', () => {
    const harness = createTestDatabase()

    try {
      harness.db
        .prepare(`
          INSERT INTO app_meta (key, value)
          VALUES (?, ?), (?, ?)
        `)
        .run(
          'project_notebook',
          'Legacy line one\nLegacy line two',
          'project_notebook_updated_at',
          '2026-04-02T10:00:00.000Z',
        )

      const service = new NotebookService(new ProjectMetadataRepository(harness.db))
      const migrated = service.get()

      expect(migrated.tabs[0]?.contentHtml).toContain('<p>Legacy line one</p>')

      const updated = service.update({
        ...migrated,
        tabs: migrated.tabs.map((tab) =>
          tab.id === migrated.activeTabId ? { ...tab, contentHtml: '<p>Structured</p>' } : tab,
        ),
      })

      expect(updated.tabs[0]?.contentHtml).toBe('<p>Structured</p>')
      expect(
        harness.db.prepare('SELECT value FROM app_meta WHERE key = ?').get('project_notebook'),
      ).toBeUndefined()
    } finally {
      harness.cleanup()
    }
  })

  it('appends plaintext as html paragraphs to the active tab', () => {
    const harness = createTestDatabase()

    try {
      const service = new NotebookService(new ProjectMetadataRepository(harness.db))
      const updated = service.appendPlainText('First line\nSecond line')

      expect(updated.tabs[0]?.contentHtml).toContain('<p>First line</p>')
      expect(updated.tabs[0]?.contentHtml).toContain('<p>Second line</p>')
      expect(updated.updatedAt).toContain('T')
    } finally {
      harness.cleanup()
    }
  })
})
