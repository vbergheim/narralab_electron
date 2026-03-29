import type Database from 'better-sqlite3'

import { boardBlockKinds } from '@/lib/constants'
import type {
  AddSceneToBoardResult,
  Board,
  BoardItem,
  BoardItemKind,
  BoardItemUpdateInput,
  BoardUpdateInput,
  BoardSceneItem,
  BoardTextItem,
  BoardTextItemKind,
} from '@/types/board'
import type { SceneColor } from '@/types/scene'

import { createId, nowIso } from './helpers'

type BoardItemRow = {
  id: string
  boardId: string
  sceneId: string | null
  kind: BoardItemKind
  title: string
  body: string
  color: string
  position: number
  createdAt: string
  updatedAt: string
}

export class BoardRepository {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  list(): Board[] {
    const boards = this.db
      .prepare(`
        SELECT id, name, created_at AS createdAt, updated_at AS updatedAt
             , description, color, folder, sort_order AS sortOrder
        FROM boards
        ORDER BY sort_order ASC, created_at ASC
      `)
      .all() as Array<Omit<Board, 'items'>>

    const items = this.db
      .prepare(`
        SELECT
          id,
          board_id AS boardId,
          scene_id AS sceneId,
          kind,
          title,
          body,
          color,
          position,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM board_items
        ORDER BY board_id ASC, position ASC
      `)
      .all() as BoardItemRow[]

    return boards.map((board) => ({
      ...board,
      items: items.filter((item) => item.boardId === board.id).map(mapBoardItemRow),
    }))
  }

  ensureDefaultBoard(): Board {
    const existing = this.list()
    return existing.length > 0 ? existing[0] : this.create('Main Outline')
  }

