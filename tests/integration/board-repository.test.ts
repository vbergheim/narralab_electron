import { describe, expect, it } from 'vitest'

import { createTestDatabase } from '../helpers/test-database'

describe('BoardRepository', () => {
  it('adds scenes and blocks at deterministic positions and avoids duplicate scene rows', () => {
    const harness = createTestDatabase()

    try {
      const board = harness.boards.ensureDefaultBoard()
      const firstScene = harness.scenes.create()
      const secondScene = harness.scenes.create()

      const firstAdd = harness.boards.addScene(board.id, firstScene.id)
      const secondAdd = harness.boards.addScene(board.id, secondScene.id, firstAdd.item.id)
      const duplicateAdd = harness.boards.addScene(board.id, firstScene.id)
      const block = harness.boards.addBlock(board.id, 'chapter', firstAdd.item.id)

      const items = harness.boards.list().find((entry) => entry.id === board.id)?.items ?? []

      expect(firstAdd.existed).toBe(false)
      expect(secondAdd.existed).toBe(false)
      expect(duplicateAdd.existed).toBe(true)
      expect(items.map((item) => item.position)).toEqual([0, 1, 2])
      expect(items[1]?.id).toBe(block.id)
      expect(items.filter((item) => item.kind === 'scene')).toHaveLength(2)
    } finally {
      harness.cleanup()
    }
  })

  it('reindexes positions after removing items', () => {
    const harness = createTestDatabase()

    try {
      const board = harness.boards.ensureDefaultBoard()
      const scene = harness.scenes.create()
      const sceneItem = harness.boards.addScene(board.id, scene.id).item
      const blockA = harness.boards.addBlock(board.id, 'note')
      const blockB = harness.boards.addBlock(board.id, 'text-card')

      harness.boards.removeItem(blockA.id)
      const items = harness.boards.list().find((entry) => entry.id === board.id)?.items ?? []

      expect(items.map((item) => item.id)).toEqual([sceneItem.id, blockB.id])
      expect(items.map((item) => item.position)).toEqual([0, 1])
    } finally {
      harness.cleanup()
    }
  })
})
