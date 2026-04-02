import fs from 'node:fs'
import path from 'node:path'

import { app, dialog, shell } from 'electron'

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
  ShootLogImportResult,
} from '@/types/project'
import type { Scene, SceneBeat, SceneBeatUpdateInput, SceneFolder, SceneUpdateInput } from '@/types/scene'
import type { Tag, TagType } from '@/types/tag'
import type { TranscriptionFolder, TranscriptionItem, TranscriptionItemUpdateInput } from '@/types/transcription'

import { openProjectDatabase, type ProjectDatabase } from './db/connection'
import { ArchiveRepository } from './db/repositories/archive-repository'
import { BoardRepository } from './db/repositories/board-repository'
import { ProjectMetadataRepository } from './db/repositories/project-metadata-repository'
import {
  buildFolderPath,
  getFolderNameFromPath,
  isFolderWithinPath,
  makeFolderRecord,
  normalizeFolderPath,
  normalizeNullableFolderPath,
  normalizeStoredFolders,
  parseStoredFolders,
  replaceFolderPathPrefix,
} from './folder-utils'
import { NotebookService } from './notebook-service'
import {
  defaultProjectSettings,
  normalizeBlockKindList,
  normalizeStoredBoardView,
  parseBlockKindList,
  ProjectExchangeService,
} from './project-exchange'
import { SceneRepository } from './db/repositories/scene-repository'
import { TagRepository } from './db/repositories/tag-repository'
import { TranscriptionLibraryRepository } from './db/repositories/transcription-library-repository'
import { importShootLogWorkbook } from './shoot-log-import'

type Repositories = {
  archive: ArchiveRepository
  scenes: SceneRepository
  boards: BoardRepository
  tags: TagRepository
  metadata: ProjectMetadataRepository
  notebook: NotebookService
  transcriptionLibrary: TranscriptionLibraryRepository
}

export class ProjectService {
  private db: ProjectDatabase | null = null
  private repositories: Repositories | null = null
  private currentPath: string | null = null
  private readonly exchangeService = new ProjectExchangeService({
    ensureDatabase: () => this.ensureDatabase(),
    getMeta: () => this.getMeta(),
    getProjectSettings: () => this.getProjectSettings(),
    listScenes: () => this.listScenes(),
    listTags: () => this.listTags(),
    listBoards: () => this.listBoards(),
    getNotebook: () => this.getNotebook(),
    updateProjectSettings: (input) => this.updateProjectSettings(input),
    updateNotebook: (document) => this.updateNotebook(document),
  })

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
    const filePath = resolveOpenProjectFilePath(requestedPath ?? (await this.pickOpenProjectPath()))
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
        defaultPath: this.getMeta() ? `${this.getMeta()?.name}.json` : 'narralab-export.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      }).then((result) => (result.canceled ? null : result.filePath)))

    if (!targetPath) return null

    const snapshot = this.exchangeService.getSnapshot()
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

