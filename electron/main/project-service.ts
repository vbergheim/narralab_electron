import fs from 'node:fs'
import path from 'node:path'

import { app, dialog, shell } from 'electron'

import { clampKeyRating } from '@/lib/scene-rating'
import type { ArchiveFolder, ArchiveItem, ArchiveItemUpdateInput } from '@/types/archive'
import type {
  AddSceneToBoardResult,
  Board,
  BoardFolder,
  BoardItem,
  BoardItemUpdateInput,
  BoardUpdateInput,
  BlockTemplate,
  BoardTextItem,
  BoardTextItemKind,
} from '@/types/board'
import type {
  BoardScriptExportFormat,
  NotebookDocument,
  ProjectMeta,
  ProjectSettings,
  ProjectSettingsUpdateInput,
  ProjectSnapshot,
  ProjectSnapshotV1,
  ProjectSnapshotV6,
} from '@/types/project'
import type { Scene, SceneBeat, SceneBeatUpdateInput, SceneFolder, SceneUpdateInput } from '@/types/scene'
import type { Tag, TagType } from '@/types/tag'

import { openProjectDatabase, type ProjectDatabase } from './db/connection'
import { ArchiveRepository } from './db/repositories/archive-repository'
import { BoardRepository } from './db/repositories/board-repository'
import { SceneRepository } from './db/repositories/scene-repository'
import { TagRepository } from './db/repositories/tag-repository'