  create(name: string, options?: { description?: string; color?: SceneColor; folder?: string }): Board {
    const id = createId('board')
    const timestamp = nowIso()
    const sortOrder =
      ((this.db
        .prepare('SELECT COALESCE(MAX(sort_order), -1) AS maxSortOrder FROM boards')
        .get() as { maxSortOrder: number }).maxSortOrder ?? -1) + 1

    this.db
      .prepare('INSERT INTO boards (id, name, description, color, folder, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, options?.description ?? '', options?.color ?? 'charcoal', options?.folder ?? '', sortOrder, timestamp, timestamp)

    return this.list().find((board) => board.id === id) as Board
  }

  createClone(boardId: string, name: string): Board {
    const source = this.list().find((board) => board.id === boardId)
    if (!source) throw new Error('Board not found')

    const nextBoard = this.create(name, { description: source.description, color: source.color, folder: source.folder })
    const insert = this.db.prepare(`
      INSERT INTO board_items (
        id, board_id, scene_id, kind, title, body, color, position, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    source.items.forEach((item, index) => {
      const timestamp = nowIso()
      insert.run(
        createId('item'),
        nextBoard.id,
        item.kind === 'scene' ? item.sceneId : null,
        item.kind,
        item.kind === 'scene' ? '' : item.title,
        item.kind === 'scene' ? '' : item.body,
        item.kind === 'scene' ? 'charcoal' : item.color,
        index,
        timestamp,
        timestamp,
      )
    })

    this.touchBoard(nextBoard.id)
    return this.list().find((board) => board.id === nextBoard.id) as Board
  }

  delete(boardId: string): Board[] {
    const boards = this.list()
    if (boards.length <= 1) {
      throw new Error('At least one board must remain')
    }

    const existing = boards.find((board) => board.id === boardId)
    if (!existing) {
      return boards
    }

    this.db.prepare('DELETE FROM boards WHERE id = ?').run(boardId)
    const nextBoards = this.list()
    this.reorderBoards(nextBoards.map((board) => board.id))
    return this.list()
  }

  updateBoard(input: BoardUpdateInput): Board {
    const current = this.list().find((board) => board.id === input.id)
    if (!current) {
      throw new Error('Board not found')
    }

    const nextName = input.name?.trim() ?? current.name
    const nextDescription = input.description ?? current.description
    const nextColor = input.color ?? current.color
    const nextFolder = input.folder?.trim() ?? current.folder

    if (!nextName) {
      throw new Error('Board name cannot be empty')
    }

    this.db
      .prepare('UPDATE boards SET name = ?, description = ?, color = ?, folder = ?, updated_at = ? WHERE id = ?')
      .run(nextName, nextDescription, nextColor, nextFolder, nowIso(), input.id)

    const updated = this.list().find((board) => board.id === input.id)
    if (!updated) {
      throw new Error('Board not found')
    }

    return updated
  }

  reorderBoards(boardIds: string[]): Board[] {
    const currentBoards = this.list()
    const currentIds = currentBoards.map((board) => board.id)

    if (boardIds.length !== currentIds.length || boardIds.some((id) => !currentIds.includes(id))) {
      throw new Error('Board order is invalid')
    }

    const update = this.db.prepare('UPDATE boards SET sort_order = ?, updated_at = ? WHERE id = ?')
    const timestamp = nowIso()
    const reorder = this.db.transaction((ids: string[]) => {
      ids.forEach((id, index) => {
        update.run(index, timestamp, id)
      })
    })

    reorder(boardIds)
    return this.list()
  }

  addScene(boardId: string, sceneId: string, afterItemId?: string | null): AddSceneToBoardResult {
    const existing = this.db
      .prepare('SELECT id FROM board_items WHERE board_id = ? AND kind = ? AND scene_id = ?')
      .get(boardId, 'scene', sceneId) as { id: string } | undefined

    if (existing) {
      const item = this.list()
        .flatMap((board) => board.items)
        .find((entry) => entry.id === existing.id) as BoardSceneItem

      return { item, existed: true }
    }

    const position = this.resolveInsertPosition(boardId, afterItemId)

    const item: BoardSceneItem = {
      id: createId('item'),
      boardId,
      kind: 'scene',
      sceneId,
      position,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }

    this.shiftItemsAtOrAfter(boardId, position)

    this.db
      .prepare(`
        INSERT INTO board_items (
          id, board_id, scene_id, kind, title, body, color, position, created_at, updated_at
        ) VALUES (
          @id, @boardId, @sceneId, @kind, '', '', 'charcoal', @position, @createdAt, @updatedAt
        )
      `)
      .run(item)

    this.touchBoard(boardId)
    return { item, existed: false }
  }

  addBlock(boardId: string, kind: BoardTextItemKind, afterItemId?: string | null): BoardTextItem {
    const defaults = getBlockDefaults(kind)
    const position = this.resolveInsertPosition(boardId, afterItemId)

    const item: BoardTextItem = {
      id: createId('item'),
      boardId,
      kind,
      title: defaults.defaultTitle,
      body: defaults.defaultBody,
      color: defaults.defaultColor,
      position,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }

    this.shiftItemsAtOrAfter(boardId, position)

    this.db
      .prepare(`
        INSERT INTO board_items (
          id, board_id, scene_id, kind, title, body, color, position, created_at, updated_at
        ) VALUES (
          @id, @boardId, NULL, @kind, @title, @body, @color, @position, @createdAt, @updatedAt
        )
      `)
      .run(item)

    this.touchBoard(boardId)
    return item
  }

  duplicateItem(itemId: string): BoardItem {
    const current = this.list()
      .flatMap((board) => board.items)
      .find((item) => item.id === itemId)

    if (!current) {
      throw new Error('Board item not found')
    }

    if (current.kind === 'scene') {
      throw new Error('Scene rows must be duplicated as scenes')
    }

    const position = this.resolveInsertPosition(current.boardId, current.id)
    const item: BoardTextItem = {
      ...current,
      id: createId('item'),
      position,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }

    this.shiftItemsAtOrAfter(current.boardId, position)
    this.db
      .prepare(`
        INSERT INTO board_items (
          id, board_id, scene_id, kind, title, body, color, position, created_at, updated_at
        ) VALUES (
          @id, @boardId, NULL, @kind, @title, @body, @color, @position, @createdAt, @updatedAt
        )
      `)
      .run(item)

    this.touchBoard(current.boardId)
    return item
  }

  removeItem(itemId: string) {
    const current = this.db
      .prepare('SELECT board_id AS boardId FROM board_items WHERE id = ?')
      .get(itemId) as { boardId: string } | undefined

    if (!current) return

    this.db.prepare('DELETE FROM board_items WHERE id = ?').run(itemId)
    this.reindexBoard(current.boardId)
    this.touchBoard(current.boardId)
  }

  reorder(boardId: string, itemIds: string[]): BoardItem[] {
    const update = this.db.prepare(`
      UPDATE board_items
      SET position = ?, updated_at = ?
      WHERE id = ? AND board_id = ?
    `)

    const reorder = this.db.transaction((ids: string[]) => {
      ids.forEach((itemId, index) => {
        update.run(index, nowIso(), itemId, boardId)
      })
    })

    reorder(itemIds)
    this.touchBoard(boardId)
    return this.list().find((board) => board.id === boardId)?.items ?? []
  }

  updateItem(input: BoardItemUpdateInput): BoardItem {
    const current = this.list()
      .flatMap((board) => board.items)
      .find((item) => item.id === input.id)

    if (!current) {
      throw new Error('Board item not found')
    }

    if (current.kind === 'scene') {
      return current
    }

    const next: BoardTextItem = {
      ...current,
      kind: input.kind ?? current.kind,
      title: input.title ?? current.title,
      body: input.body ?? current.body,
      color: getBlockDefaults(input.kind ?? current.kind).defaultColor,
      updatedAt: nowIso(),
    }

    this.db
      .prepare(`
        UPDATE board_items
        SET kind = ?, title = ?, body = ?, color = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(next.kind, next.title, next.body, next.color, next.updatedAt, next.id)

    this.touchBoard(next.boardId)
    return next
  }

  private reindexBoard(boardId: string) {
    const ids = this.db
      .prepare('SELECT id FROM board_items WHERE board_id = ? ORDER BY position ASC')
      .all(boardId) as Array<{ id: string }>

    const update = this.db.prepare('UPDATE board_items SET position = ?, updated_at = ? WHERE id = ?')
    ids.forEach((item, index) => {
      update.run(index, nowIso(), item.id)
    })
  }

  private touchBoard(boardId: string) {
    this.db.prepare('UPDATE boards SET updated_at = ? WHERE id = ?').run(nowIso(), boardId)
  }

  private resolveInsertPosition(boardId: string, afterItemId?: string | null) {
    if (afterItemId) {
      const anchor = this.db
        .prepare('SELECT position FROM board_items WHERE id = ? AND board_id = ?')
        .get(afterItemId, boardId) as { position: number } | undefined

      if (anchor) {
        return anchor.position + 1
      }
    }

    const maxPosition = this.db
      .prepare('SELECT COALESCE(MAX(position), -1) AS maxPosition FROM board_items WHERE board_id = ?')
      .get(boardId) as { maxPosition: number }

    return maxPosition.maxPosition + 1
  }

  private shiftItemsAtOrAfter(boardId: string, position: number) {
    this.db
      .prepare(`
        UPDATE board_items
        SET position = position + 1, updated_at = ?
        WHERE board_id = ? AND position >= ?
      `)
      .run(nowIso(), boardId, position)
  }
}

function mapBoardItemRow(row: BoardItemRow): BoardItem {
  if (row.kind === 'scene' && row.sceneId) {
    return {
      id: row.id,
      boardId: row.boardId,
      kind: 'scene',
      sceneId: row.sceneId,
      position: row.position,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
  }

  return {
    id: row.id,
    boardId: row.boardId,
    kind: row.kind === 'scene' ? 'note' : row.kind,
    title: row.title,
    body: row.body,
    color: row.color as BoardTextItem['color'],
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function getBlockDefaults(kind: BoardTextItemKind) {
  return boardBlockKinds.find((item) => item.value === kind) ?? boardBlockKinds[0]
}

export function isBoardColor(value: string): value is SceneColor {
  return sceneColors.has(value as SceneColor)
}

const sceneColors = new Set<SceneColor>([
  'charcoal',
  'slate',
  'amber',
  'ochre',
  'crimson',
  'rose',
  'olive',
  'moss',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'plum',
])
