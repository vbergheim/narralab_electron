import fs from 'node:fs'
import path from 'node:path'

import { app, dialog } from 'electron'

import type {
  AddSceneToBoardResult,
  Board,
  BoardItem,
  BoardItemUpdateInput,
  BoardTextItem,
  BoardTextItemKind,
} from '@/types/board'
import type {
  NotebookDocument,
  ProjectMeta,
  ProjectSnapshot,
  ProjectSnapshotV1,
  ProjectSnapshotV3,
} from '@/types/project'
import type { Scene, SceneUpdateInput } from '@/types/scene'
import type { Tag, TagType } from '@/types/tag'

import { openProjectDatabase, type ProjectDatabase } from './db/connection'
import { BoardRepository } from './db/repositories/board-repository'
import { SceneRepository } from './db/repositories/scene-repository'
import { TagRepository } from './db/repositories/tag-repository'

type Repositories = {
  scenes: SceneRepository
  boards: BoardRepository
  tags: TagRepository
}

export class ProjectService {
  private db: ProjectDatabase | null = null
  private repositories: Repositories | null = null
  private currentPath: string | null = null

  async createProject(requestedPath?: string | null) {
    const filePath = normalizeProjectFilePath(requestedPath ?? (await this.pickSavePath('Create Project')))
    if (!filePath) return null

    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath)
    }

    this.openAtPath(filePath)
    this.repositories?.boards.ensureDefaultBoard()
    return this.getMeta()
  }

  async openProject(requestedPath?: string | null) {
    const filePath = requestedPath ?? (await this.pickOpenProjectPath())
    if (!filePath) return null

    this.openAtPath(filePath)
    this.repositories?.boards.ensureDefaultBoard()
    return this.getMeta()
  }

  async saveProjectAs(requestedPath?: string | null) {
    if (!this.currentPath) {
      throw new Error('Open a project before using Save As')
    }

    const previousPath = this.currentPath
    const nextPath = normalizeProjectFilePath(requestedPath ?? (await this.pickSavePath('Save Project As')))
    if (!nextPath) return null

    this.close()
    fs.copyFileSync(previousPath, nextPath)
    this.openAtPath(nextPath)
    return this.getMeta()
  }

  async exportJson(requestedPath?: string | null) {
    const targetPath =
      requestedPath ??
      (await dialog.showSaveDialog({
        title: 'Export JSON',
        defaultPath: this.getMeta() ? `${this.getMeta()?.name}.json` : 'docudoc-export.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      }).then((result) => (result.canceled ? null : result.filePath)))

    if (!targetPath) return null

    const snapshot = this.getSnapshot()
    fs.writeFileSync(targetPath, JSON.stringify(snapshot, null, 2), 'utf8')
    return targetPath
  }

  async importJson(requestedPath?: string | null) {
    // TODO: Reuse this import path when CSV/Excel support is added.
    const sourcePath =
      requestedPath ??
      (await dialog.showOpenDialog({
        title: 'Import JSON',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      }).then((result) => (result.canceled ? null : result.filePaths[0] ?? null)))

    if (!sourcePath) return null

    const snapshot = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as ProjectSnapshot
    this.replaceWithSnapshot(snapshot)
    return this.getMeta()
  }

  getMeta(): ProjectMeta | null {
    if (!this.currentPath) return null

    return {
      path: this.currentPath,
      name: toProjectDisplayName(this.currentPath),
    }
  }

  listScenes(): Scene[] {
    return this.ensureRepositories().scenes.list()
  }

  createScene(): Scene {
    return this.ensureRepositories().scenes.create()
  }

  updateScene(input: SceneUpdateInput): Scene {
    return this.ensureRepositories().scenes.update(input)
  }

  deleteScene(id: string) {
    this.ensureRepositories().scenes.delete(id)
  }

  listTags(): Tag[] {
    return this.ensureRepositories().tags.list()
  }

  upsertTag(input: { id?: string; name: string; type?: TagType }): Tag {
    return this.ensureRepositories().tags.upsert(input)
  }

  deleteTag(id: string) {
    this.ensureRepositories().tags.delete(id)
  }

  listBoards(): Board[] {
    const boards = this.ensureRepositories().boards.list()
    if (boards.length > 0) return boards
    return [this.ensureRepositories().boards.ensureDefaultBoard()]
  }

  createBoardClone(sourceBoardId: string, name?: string): Board {
    const source = this.listBoards().find((board) => board.id === sourceBoardId)
    return this.ensureRepositories().boards.createClone(
      sourceBoardId,
      name?.trim() || `${source?.name ?? 'Board'} copy`,
    )
  }

  updateBoard(boardId: string, name: string): Board {
    return this.ensureRepositories().boards.updateBoard(boardId, name)
  }

  addSceneToBoard(boardId: string, sceneId: string, afterItemId?: string | null): AddSceneToBoardResult {
    return this.ensureRepositories().boards.addScene(boardId, sceneId, afterItemId)
  }

  addBlockToBoard(boardId: string, kind: BoardTextItemKind, afterItemId?: string | null): BoardTextItem {
    return this.ensureRepositories().boards.addBlock(boardId, kind, afterItemId)
  }

  duplicateBoardItem(itemId: string): BoardItem {
    return this.ensureRepositories().boards.duplicateItem(itemId)
  }

  removeBoardItem(itemId: string) {
    this.ensureRepositories().boards.removeItem(itemId)
  }

  reorderBoard(boardId: string, itemIds: string[]): BoardItem[] {
    return this.ensureRepositories().boards.reorder(boardId, itemIds)
  }

  updateBoardItem(input: BoardItemUpdateInput): BoardItem {
    return this.ensureRepositories().boards.updateItem(input)
  }

  getSnapshot(): ProjectSnapshotV3 {
    return {
      schemaVersion: 3,
      exportedAt: new Date().toISOString(),
      project: this.getMeta(),
      scenes: this.listScenes(),
      tags: this.listTags(),
      boards: this.listBoards(),
      notebook: this.getNotebook(),
    }
  }

  close() {
    this.db?.close()
    this.db = null
    this.repositories = null
    this.currentPath = null
  }

  private openAtPath(filePath: string) {
    this.close()
    this.currentPath = filePath
    this.db = openProjectDatabase(filePath)
    this.repositories = {
      scenes: new SceneRepository(this.db),
      boards: new BoardRepository(this.db),
      tags: new TagRepository(this.db),
    }
  }

  private replaceWithSnapshot(rawSnapshot: ProjectSnapshot) {
    const snapshot = normalizeSnapshot(rawSnapshot)
    const db = this.ensureDatabase()

    const replace = db.transaction(() => {
      db.exec(`
        DELETE FROM scene_tags;
        DELETE FROM board_items;
        DELETE FROM boards;
        DELETE FROM tags;
        DELETE FROM scenes;
      `)

      const insertScene = db.prepare(`
        INSERT INTO scenes (
          id, title, synopsis, notes, color, status, is_key_scene, category,
          estimated_duration, actual_duration, location, characters,
          function, source_reference, created_at, updated_at
        ) VALUES (
          @id, @title, @synopsis, @notes, @color, @status, @isKeyScene, @category,
          @estimatedDuration, @actualDuration, @location, @characters,
          @function, @sourceReference, @createdAt, @updatedAt
        )
      `)

      const insertTag = db.prepare('INSERT INTO tags (id, name, type) VALUES (@id, @name, @type)')
      const insertSceneTag = db.prepare('INSERT INTO scene_tags (scene_id, tag_id) VALUES (?, ?)')
      const insertBoard = db.prepare(
        'INSERT INTO boards (id, name, created_at, updated_at) VALUES (@id, @name, @createdAt, @updatedAt)',
      )
      const insertBoardItem = db.prepare(`
        INSERT INTO board_items (
          id, board_id, scene_id, kind, title, body, color, position, created_at, updated_at
        ) VALUES (
          @id, @boardId, @sceneId, @kind, @title, @body, @color, @position, @createdAt, @updatedAt
        )
      `)

      snapshot.scenes.forEach((scene) => {
        insertScene.run({
          ...scene,
          isKeyScene: scene.isKeyScene ? 1 : 0,
          characters: JSON.stringify(scene.characters),
        })
        scene.tagIds.forEach((tagId) => {
          insertSceneTag.run(scene.id, tagId)
        })
      })

      snapshot.tags.forEach((tag) => insertTag.run(tag))
      snapshot.boards.forEach((board) => {
        insertBoard.run(board)
        board.items.forEach((item) => {
          insertBoardItem.run({
            ...item,
            sceneId: item.kind === 'scene' ? item.sceneId : null,
            title: item.kind === 'scene' ? '' : item.title,
            body: item.kind === 'scene' ? '' : item.body,
            color: item.kind === 'scene' ? 'charcoal' : item.color,
          })
        })
      })

      this.setNotebook(snapshot.notebook.content, snapshot.notebook.updatedAt)
    })

    replace()
  }

  getNotebook(): NotebookDocument {
    const db = this.ensureDatabase()
    const readMeta = db.prepare('SELECT value FROM app_meta WHERE key = ?')
    const content = (readMeta.get('project_notebook') as { value: string } | undefined)?.value ?? ''
    const updatedAt =
      (readMeta.get('project_notebook_updated_at') as { value: string } | undefined)?.value ?? null

    return { content, updatedAt }
  }

  updateNotebook(content: string): NotebookDocument {
    return this.setNotebook(content)
  }

  private setNotebook(content: string, updatedAt: string | null = new Date().toISOString()): NotebookDocument {
    const db = this.ensureDatabase()
    const upsertMeta = db.prepare(`
      INSERT INTO app_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    const deleteMeta = db.prepare('DELETE FROM app_meta WHERE key = ?')

    upsertMeta.run('project_notebook', content)
    if (updatedAt) {
      upsertMeta.run('project_notebook_updated_at', updatedAt)
    } else {
      deleteMeta.run('project_notebook_updated_at')
    }

    return { content, updatedAt }
  }

  private ensureRepositories() {
    if (!this.repositories) {
      throw new Error('No project is currently open')
    }

    return this.repositories
  }

  private ensureDatabase() {
    if (!this.db) {
      throw new Error('No project is currently open')
    }

    return this.db
  }

  private async pickSavePath(title: string) {
    const meta = this.getMeta()
    const result = await dialog.showSaveDialog({
      title,
      defaultPath: meta?.path ?? path.join(app.getPath('documents'), 'Untitled.docudoc'),
      filters: [{ name: 'DocuDoc Project', extensions: ['docudoc'] }],
    })

    return result.canceled ? null : result.filePath ?? null
  }

  private async pickOpenProjectPath() {
    const result = await dialog.showOpenDialog({
      title: 'Open Project',
      properties: ['openFile'],
      filters: [
        { name: 'DocuDoc Project', extensions: ['docudoc'] },
        { name: 'Legacy DocuDoc Project', extensions: ['sqlite'] },
      ],
    })

    return result.canceled ? null : result.filePaths[0] ?? null
  }
}

function normalizeProjectFilePath(filePath: string | null) {
  if (!filePath) {
    return null
  }

  if (filePath.endsWith('.docudoc') || filePath.endsWith('.docudoc.sqlite')) {
    return filePath
  }

  return `${filePath}.docudoc`
}

function toProjectDisplayName(filePath: string) {
  return path
    .basename(filePath)
    .replace(/\.docudoc\.sqlite$/i, '')
    .replace(/\.docudoc$/i, '')
    .replace(/\.sqlite$/i, '')
}

function normalizeSnapshot(snapshot: ProjectSnapshot): ProjectSnapshotV3 {
  if (snapshot.schemaVersion === 3) {
    return snapshot
  }

  if (snapshot.schemaVersion === 2) {
    return {
      ...snapshot,
      schemaVersion: 3,
      notebook: { content: '', updatedAt: null },
    }
  }

  return {
    schemaVersion: 3,
    exportedAt: snapshot.exportedAt,
    project: snapshot.project,
    scenes: snapshot.scenes,
    tags: snapshot.tags,
    boards: snapshot.boards.map((board) => ({
      ...board,
      items: board.items.map(normalizeSnapshotBoardItem),
    })),
    notebook: { content: '', updatedAt: null },
  }
}

function normalizeSnapshotBoardItem(item: ProjectSnapshotV1['boards'][number]['items'][number]): BoardItem {
  if (item.kind && item.kind !== 'scene') {
    return {
      id: item.id,
      boardId: item.boardId,
      kind: item.kind,
      title: item.title ?? '',
      body: item.body ?? '',
      color: item.color ?? 'charcoal',
      position: item.position,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  }

  return {
    id: item.id,
    boardId: item.boardId,
    kind: 'scene',
    sceneId: item.sceneId ?? '',
    position: item.position,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}
