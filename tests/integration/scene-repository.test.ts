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
})