type Repositories = {
  archive: ArchiveRepository
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

  async exportBoardScript(boardId: string, requestedPath?: string | null, format: BoardScriptExportFormat = 'txt-formatted') {
    const board = this.listBoards().find((entry) => entry.id === boardId)
    if (!board) {
      throw new Error('Board not found')
    }

    const defaultBaseName = `${sanitizeFileName(board.name || 'Untitled Board')}-script`
    const defaultExtension =
      format === 'md' ? 'md' : format === 'html-screenplay' ? 'html' : format === 'doc-screenplay' ? 'doc' : 'txt'
    const targetPath =
      requestedPath ??
      (await dialog.showSaveDialog({
        title: 'Export Board Script',
        defaultPath: this.getMeta() ? path.join(path.dirname(this.getMeta()!.path), `${defaultBaseName}.${defaultExtension}`) : `${defaultBaseName}.${defaultExtension}`,
        filters: [
          ...(format === 'md'
            ? [{ name: 'Markdown', extensions: ['md'] }]
            : format === 'html-screenplay'
              ? [{ name: 'Screenplay HTML', extensions: ['html'] }]
              : format === 'doc-screenplay'
                ? [{ name: 'Word Document', extensions: ['doc'] }]
              : [{ name: format === 'txt-formatted' ? 'Formatted Text' : 'Plain Text', extensions: ['txt'] }]),
        ],
      }).then((result) => (result.canceled ? null : result.filePath ?? null)))

    if (!targetPath) return null

    const content = buildBoardScript(board, this.listScenes(), format)
    fs.writeFileSync(targetPath, content, 'utf8')
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

  getProjectSettings(): ProjectSettings {
    const db = this.ensureDatabase()
    const row = db
      .prepare(
        `
          SELECT
            title,
            genre,
            format,
            target_runtime_minutes AS targetRuntimeMinutes,
            logline,
            default_board_view AS defaultBoardView,
            enabled_block_kinds AS enabledBlockKinds,
            block_kind_order AS blockKindOrder
          FROM project_settings
          WHERE id = 1
        `,
      )
      .get() as
      | {
          title: string
          genre: string
          format: string
          targetRuntimeMinutes: number
          logline: string
          defaultBoardView: string
          enabledBlockKinds: string
          blockKindOrder: string
        }
      | undefined

    if (!row) {
      return defaultProjectSettings()
    }

    return {
      title: row.title ?? '',
      genre: row.genre ?? '',
      format: row.format ?? '',
      targetRuntimeMinutes: Number.isFinite(row.targetRuntimeMinutes) ? row.targetRuntimeMinutes : 90,
      logline: row.logline ?? '',
      defaultBoardView: normalizeStoredBoardView(row.defaultBoardView),
      enabledBlockKinds: parseBlockKindList(row.enabledBlockKinds),
      blockKindOrder: parseBlockKindList(row.blockKindOrder),
    }
  }

  updateProjectSettings(input: ProjectSettingsUpdateInput): ProjectSettings {
    const current = this.getProjectSettings()
    const next: ProjectSettings = {
      title: input.title ?? current.title,
      genre: input.genre ?? current.genre,
      format: input.format ?? current.format,
      targetRuntimeMinutes: input.targetRuntimeMinutes ?? current.targetRuntimeMinutes,
      logline: input.logline ?? current.logline,
      defaultBoardView: normalizeStoredBoardView(input.defaultBoardView ?? current.defaultBoardView),
      enabledBlockKinds: normalizeBlockKindList(input.enabledBlockKinds ?? current.enabledBlockKinds),
      blockKindOrder: normalizeBlockKindList(input.blockKindOrder ?? current.blockKindOrder),
    }

    this.ensureDatabase()
      .prepare(
        `
          UPDATE project_settings
          SET
            title = ?,
            genre = ?,
            format = ?,
            target_runtime_minutes = ?,
            logline = ?,
            default_board_view = ?,
            enabled_block_kinds = ?,
            block_kind_order = ?,
            updated_at = ?
          WHERE id = 1
        `,
      )
      .run(
        next.title,
        next.genre,
        next.format,
        next.targetRuntimeMinutes,
        next.logline,
        next.defaultBoardView,
        JSON.stringify(next.enabledBlockKinds),
        JSON.stringify(next.blockKindOrder),
        new Date().toISOString(),
      )

    return next
  }

  listScenes(): Scene[] {
    return this.ensureRepositories().scenes.list()
  }

  listArchiveFolders(): ArchiveFolder[] {
    return this.ensureRepositories().archive.listFolders()
  }

  listArchiveItems(): ArchiveItem[] {
    return this.ensureRepositories().archive.listItems()
  }

  createArchiveFolder(name: string, parentId?: string | null): ArchiveFolder[] {
    return this.ensureRepositories().archive.createFolder(name, parentId)
  }

  renameArchiveFolder(folderId: string, name: string): ArchiveFolder[] {
    return this.ensureRepositories().archive.renameFolder(folderId, name)
  }

  updateArchiveFolder(input: { id: string; name?: string; color?: Scene['color'] }): ArchiveFolder[] {
    return this.ensureRepositories().archive.updateFolder(input)
  }

  deleteArchiveFolder(folderId: string): ArchiveFolder[] {
    return this.ensureRepositories().archive.deleteFolder(folderId)
  }

  async importArchiveFiles(requestedPaths?: string[] | null, folderId?: string | null): Promise<ArchiveItem[]> {
    const filePaths =
      requestedPaths && requestedPaths.length > 0
        ? requestedPaths
        : await dialog.showOpenDialog({
            title: 'Add Files To Archive',
            properties: ['openFile', 'multiSelections'],
          }).then((result) => (result.canceled ? [] : result.filePaths))

    if (filePaths.length === 0) {
      return []
    }

    return this.ensureRepositories().archive.addFiles(filePaths, folderId ?? null)
  }

  updateArchiveItem(input: ArchiveItemUpdateInput): ArchiveItem {
    return this.ensureRepositories().archive.updateItem(input)
  }

  deleteArchiveItem(itemId: string): void {
    this.ensureRepositories().archive.deleteItem(itemId)
  }

  async openArchiveItem(itemId: string): Promise<void> {
    const item = this.listArchiveItems().find((entry) => entry.id === itemId)
    if (!item) throw new Error('Archive item not found')
    const result = await shell.openPath(item.filePath)
    if (result) {
      throw new Error(result)
    }
  }

  revealArchiveItem(itemId: string): void {
    const item = this.listArchiveItems().find((entry) => entry.id === itemId)
    if (!item) throw new Error('Archive item not found')
    shell.showItemInFolder(item.filePath)
  }

  createScene(): Scene {
    return this.ensureRepositories().scenes.create()
  }

  updateScene(input: SceneUpdateInput): Scene {
    if (input.folder?.trim()) {
      this.ensureSceneFolder(input.folder)
    }
    return this.ensureRepositories().scenes.update(input)
  }

  deleteScene(id: string) {
    this.ensureRepositories().scenes.delete(id)
  }

  reorderScenes(sceneIds: string[]): Scene[] {
    return this.ensureRepositories().scenes.reorder(sceneIds)
  }

  createSceneBeat(sceneId: string, afterBeatId?: string | null): SceneBeat {
    return this.ensureRepositories().scenes.createBeat(sceneId, afterBeatId)
  }

  updateSceneBeat(input: SceneBeatUpdateInput): SceneBeat {
    return this.ensureRepositories().scenes.updateBeat(input)
  }

  deleteSceneBeat(id: string) {
    this.ensureRepositories().scenes.deleteBeat(id)
  }

  reorderSceneBeats(sceneId: string, beatIds: string[]): SceneBeat[] {
    return this.ensureRepositories().scenes.reorderBeats(sceneId, beatIds)
  }

  listSceneFolders(): SceneFolder[] {
    const db = this.ensureDatabase()
    const readMeta = db.prepare('SELECT value FROM app_meta WHERE key = ?')
    const storedValue = (readMeta.get('scene_folders') as { value: string } | undefined)?.value
    const storedFolders = parseSceneFolders(storedValue)
    const sceneFolderPaths = Array.from(
      new Set(
        this.listScenes()
          .map((scene) => scene.folder.trim())
          .filter(Boolean),
      ),
    )

    const merged = [...storedFolders]
    sceneFolderPaths.forEach((path) => {
      const normalizedPath = normalizeFolderPath(path)
      if (!normalizedPath) return
      if (!merged.some((folder) => folder.path.toLowerCase() === normalizedPath.toLowerCase())) {
        merged.push(makeFolderRecord(normalizedPath, 'slate', merged.length))
      }
    })

    return normalizeSceneFolders(merged)
  }

  createSceneFolder(name: string, parentPath?: string | null): SceneFolder[] {
    const nextName = name.trim()
    if (!nextName) {
      throw new Error('Folder name cannot be empty')
    }

    const folders = this.listSceneFolders()
    const normalizedParentPath = normalizeNullableFolderPath(parentPath)
    if (normalizedParentPath && !folders.some((folder) => folder.path.toLowerCase() === normalizedParentPath.toLowerCase())) {
      throw new Error('Parent folder not found')
    }

    const nextPath = buildFolderPath(nextName, normalizedParentPath)
    if (folders.some((folder) => folder.path.toLowerCase() === nextPath.toLowerCase())) {
      return folders
    }

    const nextFolders = normalizeSceneFolders([...folders, makeFolderRecord(nextPath, 'slate', folders.length)])
    this.setSceneFolders(nextFolders)
    return nextFolders
  }

  updateSceneFolder(currentPath: string, input: { name?: string; color?: Scene['color']; parentPath?: string | null }): SceneFolder[] {
    const previousPath = normalizeFolderPath(currentPath)
    const requestedName = input.name?.trim()
    if (!previousPath) {
      throw new Error('Folder name cannot be empty')
    }

    const folders = this.listSceneFolders()
    const current = folders.find((folder) => folder.path.toLowerCase() === previousPath.toLowerCase())
    if (!current) {
      throw new Error('Folder not found')
    }

    const nextName = requestedName || current.name
    if (!nextName) {
      throw new Error('Folder name cannot be empty')
    }

    const normalizedParentPath =
      input.parentPath === undefined ? current.parentPath : normalizeNullableFolderPath(input.parentPath)

    if (
      normalizedParentPath &&
      (normalizedParentPath.toLowerCase() === previousPath.toLowerCase() ||
        normalizedParentPath.toLowerCase().startsWith(`${previousPath.toLowerCase()}/`))
    ) {
      throw new Error('Cannot move a folder into itself')
    }

    if (
      normalizedParentPath &&
      !folders.some(
        (folder) =>
          folder.path.toLowerCase() === normalizedParentPath.toLowerCase() &&
          folder.path.toLowerCase() !== previousPath.toLowerCase(),
      )
    ) {
      throw new Error('Parent folder not found')
    }

    const nextPath = buildFolderPath(nextName, normalizedParentPath)
    if (
      previousPath.toLowerCase() !== nextPath.toLowerCase() &&
      folders.some((folder) => folder.path.toLowerCase() === nextPath.toLowerCase())
    ) {
      throw new Error('A folder with that name already exists')
    }

    const nextFolders = normalizeSceneFolders(
      folders.map((folder) =>
        isFolderWithinPath(folder.path, previousPath)
          ? {
              ...folder,
              path: replaceFolderPathPrefix(folder.path, previousPath, nextPath),
              parentPath: folder.parentPath
                ? replaceFolderPathPrefix(folder.parentPath, previousPath, nextPath)
                : null,
              name: getFolderNameFromPath(replaceFolderPathPrefix(folder.path, previousPath, nextPath)),
              color: folder.path.toLowerCase() === previousPath.toLowerCase() ? input.color ?? current.color : folder.color,
            }
          : folder,
      ),
    )

    const scenes = this.listScenes().filter((scene) => isFolderWithinPath(scene.folder, previousPath))
    scenes.forEach((scene) => {
      this.ensureRepositories().scenes.update({
        id: scene.id,
        folder: replaceFolderPathPrefix(scene.folder, previousPath, nextPath),
      })
    })

    this.setSceneFolders(nextFolders)
    return nextFolders
  }

  deleteSceneFolder(currentPath: string): SceneFolder[] {
    const previousPath = normalizeFolderPath(currentPath)
    if (!previousPath) {
      throw new Error('Folder name cannot be empty')
    }

    const folders = this.listSceneFolders()
    const current = folders.find((folder) => folder.path.toLowerCase() === previousPath.toLowerCase())
    if (!current) {
      throw new Error('Folder not found')
    }

    const nextFolders = normalizeSceneFolders(
      folders.filter((folder) => !isFolderWithinPath(folder.path, previousPath)),
    )

    const scenes = this.listScenes().filter((scene) => isFolderWithinPath(scene.folder, previousPath))
    scenes.forEach((scene) => {
      this.ensureRepositories().scenes.update({ id: scene.id, folder: '' })
    })

    this.setSceneFolders(nextFolders)
    return nextFolders
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

  createBoard(name: string, folder?: string | null): Board {
    const nextName = name.trim() || 'New Board'
    const nextFolder = normalizeFolderPath(folder)
    if (nextFolder) {
      this.ensureBoardFolder(nextFolder)
    }
    return this.ensureRepositories().boards.create(nextName, { folder: nextFolder })
  }

  deleteBoard(boardId: string): Board[] {
    return this.ensureRepositories().boards.delete(boardId)
  }

  updateBoard(input: BoardUpdateInput): Board {
    if (input.folder !== undefined) {
      const nextFolder = normalizeFolderPath(input.folder)
      if (nextFolder) {
        this.ensureBoardFolder(nextFolder)
      }
      return this.ensureRepositories().boards.updateBoard({ ...input, folder: nextFolder })
    }
    return this.ensureRepositories().boards.updateBoard(input)
  }

  reorderBoards(boardIds: string[]): Board[] {
    return this.ensureRepositories().boards.reorderBoards(boardIds)
  }

  listBlockTemplates(): BlockTemplate[] {
    const db = this.ensureDatabase()
    const readMeta = db.prepare('SELECT value FROM app_meta WHERE key = ?')
    const storedValue = (readMeta.get('block_templates') as { value: string } | undefined)?.value
    return parseBlockTemplates(storedValue)
  }

  createBlockTemplate(input: { kind: BoardTextItemKind; name: string; title: string; body: string }): BlockTemplate[] {
    const name = input.name.trim()
    if (!name) {
      throw new Error('Template name cannot be empty')
    }

    const now = new Date().toISOString()
    const templates = this.listBlockTemplates()
    const template: BlockTemplate = {
      id: `template_${Math.random().toString(36).slice(2, 10)}`,
      name,
      kind: input.kind,
      title: input.title.trim(),
      body: input.body,
      createdAt: now,
      updatedAt: now,
    }
    const nextTemplates = [...templates, template]
    this.setBlockTemplates(nextTemplates)
    return nextTemplates
  }

  deleteBlockTemplate(id: string): BlockTemplate[] {
    const nextTemplates = this.listBlockTemplates().filter((template) => template.id !== id)
    this.setBlockTemplates(nextTemplates)
    return nextTemplates
  }

  listBoardFolders(): BoardFolder[] {
    const db = this.ensureDatabase()
    const readMeta = db.prepare('SELECT value FROM app_meta WHERE key = ?')
    const storedValue = (readMeta.get('board_folders') as { value: string } | undefined)?.value
    const storedFolders = parseBoardFolders(storedValue)
    const boardFolderPaths = Array.from(
      new Set(
        this.listBoards()
          .map((board) => board.folder.trim())
          .filter(Boolean),
      ),
    )

    const merged = [...storedFolders]
    boardFolderPaths.forEach((path) => {
      const normalizedPath = normalizeFolderPath(path)
      if (!normalizedPath) return
      if (!merged.some((folder) => folder.path.toLowerCase() === normalizedPath.toLowerCase())) {
        merged.push(makeFolderRecord(normalizedPath, 'slate', merged.length))
      }
    })

    return normalizeBoardFolders(merged)
  }

  createBoardFolder(name: string, parentPath?: string | null): BoardFolder[] {
    const nextName = name.trim()
    if (!nextName) {
      throw new Error('Folder name cannot be empty')
    }

    const folders = this.listBoardFolders()
    const normalizedParentPath = normalizeNullableFolderPath(parentPath)
    if (normalizedParentPath && !folders.some((folder) => folder.path.toLowerCase() === normalizedParentPath.toLowerCase())) {
      throw new Error('Parent folder not found')
    }

    const nextPath = buildFolderPath(nextName, normalizedParentPath)
    if (folders.some((folder) => folder.path.toLowerCase() === nextPath.toLowerCase())) {
      return folders
    }

    const nextFolders = normalizeBoardFolders([...folders, makeFolderRecord(nextPath, 'slate', folders.length)])
    this.setBoardFolders(nextFolders)
    return nextFolders
  }

  renameBoardFolder(oldPath: string, newName: string): BoardFolder[] {
    return this.updateBoardFolder(oldPath, { name: newName })
  }

  updateBoardFolder(currentPath: string, input: { name?: string; color?: Scene['color']; parentPath?: string | null }): BoardFolder[] {
    const previousPath = normalizeFolderPath(currentPath)
    const requestedName = input.name?.trim()
    if (!previousPath) {
      throw new Error('Folder name cannot be empty')
    }

    const folders = this.listBoardFolders()
    const current = folders.find((folder) => folder.path.toLowerCase() === previousPath.toLowerCase())
    if (!current) {
      throw new Error('Folder not found')
    }

    const nextName = requestedName || current.name
    if (!nextName) {
      throw new Error('Folder name cannot be empty')
    }

    const normalizedParentPath =
      input.parentPath === undefined ? current.parentPath : normalizeNullableFolderPath(input.parentPath)

    if (
      normalizedParentPath &&
      (normalizedParentPath.toLowerCase() === previousPath.toLowerCase() ||
        normalizedParentPath.toLowerCase().startsWith(`${previousPath.toLowerCase()}/`))
    ) {
      throw new Error('Cannot move a folder into itself')
    }

    if (
      normalizedParentPath &&
      !folders.some(
        (folder) =>
          folder.path.toLowerCase() === normalizedParentPath.toLowerCase() &&
          folder.path.toLowerCase() !== previousPath.toLowerCase(),
      )
    ) {
      throw new Error('Parent folder not found')
    }

    const nextPath = buildFolderPath(nextName, normalizedParentPath)
    if (
      previousPath.toLowerCase() !== nextPath.toLowerCase() &&
      folders.some((folder) => folder.path.toLowerCase() === nextPath.toLowerCase())
    ) {
      throw new Error('A folder with that name already exists')
    }

    const nextFolders = normalizeBoardFolders(
      folders.map((folder) =>
        isFolderWithinPath(folder.path, previousPath)
          ? {
              ...folder,
              path: replaceFolderPathPrefix(folder.path, previousPath, nextPath),
              parentPath: folder.parentPath
                ? replaceFolderPathPrefix(folder.parentPath, previousPath, nextPath)
                : null,
              name: getFolderNameFromPath(replaceFolderPathPrefix(folder.path, previousPath, nextPath)),
              color: folder.path.toLowerCase() === previousPath.toLowerCase() ? input.color ?? current.color : folder.color,
            }
          : folder,
      ),
    )

    const boards = this.listBoards().filter((board) => isFolderWithinPath(board.folder, previousPath))
    boards.forEach((board) => {
      this.ensureRepositories().boards.updateBoard({
        id: board.id,
        folder: replaceFolderPathPrefix(board.folder, previousPath, nextPath),
      })
    })

    this.setBoardFolders(nextFolders)
    return nextFolders
  }

  deleteBoardFolder(currentPath: string): BoardFolder[] {
    const previousPath = normalizeFolderPath(currentPath)
    if (!previousPath) {
      throw new Error('Folder name cannot be empty')
    }

    const folders = this.listBoardFolders()
    const current = folders.find((folder) => folder.path.toLowerCase() === previousPath.toLowerCase())
    if (!current) {
      throw new Error('Folder not found')
    }

    const nextFolders = normalizeBoardFolders(
      folders.filter((folder) => !isFolderWithinPath(folder.path, previousPath)),
    )

    const boards = this.listBoards().filter((board) => isFolderWithinPath(board.folder, previousPath))
    boards.forEach((board) => {
      this.ensureRepositories().boards.updateBoard({ id: board.id, folder: '' })
    })

    this.setBoardFolders(nextFolders)
    return nextFolders
  }

  addSceneToBoard(boardId: string, sceneId: string, afterItemId?: string | null, boardPosition?: { x: number; y: number } | null): AddSceneToBoardResult {
    return this.ensureRepositories().boards.addScene(boardId, sceneId, afterItemId, boardPosition)
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

  getSnapshot(): ProjectSnapshotV6 {
    return {
      schemaVersion: 6,
      exportedAt: new Date().toISOString(),
      project: this.getMeta(),
      projectSettings: this.getProjectSettings(),
      scenes: this.listScenes(),
      tags: this.listTags(),
      boards: this.listBoards(),
      notebook: this.getNotebook(),
    }
  }

  getConsultantContext(activeBoardId: string | null) {
    const meta = this.getMeta()
    if (!meta) {
      return 'No project is currently open.'
    }

    const boards = this.listBoards()
    const activeBoard = boards.find((board) => board.id === activeBoardId) ?? boards[0] ?? null
    if (!activeBoard) {
      return 'No active board.'
    }

    const scenes = this.listScenes()
    const tags = this.listTags()
    const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]))
    const tagMap = new Map(tags.map((tag) => [tag.id, tag.name]))
    const boardLines = activeBoard.items.slice(0, 40).map((item, index) => {
      if (item.kind === 'scene') {
        const scene = sceneMap.get(item.sceneId)
        if (!scene) {
          return `${index + 1}. [Missing scene]`
        }

        const tagNames = scene.tagIds.map((id) => tagMap.get(id)).filter(Boolean)
        return `${index + 1}. Scene: ${scene.title || 'Untitled'} | Synopsis: ${trimForConsultant(scene.synopsis, 140)} | Category: ${scene.category || '-'} | Key rating: ${normalizeSceneKeyRating(scene)}/5 | Tags: ${tagNames.join(', ') || '-'}`
      }

      return `${index + 1}. ${item.kind}: ${trimForConsultant(item.title || item.body, 140)}`
    })

    return [
      `Project: ${meta.name}`,
      `Active board: ${activeBoard.name}`,
      'Outline:',
      ...boardLines,
    ].join('\n')
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
      archive: new ArchiveRepository(this.db),
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
        DELETE FROM scene_beats;
        DELETE FROM board_items;
        DELETE FROM boards;
        DELETE FROM tags;
        DELETE FROM scenes;
      `)

      const insertScene = db.prepare(`
        INSERT INTO scenes (
          id, sort_order, title, synopsis, notes, color, status, is_key_scene, folder, category,
          estimated_duration, actual_duration, location, characters,
          function, source_reference, created_at, updated_at
        ) VALUES (
          @id, @sortOrder, @title, @synopsis, @notes, @color, @status, @keyRating, @folder, @category,
          @estimatedDuration, @actualDuration, @location, @characters,
          @function, @sourceReference, @createdAt, @updatedAt
        )
      `)

      const insertTag = db.prepare('INSERT INTO tags (id, name, type) VALUES (@id, @name, @type)')
      const insertSceneTag = db.prepare('INSERT INTO scene_tags (scene_id, tag_id) VALUES (?, ?)')
      const insertSceneBeat = db.prepare(`
        INSERT INTO scene_beats (
          id, scene_id, sort_order, text, created_at, updated_at
        ) VALUES (
          @id, @sceneId, @sortOrder, @text, @createdAt, @updatedAt
        )
      `)
      const insertBoard = db.prepare(
        'INSERT INTO boards (id, name, description, color, folder, sort_order, created_at, updated_at) VALUES (@id, @name, @description, @color, @folder, @sortOrder, @createdAt, @updatedAt)',
      )
      const insertBoardItem = db.prepare(`
        INSERT INTO board_items (
          id, board_id, scene_id, kind, title, body, color, position, board_x, board_y, board_w, board_h, created_at, updated_at
        ) VALUES (
          @id, @boardId, @sceneId, @kind, @title, @body, @color, @position, @boardX, @boardY, @boardW, @boardH, @createdAt, @updatedAt
        )
      `)

      snapshot.scenes.forEach((scene, index) => {
        insertScene.run({
          ...scene,
          sortOrder: scene.sortOrder ?? index,
          folder: scene.folder ?? '',
          keyRating: normalizeSceneKeyRating(scene),
          characters: JSON.stringify(scene.characters),
        })
        scene.tagIds.forEach((tagId) => {
          insertSceneTag.run(scene.id, tagId)
        })
        scene.beats.forEach((beat, beatIndex) => {
          insertSceneBeat.run({
            ...beat,
            sceneId: scene.id,
            sortOrder: beat.sortOrder ?? beatIndex,
            text: beat.text ?? '',
            createdAt: beat.createdAt ?? scene.createdAt,
            updatedAt: beat.updatedAt ?? scene.updatedAt,
          })
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
            boardX: item.boardX ?? item.position * 320,
            boardY: item.boardY ?? 0,
            boardW: item.boardW ?? (item.kind === 'scene' ? 300 : 260),
            boardH: item.boardH ?? (item.kind === 'scene' ? 132 : 108),
          })
        })
      })

      this.setNotebook(snapshot.notebook.content, snapshot.notebook.updatedAt)
      this.updateProjectSettings(snapshot.projectSettings)
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

  private ensureBoardFolder(path: string) {
    const nextPath = normalizeFolderPath(path)
    if (!nextPath) return

    const folders = this.listBoardFolders()
    if (folders.some((folder) => folder.path.toLowerCase() === nextPath.toLowerCase())) {
      return
    }

    this.setBoardFolders([...folders, makeFolderRecord(nextPath, 'slate', folders.length)])
  }

  private ensureSceneFolder(path: string) {
    const nextPath = normalizeFolderPath(path)
    if (!nextPath) return

    const folders = this.listSceneFolders()
    if (folders.some((folder) => folder.path.toLowerCase() === nextPath.toLowerCase())) {
      return
    }

    this.setSceneFolders([...folders, makeFolderRecord(nextPath, 'slate', folders.length)])
  }

  private setBoardFolders(folders: BoardFolder[]) {
    const db = this.ensureDatabase()
    const upsertMeta = db.prepare(`
      INSERT INTO app_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    upsertMeta.run('board_folders', JSON.stringify(normalizeBoardFolders(folders)))
  }

  private setSceneFolders(folders: SceneFolder[]) {
    const db = this.ensureDatabase()
    const upsertMeta = db.prepare(`
      INSERT INTO app_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    upsertMeta.run('scene_folders', JSON.stringify(normalizeSceneFolders(folders)))
  }

  private setBlockTemplates(templates: BlockTemplate[]) {
    const db = this.ensureDatabase()
    const upsertMeta = db.prepare(`
      INSERT INTO app_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `)
    upsertMeta.run('block_templates', JSON.stringify(normalizeBlockTemplates(templates)))
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

function normalizeSnapshot(snapshot: ProjectSnapshot): ProjectSnapshotV6 {
  if (snapshot.schemaVersion === 6) {
    return {
      ...snapshot,
      scenes: snapshot.scenes.map(normalizeSnapshotScene),
      projectSettings: normalizeProjectSettings(snapshot.projectSettings),
      boards: snapshot.boards.map(normalizeBoardSnapshot),
    }
  }

  if (snapshot.schemaVersion === 5) {
    return {
      ...snapshot,
      schemaVersion: 6,
      scenes: snapshot.scenes.map(normalizeSnapshotScene),
      projectSettings: normalizeProjectSettings(snapshot.projectSettings),
      boards: snapshot.boards.map(normalizeBoardSnapshot),
    }
  }

  if (snapshot.schemaVersion === 4) {
    return {
      ...snapshot,
      schemaVersion: 6,
      scenes: snapshot.scenes.map(normalizeSnapshotScene),
      projectSettings: defaultProjectSettings(),
      boards: snapshot.boards.map(normalizeBoardSnapshot),
    }
  }

  if (snapshot.schemaVersion === 3) {
    return {
      ...snapshot,
      schemaVersion: 6,
      scenes: snapshot.scenes.map(normalizeSnapshotScene),
      projectSettings: defaultProjectSettings(),
      boards: snapshot.boards.map((board) => normalizeBoardSnapshot({
        ...board,
        description: 'description' in board ? board.description : '',
        color: 'color' in board ? board.color : 'charcoal',
        folder: 'folder' in board ? board.folder : '',
        sortOrder: 'sortOrder' in board ? board.sortOrder : 0,
      })),
    }
  }

  if (snapshot.schemaVersion === 2) {
    return {
      ...snapshot,
      schemaVersion: 6,
      scenes: snapshot.scenes.map(normalizeSnapshotScene),
      projectSettings: defaultProjectSettings(),
      boards: snapshot.boards.map((board) => normalizeBoardSnapshot({
        ...board,
        description: '',
        color: 'charcoal',
        folder: '',
        sortOrder: 0,
      })),
      notebook: { content: '', updatedAt: null },
    }
  }

  return {
    schemaVersion: 6,
    exportedAt: snapshot.exportedAt,
    project: snapshot.project,
    projectSettings: defaultProjectSettings(),
    scenes: snapshot.scenes.map(normalizeSnapshotScene),
    tags: snapshot.tags,
    boards: snapshot.boards.map((board) => normalizeBoardSnapshot({
      ...board,
      description: '',
      color: 'charcoal',
      folder: '',
      sortOrder: 0,
      items: board.items.map(normalizeSnapshotBoardItem),
    })),
    notebook: { content: '', updatedAt: null },
  }
}

function normalizeSnapshotScene(scene: Scene) {
  return {
    ...scene,
    beats: Array.isArray(scene.beats)
      ? scene.beats.map((beat, index) => ({
          id: typeof beat.id === 'string' ? beat.id : `beat_${Math.random().toString(36).slice(2, 10)}`,
          sceneId: scene.id,
          sortOrder: typeof beat.sortOrder === 'number' ? beat.sortOrder : index,
          text: typeof beat.text === 'string' ? beat.text : '',
          createdAt: typeof beat.createdAt === 'string' ? beat.createdAt : scene.createdAt,
          updatedAt: typeof beat.updatedAt === 'string' ? beat.updatedAt : scene.updatedAt,
        }))
      : [],
  }
}

function normalizeBoardSnapshot(board: Board): Board {
  return {
    ...board,
    items: board.items.map((item) => ({
      ...item,
      boardX: item.boardX ?? item.position * 320,
      boardY: item.boardY ?? 0,
      boardW: item.boardW ?? (item.kind === 'scene' ? 300 : 260),
      boardH: item.boardH ?? (item.kind === 'scene' ? 132 : 108),
    })),
  }
}

function normalizeSceneKeyRating(scene: Scene | (Scene & { isKeyScene?: boolean })) {
  const legacyScene = scene as Scene & { isKeyScene?: boolean }
  return clampKeyRating(legacyScene.keyRating ?? legacyScene.isKeyScene)
}

function parseBoardFolders(value?: string | null): BoardFolder[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return normalizeBoardFolders(
      parsed
        .filter((entry): entry is { name?: unknown; color?: unknown; sortOrder?: unknown } => typeof entry === 'object' && entry !== null)
        .map((entry) => ({
          path:
            'path' in entry && typeof entry.path === 'string'
              ? entry.path.trim()
              : typeof entry.name === 'string'
                ? entry.name.trim()
                : '',
          name: typeof entry.name === 'string' ? entry.name.trim() : '',
          parentPath:
            'parentPath' in entry && typeof entry.parentPath === 'string' && entry.parentPath.trim().length > 0
              ? entry.parentPath.trim()
              : null,
          color: isSceneColor(entry.color) ? entry.color : 'slate',
          sortOrder: typeof entry.sortOrder === 'number' ? entry.sortOrder : 0,
        }))
        .filter((entry) => entry.path.length > 0 || entry.name.length > 0),
    )
  } catch {
    return []
  }
}

function normalizeBoardFolders(folders: BoardFolder[]) {
  const deduped: BoardFolder[] = []

  folders
    .map((folder, index) => {
      const path = normalizeFolderPath(folder.path || folder.name)
      if (!path) return null
      return {
        path,
        name: getFolderNameFromPath(path),
        parentPath: getParentFolderPath(path),
        color: folder.color ?? 'slate',
        sortOrder: typeof folder.sortOrder === 'number' ? folder.sortOrder : index,
      } satisfies BoardFolder
    })
    .filter((folder): folder is BoardFolder => Boolean(folder))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.path.localeCompare(right.path))
    .forEach((folder) => {
      if (!deduped.some((entry) => entry.path.toLowerCase() === folder.path.toLowerCase())) {
        deduped.push({ ...folder, sortOrder: deduped.length })
      }
    })

  return deduped
}

function parseSceneFolders(value?: string | null): SceneFolder[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return normalizeSceneFolders(
      parsed
        .filter((entry): entry is { name?: unknown; color?: unknown; sortOrder?: unknown } => typeof entry === 'object' && entry !== null)
        .map((entry) => ({
          path:
            'path' in entry && typeof entry.path === 'string'
              ? entry.path.trim()
              : typeof entry.name === 'string'
                ? entry.name.trim()
                : '',
          name: typeof entry.name === 'string' ? entry.name.trim() : '',
          parentPath:
            'parentPath' in entry && typeof entry.parentPath === 'string' && entry.parentPath.trim().length > 0
              ? entry.parentPath.trim()
              : null,
          color: isSceneColor(entry.color) ? entry.color : 'slate',
          sortOrder: typeof entry.sortOrder === 'number' ? entry.sortOrder : 0,
        }))
        .filter((entry) => entry.path.length > 0 || entry.name.length > 0),
    )
  } catch {
    return []
  }
}

function normalizeSceneFolders(folders: SceneFolder[]) {
  const deduped: SceneFolder[] = []

  folders
    .map((folder, index) => {
      const path = normalizeFolderPath(folder.path || folder.name)
      if (!path) return null
      return {
        path,
        name: getFolderNameFromPath(path),
        parentPath: getParentFolderPath(path),
        color: folder.color ?? 'slate',
        sortOrder: typeof folder.sortOrder === 'number' ? folder.sortOrder : index,
      } satisfies SceneFolder
    })
    .filter((folder): folder is SceneFolder => Boolean(folder))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.path.localeCompare(right.path))
    .forEach((folder) => {
      if (!deduped.some((entry) => entry.path.toLowerCase() === folder.path.toLowerCase())) {
        deduped.push({ ...folder, sortOrder: deduped.length })
      }
    })

  return deduped
}

function makeFolderRecord(path: string, color: Scene['color'], sortOrder: number) {
  const normalizedPath = normalizeFolderPath(path)
  if (!normalizedPath) {
    throw new Error('Folder path cannot be empty')
  }

  return {
    path: normalizedPath,
    name: getFolderNameFromPath(normalizedPath),
    parentPath: getParentFolderPath(normalizedPath),
    color,
    sortOrder,
  }
}

function normalizeFolderPath(value?: string | null) {
  if (!value) return ''
  return value
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/')
}

function normalizeNullableFolderPath(value?: string | null) {
  const normalized = normalizeFolderPath(value)
  return normalized || null
}

function buildFolderPath(name: string, parentPath?: string | null) {
  const normalizedName = normalizeFolderPath(name)
  const normalizedParentPath = normalizeFolderPath(parentPath)
  return normalizedParentPath ? `${normalizedParentPath}/${normalizedName}` : normalizedName
}

function getFolderNameFromPath(path: string) {
  const normalizedPath = normalizeFolderPath(path)
  if (!normalizedPath) return ''
  const segments = normalizedPath.split('/')
  return segments[segments.length - 1] ?? ''
}

function getParentFolderPath(path: string) {
  const normalizedPath = normalizeFolderPath(path)
  if (!normalizedPath || !normalizedPath.includes('/')) return null
  return normalizedPath.split('/').slice(0, -1).join('/') || null
}

function isFolderWithinPath(path: string | null | undefined, basePath: string) {
  const normalizedPath = normalizeFolderPath(path)
  const normalizedBasePath = normalizeFolderPath(basePath)
  if (!normalizedPath || !normalizedBasePath) return false
  return (
    normalizedPath.toLowerCase() === normalizedBasePath.toLowerCase() ||
    normalizedPath.toLowerCase().startsWith(`${normalizedBasePath.toLowerCase()}/`)
  )
}

function replaceFolderPathPrefix(path: string, fromPath: string, toPath: string) {
  const normalizedPath = normalizeFolderPath(path)
  const normalizedFromPath = normalizeFolderPath(fromPath)
  const normalizedToPath = normalizeFolderPath(toPath)

  if (!normalizedFromPath) return normalizedPath
  if (normalizedPath.toLowerCase() === normalizedFromPath.toLowerCase()) {
    return normalizedToPath
  }

  const suffix = normalizedPath.slice(normalizedFromPath.length)
  return normalizeFolderPath(`${normalizedToPath}${suffix}`)
}

function parseBlockTemplates(value?: string | null): BlockTemplate[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return normalizeBlockTemplates(
      parsed
        .filter(
          (
            entry,
          ): entry is {
            id?: unknown
            name?: unknown
            kind?: unknown
            title?: unknown
            body?: unknown
            createdAt?: unknown
            updatedAt?: unknown
          } => typeof entry === 'object' && entry !== null,
        )
        .map((entry) => ({
          id: typeof entry.id === 'string' ? entry.id : `template_${Math.random().toString(36).slice(2, 10)}`,
          name: typeof entry.name === 'string' ? entry.name.trim() : '',
          kind: isBoardTextItemKind(entry.kind) ? entry.kind : 'note',
          title: typeof entry.title === 'string' ? entry.title : '',
          body: typeof entry.body === 'string' ? entry.body : '',
          createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
          updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : new Date().toISOString(),
        }))
        .filter((entry) => entry.name.length > 0),
    )
  } catch {
    return []
  }
}

function normalizeBlockTemplates(templates: BlockTemplate[]) {
  return templates
    .filter((template) => template.name.trim().length > 0)
    .map((template) => ({
      ...template,
      name: template.name.trim(),
      title: template.title.trim(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

function defaultProjectSettings(): ProjectSettings {
  return {
    title: '',
    genre: '',
    format: '',
    targetRuntimeMinutes: 90,
    logline: '',
    defaultBoardView: 'outline',
    enabledBlockKinds: ['chapter', 'voiceover', 'narration', 'text-card', 'note'],
    blockKindOrder: ['chapter', 'voiceover', 'narration', 'text-card', 'note'],
  }
}

function normalizeProjectSettings(value?: Partial<ProjectSettings> | null): ProjectSettings {
  const defaults = defaultProjectSettings()
  return {
    title: value?.title?.trim() ?? defaults.title,
    genre: value?.genre?.trim() ?? defaults.genre,
    format: value?.format?.trim() ?? defaults.format,
    targetRuntimeMinutes:
      typeof value?.targetRuntimeMinutes === 'number' && Number.isFinite(value.targetRuntimeMinutes)
        ? value.targetRuntimeMinutes
        : defaults.targetRuntimeMinutes,
    logline: value?.logline ?? defaults.logline,
    defaultBoardView: normalizeStoredBoardView(value?.defaultBoardView ?? defaults.defaultBoardView),
    enabledBlockKinds: normalizeBlockKindList(value?.enabledBlockKinds ?? defaults.enabledBlockKinds),
    blockKindOrder: normalizeBlockKindList(value?.blockKindOrder ?? defaults.blockKindOrder),
  }
}

function parseBlockKindList(value: string): ProjectSettings['enabledBlockKinds'] {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return defaultProjectSettings().enabledBlockKinds
    }
    return normalizeBlockKindList(parsed)
  } catch {
    return defaultProjectSettings().enabledBlockKinds
  }
}

function normalizeBlockKindList(value: unknown): ProjectSettings['enabledBlockKinds'] {
  const allowed: Array<ProjectSettings['enabledBlockKinds'][number]> = [
    'chapter',
    'voiceover',
    'narration',
    'text-card',
    'note',
  ]

  if (!Array.isArray(value)) {
    return [...allowed]
  }

  const next = value.filter((entry): entry is ProjectSettings['enabledBlockKinds'][number] =>
    typeof entry === 'string' && allowed.includes(entry as ProjectSettings['enabledBlockKinds'][number]),
  )

  return next.length > 0 ? Array.from(new Set(next)) : [...allowed]
}

function isBoardView(value: unknown): value is ProjectSettings['defaultBoardView'] {
  return value === 'outline' || value === 'timeline' || value === 'board'
}

function normalizeStoredBoardView(value: unknown): ProjectSettings['defaultBoardView'] {
  if (!isBoardView(value)) {
    return 'outline'
  }

  return value === 'timeline' ? 'outline' : value
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
      boardX: 'boardX' in item && typeof item.boardX === 'number' ? item.boardX : item.position * 320,
      boardY: 'boardY' in item && typeof item.boardY === 'number' ? item.boardY : 0,
      boardW: 'boardW' in item && typeof item.boardW === 'number' ? item.boardW : 260,
      boardH: 'boardH' in item && typeof item.boardH === 'number' ? item.boardH : 108,
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
    boardX: 'boardX' in item && typeof item.boardX === 'number' ? item.boardX : item.position * 320,
    boardY: 'boardY' in item && typeof item.boardY === 'number' ? item.boardY : 0,
    boardW: 'boardW' in item && typeof item.boardW === 'number' ? item.boardW : 300,
    boardH: 'boardH' in item && typeof item.boardH === 'number' ? item.boardH : 132,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function buildBoardScript(board: Board, scenes: Scene[], format: BoardScriptExportFormat) {
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]))

  const sections = board.items
    .map((item) => {
      if (item.kind === 'scene') {
        const scene = sceneMap.get(item.sceneId)
        if (!scene) return null
        return formatSceneSection(scene, format)
      }

      if (item.kind === 'note') {
        return null
      }

      return formatBoardTextSection(item, format)
    })
    .filter((entry): entry is string => Boolean(entry))

  if (format === 'html-screenplay' || format === 'doc-screenplay') {
    return buildBoardScreenplayHtml(board, sections)
  }

  if (format === 'md') {
    const header = [`# ${board.name || 'Untitled Board'}`]
    if (board.description.trim()) {
      header.push('', board.description.trim())
    }
    return [...header, '', ...sections].join('\n\n').replace(/\n{3,}/g, '\n\n')
  }

  const isFormattedText = format === 'txt-formatted'
  const header = [
    isFormattedText ? centerText((board.name || 'Untitled Board').toUpperCase()) : (board.name || 'Untitled Board').toUpperCase(),
  ]
  if (board.description.trim()) {
    header.push('', ...(isFormattedText ? wrapText(board.description.trim()) : wrapText(board.description.trim(), 78)))
  }
  return [...header, '', ...sections].join('\n\n').replace(/\n{3,}/g, '\n\n')
}

function buildBoardScreenplayHtml(board: Board, sections: string[]) {
  const title = escapeHtml(board.name || 'Untitled Board')
  const description = board.description.trim() ? `<p class="description">${escapeHtml(board.description.trim())}</p>` : ''

  return `<!doctype html>
<html lang="nb">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: #f3f0ea;
        color: #111;
        font-family: "Courier Prime", "Courier New", Courier, monospace;
        line-height: 1.45;
      }
      .page {
        width: 8.5in;
        min-height: 11in;
        margin: 24px auto;
        background: #fff;
        padding: 0.9in 0.9in 1in;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.12);
      }
      .title {
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 18px;
        margin: 0 0 10px;
      }
      .description {
        margin: 0 0 34px;
        text-align: center;
        font-size: 13px;
      }
      .scene {
        margin: 0 0 26px;
      }
      .scene-heading {
        margin: 0 0 10px;
        text-transform: uppercase;
        font-size: 13px;
        letter-spacing: 0.04em;
      }
      .action {
        margin: 0;
        max-width: 6.2in;
        white-space: pre-wrap;
      }
      .center-block {
        margin: 28px auto;
        max-width: 4.6in;
        text-align: center;
      }
      .center-label {
        margin: 0 0 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 13px;
      }
      .center-body {
        margin: 0;
        white-space: pre-wrap;
      }
      .chapter {
        margin-top: 36px;
      }
      .chapter .center-label {
        font-size: 16px;
      }
      .text-card .center-label {
        letter-spacing: 0.12em;
      }
    </style>
  </head>
  <body>
    <main class="page">
      <h1 class="title">${title}</h1>
      ${description}
      ${sections.join('\n')}
    </main>
  </body>
</html>`
}

function formatSceneSection(scene: Scene, format: BoardScriptExportFormat) {
  const title = scene.title.trim() || 'Untitled Scene'
  const synopsis = scene.synopsis.trim() || scene.notes.trim() || ''

  if (format === 'html-screenplay') {
    return `<section class="scene"><h2 class="scene-heading">${escapeHtml(title)}</h2>${synopsis ? `<p class="action">${escapeHtml(synopsis)}</p>` : ''}</section>`
  }

  if (format === 'md') {
    const parts = [`## ${title}`]
    if (synopsis) {
      parts.push('', synopsis)
    }
    return parts.join('\n')
  }

  const wrappedSynopsis = wrapText(synopsis, format === 'txt-formatted' ? 64 : 78).join('\n')
  return [title, synopsis ? `\n${wrappedSynopsis}` : ''].join('')
}

function formatBoardTextSection(item: BoardTextItem, format: BoardScriptExportFormat) {
  const title = formatBlockTitle(item)
  const body = item.body.trim()

  if (format === 'html-screenplay') {
    const kindClass = item.kind.replace(/[^a-z-]/g, '')
    return `<section class="center-block ${kindClass}"><h3 class="center-label">${escapeHtml(title.toUpperCase())}</h3>${body ? `<p class="center-body">${escapeHtml(body)}</p>` : ''}</section>`
  }

  if (format === 'md') {
    switch (item.kind) {
      case 'chapter':
        return [`<div align="center">`, '', `## ${title}`, ...(body ? ['', body] : []), '', `</div>`].join('\n')
      case 'text-card':
        return [`<div align="center">`, '', `### ${title}`, ...(body ? ['', body] : []), '', `</div>`].join('\n')
      case 'voiceover':
      case 'narration':
        return [
          `<div align="center">`,
          '',
          `**${title}**`,
          '',
          body || '',
          '',
          `</div>`,
        ]
          .filter(Boolean)
          .join('\n')
      default:
        return null
    }
  }

  if (format === 'txt-plain') {
    switch (item.kind) {
      case 'chapter':
      case 'text-card':
        return [title.toUpperCase(), ...(body ? ['', ...wrapText(body, 78)] : [])].join('\n')
      case 'voiceover':
      case 'narration':
        return [
          `${title.toUpperCase()}:`,
          ...(body ? wrapText(body, 72) : []),
        ].join('\n')
      default:
        return null
    }
  }

  switch (item.kind) {
    case 'chapter':
      return [centerText(title.toUpperCase()), ...(body ? ['', ...wrapText(body).map((line) => centerText(line))] : [])].join('\n')
    case 'text-card':
      return [centerText(title.toUpperCase()), ...(body ? ['', ...wrapText(body).map((line) => centerText(line))] : [])].join('\n')
    case 'voiceover':
    case 'narration':
      return [
        centerText(title.toUpperCase()),
        body ? '' : null,
        ...(body ? wrapText(body).map((line) => centerText(line)) : []),
      ]
        .filter((line): line is string => line !== null)
        .join('\n')
    default:
      return null
  }
}

function formatBlockTitle(item: BoardTextItem) {
  if (item.kind === 'voiceover') return 'Voiceover'
  if (item.kind === 'narration') return 'Forteller'
  return item.title.trim() || fallbackBlockTitle(item.kind)
}

function fallbackBlockTitle(kind: BoardTextItem['kind']) {
  switch (kind) {
    case 'chapter':
      return 'Kapittel'
    case 'text-card':
      return 'Mellomtekst'
    case 'voiceover':
      return 'Voiceover'
    case 'narration':
      return 'Forteller'
    default:
      return ''
  }
}

function wrapText(value: string, width = 64) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const words = normalized.split(' ')
  const lines: string[] = []
  let current = ''

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > width && current) {
      lines.push(current)
      current = word
      return
    }
    current = candidate
  })

  if (current) {
    lines.push(current)
  }

  return lines
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function centerText(value: string, width = 72) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const padding = Math.max(0, Math.floor((width - trimmed.length) / 2))
  return `${' '.repeat(padding)}${trimmed}`
}

function trimForConsultant(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized
}

function isSceneColor(value: unknown): value is Scene['color'] {
  return typeof value === 'string' && [
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
  ].includes(value)
}

function isBoardTextItemKind(value: unknown): value is BoardTextItemKind {
  return typeof value === 'string' && ['chapter', 'voiceover', 'narration', 'text-card', 'note'].includes(value)
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '').trim() || 'untitled-board'
}
