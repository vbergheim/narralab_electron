import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { createTestDatabase } from '../helpers/test-database'

describe('ArchiveRepository', () => {
  it('creates folder hierarchies and moves items back to root when deleting a branch', () => {
    const harness = createTestDatabase()

    try {
      const [parent] = harness.archive.createFolder('Research')
      const folders = harness.archive.createFolder('Interviews', parent.id)
      const child = folders.find((folder) => folder.parentId === parent.id)
      expect(child).toBeDefined()

      const filePath = path.join(harness.tempDir, 'notes.txt')
      fs.writeFileSync(filePath, 'archive test', 'utf8')
      const [item] = harness.archive.addFiles([filePath], child?.id ?? null)

      expect(item.exists).toBe(true)
      expect(item.kind).toBe('document')

      harness.archive.deleteFolder(parent.id)
      const remainingItems = harness.archive.listItems()
      const remainingFolders = harness.archive.listFolders()

      expect(remainingFolders).toEqual([])
      expect(remainingItems[0]?.folderId).toBeNull()
    } finally {
      harness.cleanup()
    }
  })
})
