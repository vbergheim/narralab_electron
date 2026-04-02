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
  boardX: number
  boardY: number
  boardW: number
  boardH: number
  createdAt: string
  updatedAt: string
}

type BoardRow = Omit<Board, 'items'>

export class BoardRepository {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  list(): Board[] {
    const boards = this.listBoardRows()
    const itemsByBoardId = this.listItemRows().reduce<Map<string, BoardItem[]>>((map, item) => {
      const current = map.get(item.boardId) ?? []
      current.push(mapBoardItemRow(item))
      map.set(item.boardId, current)
      return map
    }, new Map())

    return boards.map((board) => ({
      ...board,
      items: itemsByBoardId.get(board.id) ?? [],
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

    return this.getById(id)
  }

  createClone(boardId: string, name: string): Board {
    const source = this.getById(boardId)

    const nextBoard = this.create(name, { description: source.description, color: source.color, folder: source.folder })
    const insert = this.db.prepare(`
      INSERT INTO board_items (
        id, board_id, scene_id, kind, title, body, color, position, created_at, updated_at
        , board_x, board_y, board_w, board_h
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        item.boardX,
        item.boardY,
        item.boardW,
        item.boardH,
      )
    })

    this.touchBoard(nextBoard.id)
    return this.getById(nextBoard.id)
  }

  delete(boardId: string): Board[] {
    const boardIds = this.listBoardIds()
    if (boardIds.length <= 1) {
      throw new Error('At least one board must remain')
    }

    if (!boardIds.includes(boardId)) {
      return this.list()
    }

    this.db.prepare('DELETE FROM boards WHERE id = ?').run(boardId)
    const nextIds = this.listBoardIds()
    return this.reorderBoards(nextIds)
  }

  updateBoard(input: BoardUpdateInput): Board {
    const current = this.getById(input.id)

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

    return this.getById(input.id)
  }

  reorderBoards(boardIds: string[]): Board[] {
    const currentIds = this.listBoardIds()

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

  addScene(boardId: string, sceneId: string, afterItemId?: string | null, boardPosition?: { x: number; y: number } | null): AddSceneToBoardResult {
    const existing = this.db
      .prepare('SELECT id FROM board_items WHERE board_id = ? AND kind = ? AND scene_id = ?')
      .get(boardId, 'scene', sceneId) as { id: string } | undefined

    if (existing) {
      const item = this.getItemById(existing.id) as BoardSceneItem

      return { item, existed: true }
    }

    const position = this.resolveInsertPosition(boardId, afterItemId)

    const item: BoardSceneItem = {
      id: createId('item'),
      boardId,
      kind: 'scene',
      sceneId,
      position,
      boardX: boardPosition?.x ?? position * 320,
      boardY: boardPosition?.y ?? 0,
      boardW: 300,
      boardH: 132,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }

    this.shiftItemsAtOrAfter(boardId, position)

    this.db
      .prepare(`
        INSERT INTO board_items (
          id, board_id, scene_id, kind, title, body, color, position, board_x, board_y, board_w, board_h, created_at, updated_at
        ) VALUES (
          @id, @boardId, @sceneId, @kind, '', '', 'charcoal', @position, @boardX, @boardY, @boardW, @boardH, @createdAt, @updatedAt
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
      boardX: position * 320,
      boardY: 0,
      boardW: 260,
      boardH: 108,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }

    this.shiftItemsAtOrAfter(boardId, position)

    this.db
      .prepare(`
        INSERT INTO board_items (
          id, board_id, scene_id, kind, title, body, color, position, board_x, board_y, board_w, board_h, created_at, updated_at
        ) VALUES (
          @id, @boardId, NULL, @kind, @title, @body, @color, @position, @boardX, @boardY, @boardW, @boardH, @createdAt, @updatedAt
        )
      `)
      .run(item)

    this.touchBoard(boardId)
    return item
  }

  duplicateItem(itemId: string): BoardItem {
    const current = this.getItemById(itemId)

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
          id, board_id, scene_id, kind, title, body, color, position, board_x, board_y, board_w, board_h, created_at, updated_at
        ) VALUES (
          @id, @boardId, NULL, @kind, @title, @body, @color, @position, @boardX, @boardY, @boardW, @boardH, @createdAt, @updatedAt
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
    const currentItems = this.getItemsByBoardId(boardId)
    const currentIds = currentItems.map((item) => item.id)
    const uniqueIds = new Set(itemIds)

    if (
      currentItems.length !== itemIds.length ||
      uniqueIds.size !== itemIds.length ||
      itemIds.some((itemId) => !currentIds.includes(itemId))
    ) {
      throw new Error('Board item order is invalid')
    }

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
    return this.getItemsByBoardId(boardId)
  }

  updateItem(input: BoardItemUpdateInput): BoardItem {
    const current = this.getItemById(input.id)

    if (current.kind === 'scene') {
      const next: BoardSceneItem = {
        ...current,
        boardX: input.boardX ?? current.boardX,
        boardY: input.boardY ?? current.boardY,
        boardW: input.boardW ?? current.boardW,
        boardH: input.boardH ?? current.boardH,
        updatedAt: nowIso(),
      }

      this.db
        .prepare(`
          UPDATE board_items
          SET board_x = ?, board_y = ?, board_w = ?, board_h = ?, updated_at = ?
          WHERE id = ?
        `)
        .run(next.boardX, next.boardY, next.boardW, next.boardH, next.updatedAt, next.id)

      this.touchBoard(next.boardId)
      return next
    }

    const next: BoardTextItem = {
      ...current,
      kind: input.kind ?? current.kind,
      title: input.title ?? current.title,
      body: input.body ?? current.body,
      color: getBlockDefaults(input.kind ?? current.kind).defaultColor,
      boardX: input.boardX ?? current.boardX,
      boardY: input.boardY ?? current.boardY,
      boardW: input.boardW ?? current.boardW,
      boardH: input.boardH ?? current.boardH,
      updatedAt: nowIso(),
    }

    this.db
      .prepare(`
        UPDATE board_items
        SET kind = ?, title = ?, body = ?, color = ?, board_x = ?, board_y = ?, board_w = ?, board_h = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        next.kind,
        next.title,
        next.body,
        next.color,
        next.boardX,
        next.boardY,
        next.boardW,
        next.boardH,
        next.updatedAt,
        next.id,
      )

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

  private getById(id: string): Board {
    const board = this.listBoardRows().find((entry) => entry.id === id)
    if (!board) {
      throw new Error('Board not found')
    }

    return {
      ...board,
      items: this.getItemsByBoardId(id),
    }
  }

  private getItemById(id: string): BoardItem {
    const row = this.db
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
          board_x AS boardX,
          board_y AS boardY,
          board_w AS boardW,
          board_h AS boardH,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM board_items
        WHERE id = ?
      `)
      .get(id) as BoardItemRow | undefined

    if (!row) {
      throw new Error('Board item not found')
    }

    return mapBoardItemRow(row)
  }

  private getItemsByBoardId(boardId: string) {
    return this.db
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
          board_x AS boardX,
          board_y AS boardY,
          board_w AS boardW,
          board_h AS boardH,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM board_items
        WHERE board_id = ?
        ORDER BY position ASC
      `)
      .all(boardId)
      .map((row) => mapBoardItemRow(row as BoardItemRow))
  }

  private listBoardIds() {
    return this.db
      .prepare('SELECT id FROM boards ORDER BY sort_order ASC, created_at ASC')
      .all()
      .map((row) => (row as { id: string }).id)
  }

  private listBoardRows() {
    return this.db
      .prepare(`
        SELECT id, name, created_at AS createdAt, updated_at AS updatedAt
             , description, color, folder, sort_order AS sortOrder
        FROM boards
        ORDER BY sort_order ASC, created_at ASC
      `)
      .all() as BoardRow[]
  }

  private listItemRows() {
    return this.db
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
          board_x AS boardX,
          board_y AS boardY,
          board_w AS boardW,
          board_h AS boardH,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM board_items
        ORDER BY board_id ASC, position ASC
      `)
      .all() as BoardItemRow[]
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
      boardX: row.boardX,
      boardY: row.boardY,
      boardW: row.boardW,
      boardH: row.boardH,
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
    boardX: row.boardX,
    boardY: row.boardY,
    boardW: row.boardW,
    boardH: row.boardH,
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
