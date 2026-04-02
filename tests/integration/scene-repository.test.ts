import { describe, expect, it } from 'vitest'

import { createTestDatabase } from '../helpers/test-database'

describe('SceneRepository', () => {
  it('creates, reorders, and deletes beats while keeping sort order stable', () => {
    const harness = createTestDatabase()

    try {
      const scene = harness.scenes.create()
      const beatA = harness.scenes.createBeat(scene.id)
      const beatB = harness.scenes.createBeat(scene.id, beatA.id)
      const beatC = harness.scenes.createBeat(scene.id, beatB.id)

      harness.scenes.updateBeat({ id: beatA.id, text: 'Intro beat' })
      harness.scenes.reorderBeats(scene.id, [beatC.id, beatA.id, beatB.id])

      let beats = harness.scenes.getById(scene.id).beats
      expect(beats.map((beat) => beat.id)).toEqual([beatC.id, beatA.id, beatB.id])
      expect(beats.map((beat) => beat.sortOrder)).toEqual([0, 1, 2])

      harness.scenes.deleteBeat(beatA.id)
      beats = harness.scenes.getById(scene.id).beats

      expect(beats.map((beat) => beat.id)).toEqual([beatC.id, beatB.id])
      expect(beats.map((beat) => beat.sortOrder)).toEqual([0, 1])
      expect(harness.scenes.getById(scene.id).beats[0]?.text).toBe('')
    } finally {
      harness.cleanup()
    }
  })

  it('keeps scene sort order sequential after reorder', () => {
    const harness = createTestDatabase()

    try {
      const first = harness.scenes.create()
      const second = harness.scenes.create()
      const third = harness.scenes.create()

      const reordered = harness.scenes.reorder([third.id, first.id])
      expect(reordered.map((scene) => scene.id)).toEqual([third.id, first.id, second.id])
      expect(reordered.map((scene) => scene.sortOrder)).toEqual([0, 1, 2])
    } finally {
      harness.cleanup()
    }
  })

  it('roundtrips quote moment, quality, source paths, tags and beats', () => {
    const harness = createTestDatabase()

    try {
      const scene = harness.scenes.create()
      const beat = harness.scenes.createBeat(scene.id)
      harness.scenes.updateBeat({ id: beat.id, text: 'Opening moment' })
      harness.db.prepare('INSERT INTO tags (id, name, type) VALUES (?, ?, ?)').run('tag_truth', 'Truth', 'general')
      harness.db.prepare('INSERT INTO tags (id, name, type) VALUES (?, ?, ?)').run('tag_archive', 'Archive', 'general')

      const updated = harness.scenes.update({
        id: scene.id,
        title: 'Kitchen reset',
        quoteMoment: 'She stops talking when the room goes quiet.',
        quality: 'Strong',
        sourceReference: 'shoot-log.xlsx',
        sourcePaths: ['shoot-log.xlsx', 'archive/day-01/audio'],
        tagIds: ['tag_truth', 'tag_archive'],
      })

      const reloaded = harness.scenes.getById(scene.id)

      expect(updated.quoteMoment).toBe('She stops talking when the room goes quiet.')
      expect(updated.quality).toBe('Strong')
      expect(updated.sourceReference).toBe('shoot-log.xlsx')
      expect(updated.sourcePaths).toEqual(['shoot-log.xlsx', 'archive/day-01/audio'])
      expect(updated.tagIds).toEqual(['tag_truth', 'tag_archive'])
      expect(reloaded.quoteMoment).toBe(updated.quoteMoment)
      expect(reloaded.quality).toBe(updated.quality)
      expect(reloaded.sourceReference).toBe(updated.sourceReference)
      expect(reloaded.sourcePaths).toEqual(updated.sourcePaths)
      expect(reloaded.tagIds).toEqual(updated.tagIds)
      expect(reloaded.beats.map((entry) => entry.text)).toEqual(['Opening moment'])
    } finally {
      harness.cleanup()
    }
  })
})
