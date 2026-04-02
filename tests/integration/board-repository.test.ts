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

  it('preserves board geometry and timestamps when cloning a board', () => {
    const harness = createTestDatabase()

    try {
      const board = harness.boards.ensureDefaultBoard()
      const scene = harness.scenes.create()
      const sceneItem = harness.boards.addScene(board.id, scene.id).item
      const textItem = harness.boards.addBlock(board.id, 'note')
      const updated = harness.boards.updateItem({
        id: textItem.id,
        title: 'Pinned note',
        body: 'Keep the geometry stable',
        color: 'amber',
        boardX: 640,
        boardY: 128,
        boardW: 420,
        boardH: 240,
      })

      const cloned = harness.boards.createClone(board.id, 'Clone')
      const clonedTextItem = cloned.items.find((item) => item.kind === 'note')
      const clonedSceneItem = cloned.items.find((item) => item.kind === 'scene')

      expect(cloned.items).toHaveLength(2)
      expect(clonedTextItem).toMatchObject({
        title: updated.title,
        body: updated.body,
        color: updated.color,
        boardX: updated.boardX,
        boardY: updated.boardY,
        boardW: updated.boardW,
        boardH: updated.boardH,
      })
      expect(clonedSceneItem).toMatchObject({
        sceneId: sceneItem.sceneId,
        boardX: sceneItem.boardX,
        boardY: sceneItem.boardY,
        boardW: sceneItem.boardW,
        boardH: sceneItem.boardH,
      })
      expect(cloned.items.every((item) => item.createdAt.includes('T'))).toBe(true)
      expect(cloned.items.every((item) => item.updatedAt.includes('T'))).toBe(true)
    } finally {
      harness.cleanup()
    }
  })

  it('rejects partial or duplicate board reorder payloads', () => {
    const harness = createTestDatabase()

    try {
      const board = harness.boards.ensureDefaultBoard()
      const scene = harness.scenes.create()
      const sceneItem = harness.boards.addScene(board.id, scene.id).item
      const block = harness.boards.addBlock(board.id, 'note')

      expect(() => harness.boards.reorder(board.id, [sceneItem.id])).toThrow(/invalid/i)
      expect(() => harness.boards.reorder(board.id, [sceneItem.id, sceneItem.id])).toThrow(/invalid/i)

      const reordered = harness.boards.reorder(board.id, [block.id, sceneItem.id])
      expect(reordered.map((item) => item.id)).toEqual([block.id, sceneItem.id])
      expect(reordered.map((item) => item.position)).toEqual([0, 1])
    } finally {
      harness.cleanup()
    }
  })
})
