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

  it('creates folders with the requested color', () => {
    const harness = createTestDatabase()

    try {
      const folders = harness.archive.createFolder('Rushes', null, 'teal')
      expect(folders.find((folder) => folder.name === 'Rushes')?.color).toBe('teal')
    } finally {
      harness.cleanup()
    }
  })

  it('moves archive items into folders via partial updates', () => {
    const harness = createTestDatabase()

    try {
      const [folder] = harness.archive.createFolder('Selects')
      const filePath = path.join(harness.tempDir, 'clip.txt')
      fs.writeFileSync(filePath, 'clip', 'utf8')
      const [item] = harness.archive.addFiles([filePath], null)

      const updated = harness.archive.updateItem({ id: item.id, folderId: folder.id })

      expect(updated.folderId).toBe(folder.id)
      expect(updated.name).toBe(item.name)
      expect(updated.filePath).toBe(item.filePath)
    } finally {
      harness.cleanup()
    }
  })
})