    const content = this.exchangeService.renderBoardScript(board, format)
    fs.writeFileSync(targetPath, content, 'utf8')
    return targetPath
  }

  async importJson(requestedPath?: string | null) {
    const sourcePath =
      requestedPath ??
      (await dialog.showOpenDialog({
        title: 'Import JSON',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      }).then((result) => (result.canceled ? null : result.filePaths[0] ?? null)))

    if (!sourcePath) return null

    let raw: string
    try {
      raw = fs.readFileSync(sourcePath, 'utf8')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ukjent feil'
      throw new Error(`Kunne ikke lese JSON-filen: ${message}`)
    }

    let snapshot: ProjectSnapshot
    try {
      snapshot = JSON.parse(raw) as ProjectSnapshot
    } catch {
      throw new Error('Filen er ikke gyldig JSON.')
    }

    this.exchangeService.replaceWithSnapshot(snapshot)
    return this.getMeta()
  }

  async importShootLog(requestedPath?: string | null): Promise<ShootLogImportResult | null> {
    const sourcePath =
      requestedPath ??
      (await dialog.showOpenDialog({
        title: 'Import Shoot Log',
        properties: ['openFile'],
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
      }).then((result) => (result.canceled ? null : result.filePaths[0] ?? null)))

    if (!sourcePath) return null

    return importShootLogWorkbook(this.ensureDatabase(), sourcePath)
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

  async saveTranscriptionToArchive(name: string, content: string): Promise<ArchiveItem | null> {
    const meta = this.getMeta()
    const fileName = `${sanitizeFileName(name || 'transcript')}.md`
    const defaultPath = meta?.path ? path.join(path.dirname(meta.path), fileName) : fileName

    const res = await dialog.showSaveDialog({
      title: 'Save Transcript to Archive',
      defaultPath,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })

    if (res.canceled || !res.filePath) {
      return null
    }

    const filePath = res.filePath
    await fs.promises.writeFile(filePath, content, 'utf8')

    const added = this.ensureRepositories().archive.addFiles([filePath])
    return added[0] ?? null
  }

  revealArchiveItem(itemId: string): void {
    const item = this.listArchiveItems().find((entry) => entry.id === itemId)
    if (!item) throw new Error('Archive item not found')
    shell.showItemInFolder(item.filePath)
  }

  listTranscriptionFolders(): TranscriptionFolder[] {
    const storedValue = this.ensureRepositories().metadata.getTranscriptionFolders()
    const storedFolders = parseStoredFolders<TranscriptionFolder>(storedValue)
    const itemFolderPaths = Array.from(
      new Set(
        this.listTranscriptionItems()
          .map((item) => item.folder.trim())
          .filter(Boolean),
      ),
    )

    const merged = [...storedFolders]
    itemFolderPaths.forEach((folderPath) => {
      const normalizedPath = normalizeFolderPath(folderPath)
      if (!normalizedPath) return
      if (!merged.some((folder) => folder.path.toLowerCase() === normalizedPath.toLowerCase())) {
        merged.push(makeFolderRecord<TranscriptionFolder>(normalizedPath, 'slate', merged.length))
      }
    })

    return normalizeStoredFolders(merged)
  }

  createTranscriptionFolder(name: string, parentPath?: string | null): TranscriptionFolder[] {
    const nextName = name.trim()
    if (!nextName) {
      throw new Error('Folder name cannot be empty')
    }

    const folders = this.listTranscriptionFolders()
    const normalizedParentPath = normalizeNullableFolderPath(parentPath)
    if (normalizedParentPath && !folders.some((folder) => folder.path.toLowerCase() === normalizedParentPath.toLowerCase())) {
      throw new Error('Parent folder not found')
    }

    const nextPath = buildFolderPath(nextName, normalizedParentPath)
    if (folders.some((folder) => folder.path.toLowerCase() === nextPath.toLowerCase())) {
      return folders
    }

    const nextFolders = normalizeStoredFolders([...folders, makeFolderRecord<TranscriptionFolder>(nextPath, 'slate', folders.length)])
    this.setTranscriptionFolders(nextFolders)
    return nextFolders
  }

  updateTranscriptionFolder(
    currentPath: string,
    input: { name?: string; color?: Scene['color']; parentPath?: string | null },
  ): TranscriptionFolder[] {
    const previousPath = normalizeFolderPath(currentPath)
    const requestedName = input.name?.trim()
    if (!previousPath) {
      throw new Error('Folder name cannot be empty')
    }

    const folders = this.listTranscriptionFolders()
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

    const nextFolders = normalizeStoredFolders(
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

    const items = this.listTranscriptionItems().filter((item) => isFolderWithinPath(item.folder, previousPath))
    items.forEach((item) => {
      this.ensureRepositories().transcriptionLibrary.updateItem({
        id: item.id,
        folder: replaceFolderPathPrefix(item.folder, previousPath, nextPath),
      })
    })

    this.setTranscriptionFolders(nextFolders)
    return nextFolders
  }

  deleteTranscriptionFolder(currentPath: string): TranscriptionFolder[] {
    const previousPath = normalizeFolderPath(currentPath)
    if (!previousPath) {
      throw new Error('Folder name cannot be empty')
    }

    const folders = this.listTranscriptionFolders()
    const current = folders.find((folder) => folder.path.toLowerCase() === previousPath.toLowerCase())
    if (!current) {
      throw new Error('Folder not found')
    }

    const nextFolders = normalizeStoredFolders(
      folders.filter((folder) => !isFolderWithinPath(folder.path, previousPath)),
    )

    const items = this.listTranscriptionItems().filter((item) => isFolderWithinPath(item.folder, previousPath))
    items.forEach((item) => {
      this.ensureRepositories().transcriptionLibrary.updateItem({ id: item.id, folder: '' })
    })

    this.setTranscriptionFolders(nextFolders)
    return nextFolders
  }

  listTranscriptionItems(): TranscriptionItem[] {
    return this.ensureRepositories().transcriptionLibrary.listItems()
  }

  createTranscriptionItem(input: {
    name: string
    content: string
    folder?: string
    sourceFilePath?: string | null
  }): TranscriptionItem {
    const folder = normalizeFolderPath(input.folder)
    if (folder) {
      this.ensureTranscriptionFolder(folder)
    }
    return this.ensureRepositories().transcriptionLibrary.createItem({
      ...input,
      folder,
    })
  }

  updateTranscriptionItem(input: TranscriptionItemUpdateInput): TranscriptionItem {
    if (input.folder !== undefined) {
      const next = normalizeFolderPath(input.folder)
      if (next) {
        this.ensureTranscriptionFolder(next)
      }
      return this.ensureRepositories().transcriptionLibrary.updateItem({ ...input, folder: next })
    }
    return this.ensureRepositories().transcriptionLibrary.updateItem(input)
  }

  deleteTranscriptionItem(itemId: string): void {
    this.ensureRepositories().transcriptionLibrary.deleteItem(itemId)
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
    const storedValue = this.ensureRepositories().metadata.getSceneFolders()
    const storedFolders = parseStoredFolders<SceneFolder>(storedValue)
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
        merged.push(makeFolderRecord<SceneFolder>(normalizedPath, 'slate', merged.length))
      }
    })

    return normalizeStoredFolders(merged)
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

    const nextFolders = normalizeStoredFolders([...folders, makeFolderRecord<SceneFolder>(nextPath, 'slate', folders.length)])
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

    const nextFolders = normalizeStoredFolders(
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

    const nextFolders = normalizeStoredFolders(
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
    const storedValue = this.ensureRepositories().metadata.getBlockTemplates()
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
    const storedValue = this.ensureRepositories().metadata.getBoardFolders()
    const storedFolders = parseStoredFolders<BoardFolder>(storedValue)
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
        merged.push(makeFolderRecord<BoardFolder>(normalizedPath, 'slate', merged.length))
      }
    })

    return normalizeStoredFolders(merged)
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

    const nextFolders = normalizeStoredFolders([...folders, makeFolderRecord<BoardFolder>(nextPath, 'slate', folders.length)])
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

    const nextFolders = normalizeStoredFolders(
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

    const nextFolders = normalizeStoredFolders(
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

  getSnapshot() {
    return this.exchangeService.getSnapshot()
  }

  getConsultantContext(activeBoardId: string | null) {
    return this.exchangeService.getConsultantContext(activeBoardId)
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
    const metadata = new ProjectMetadataRepository(this.db)
    this.repositories = {
      archive: new ArchiveRepository(this.db),
      scenes: new SceneRepository(this.db),
      boards: new BoardRepository(this.db),
      tags: new TagRepository(this.db),
      metadata,
      notebook: new NotebookService(metadata),
      transcriptionLibrary: new TranscriptionLibraryRepository(this.db),
    }
  }

  getNotebook(): NotebookDocument {
    return this.ensureRepositories().notebook.get()
  }

  updateNotebook(document: NotebookDocument): NotebookDocument {
    return this.ensureRepositories().notebook.update(document)
  }

  appendNotebookPlainText(text: string): NotebookDocument {
    return this.ensureRepositories().notebook.appendPlainText(text)
  }

  private ensureBoardFolder(path: string) {
    const nextPath = normalizeFolderPath(path)
    if (!nextPath) return

    const folders = this.listBoardFolders()
    if (folders.some((folder) => folder.path.toLowerCase() === nextPath.toLowerCase())) {
      return
    }

    this.setBoardFolders([...folders, makeFolderRecord<BoardFolder>(nextPath, 'slate', folders.length)])
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
    this.ensureRepositories().metadata.setBoardFolders(JSON.stringify(normalizeStoredFolders(folders)))
  }

  private setSceneFolders(folders: SceneFolder[]) {
    this.ensureRepositories().metadata.setSceneFolders(JSON.stringify(normalizeStoredFolders(folders)))
  }

  private ensureTranscriptionFolder(path: string) {
    const nextPath = normalizeFolderPath(path)
    if (!nextPath) return

    const folders = this.listTranscriptionFolders()
    if (folders.some((folder) => folder.path.toLowerCase() === nextPath.toLowerCase())) {
      return
    }

    this.setTranscriptionFolders([...folders, makeFolderRecord<TranscriptionFolder>(nextPath, 'slate', folders.length)])
  }

  private setTranscriptionFolders(folders: TranscriptionFolder[]) {
    this.ensureRepositories().metadata.setTranscriptionFolders(
      JSON.stringify(normalizeStoredFolders(folders)),
    )
  }

  private setBlockTemplates(templates: BlockTemplate[]) {
    this.ensureRepositories().metadata.setBlockTemplates(JSON.stringify(normalizeBlockTemplates(templates)))
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
      defaultPath: meta?.path ?? path.join(app.getPath('documents'), 'Untitled.narralab'),
      filters: [
        { name: 'NarraLab Project', extensions: ['narralab'] },
        { name: 'Legacy NarraLab Project', extensions: ['docudoc'] },
      ],
    })

    return result.canceled ? null : result.filePath ?? null
  }

  private async pickOpenProjectPath() {
    const result = await dialog.showOpenDialog({
      title: 'Open Project',
      properties: ['openFile'],
      filters: [
        { name: 'NarraLab Projects', extensions: ['narralab', 'docudoc', 'sqlite'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })

    return result.canceled ? null : result.filePaths[0] ?? null
  }
}

function normalizeProjectFilePath(filePath: string | null) {
  if (!filePath) {
    return null
  }

  if (
    filePath.endsWith('.narralab') ||
    filePath.endsWith('.narralab.sqlite') ||
    filePath.endsWith('.docudoc') ||
    filePath.endsWith('.docudoc.sqlite')
  ) {
    return filePath
  }

  return `${filePath}.narralab`
}

function resolveOpenProjectFilePath(filePath: string | null) {
  if (!filePath) {
    return null
  }

  if (fs.existsSync(filePath)) {
    return filePath
  }

  const candidates = [
    filePath,
    `${filePath}.narralab`,
    `${filePath}.docudoc`,
    `${filePath}.sqlite`,
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? filePath
}

function toProjectDisplayName(filePath: string) {
  return path
    .basename(filePath)
    .replace(/\.narralab\.sqlite$/i, '')
    .replace(/\.narralab$/i, '')
    .replace(/\.docudoc\.sqlite$/i, '')
    .replace(/\.docudoc$/i, '')
    .replace(/\.sqlite$/i, '')
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

function isBoardTextItemKind(value: unknown): value is BoardTextItemKind {
  return typeof value === 'string' && ['chapter', 'voiceover', 'narration', 'text-card', 'note'].includes(value)
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, '').trim() || 'untitled-board'
}
