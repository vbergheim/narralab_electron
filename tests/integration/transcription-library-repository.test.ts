import { describe, expect, it } from 'vitest'

import { createTestDatabase } from '../helpers/test-database'

describe('TranscriptionLibraryRepository', () => {
  it('preserves name and content when updating only sceneId', () => {
    const harness = createTestDatabase()

    try {
      const item = harness.transcriptions.createItem({
        name: 'Interview.wav',
        content: 'Original transcript',
        sourceFilePath: '/tmp/interview.wav',
      })
      const scene = harness.scenes.create()
      const updated = harness.transcriptions.updateItem({ id: item.id, sceneId: scene.id })

      expect(updated).toMatchObject({
        id: item.id,
        sceneId: scene.id,
        name: item.name,
        content: item.content,
        sourceFilePath: item.sourceFilePath,
      })
    } finally {
      harness.cleanup()
    }
  })

  it('preserves name, content, and linked scene when updating only folder', () => {
    const harness = createTestDatabase()

    try {
      const item = harness.transcriptions.createItem({
        name: 'Rushes.mov',
        content: 'Transcript body',
        sourceFilePath: '/tmp/rushes.mov',
      })
      const scene = harness.scenes.create()
      harness.transcriptions.updateItem({ id: item.id, sceneId: scene.id })

      const updated = harness.transcriptions.updateItem({ id: item.id, folder: 'Hai transkripsjoner' })

      expect(updated).toMatchObject({
        id: item.id,
        folder: 'Hai transkripsjoner',
        sceneId: scene.id,
        name: item.name,
        content: item.content,
      })
    } finally {
      harness.cleanup()
    }
  })

  it('preserves content when updating only name', () => {
    const harness = createTestDatabase()

    try {
      const item = harness.transcriptions.createItem({
        name: 'Untitled',
        content: 'Keep this transcript text',
      })

      const updated = harness.transcriptions.updateItem({ id: item.id, name: 'Interview day 2' })

      expect(updated).toMatchObject({
        id: item.id,
        name: 'Interview day 2',
        content: item.content,
      })
    } finally {
      harness.cleanup()
    }
  })

  it('preserves name when updating only content', () => {
    const harness = createTestDatabase()

    try {
      const item = harness.transcriptions.createItem({
        name: 'Scene notes',
        content: 'Old transcript',
      })

      const updated = harness.transcriptions.updateItem({
        id: item.id,
        content: 'New transcript body',
      })

      expect(updated).toMatchObject({
        id: item.id,
        name: item.name,
        content: 'New transcript body',
      })
    } finally {
      harness.cleanup()
    }
  })
})
