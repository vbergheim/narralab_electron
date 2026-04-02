import fs from 'node:fs'
import path from 'node:path'

import type Database from 'better-sqlite3'

import type { ArchiveFolder, ArchiveFolderUpdateInput, ArchiveItem, ArchiveItemKind, ArchiveItemUpdateInput } from '@/types/archive'

import { createId, nowIso } from './helpers'

type ArchiveFolderRow = {
  id: string
  name: string
  parentId: string | null
  color: ArchiveFolder['color']
  sortOrder: number
  createdAt: string
  updatedAt: string
}

type ArchiveItemRow = {
  id: string
  folderId: string | null
  name: string
  filePath: string
  kind: ArchiveItemKind
  extension: string
  fileSize: number
  createdAt: string
  updatedAt: string
}

export class ArchiveRepository {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  listFolders(): ArchiveFolder[] {
    return this.db
      .prepare(`
        SELECT id, name, parent_id AS parentId, color, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt
        FROM archive_folders
        ORDER BY sort_order ASC, created_at ASC
      `)
      .all() as ArchiveFolderRow[]
  }

  listItems(): ArchiveItem[] {
    const rows = this.db
      .prepare(`
        SELECT
          id,
          folder_id AS folderId,
          name,
          file_path AS filePath,
          kind,
          extension,
          file_size AS fileSize,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM archive_items
        ORDER BY updated_at DESC, created_at DESC
      `)
      .all() as ArchiveItemRow[]

    return rows.map((row) => ({
      ...row,
      exists: fs.existsSync(row.filePath),
    }))
  }

  createFolder(name: string, parentId?: string | null, color?: ArchiveFolder['color']): ArchiveFolder[] {
    const nextName = name.trim()
    if (!nextName) {
      throw new Error('Folder name cannot be empty')
    }

    if (parentId && !this.listFolders().some((folder) => folder.id === parentId)) {
      throw new Error('Parent folder not found')
    }

    const existing = this.listFolders().find(
      (folder) =>
        folder.parentId === (parentId ?? null) && folder.name.toLowerCase() === nextName.toLowerCase(),
    )
    if (existing) {
      return this.listFolders()
    }

    const timestamp = nowIso()
    const sortOrder = this.listFolders().length
    this.db
      .prepare(`
        INSERT INTO archive_folders (id, name, parent_id, color, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(createId('archive_folder'), nextName, parentId ?? null, color ?? 'slate', sortOrder, timestamp, timestamp)

    return this.listFolders()
  }

  renameFolder(folderId: string, name: string): ArchiveFolder[] {
    const current = this.listFolders().find((folder) => folder.id === folderId)
    if (!current) {
      throw new Error('Archive folder not found')
    }

    const nextName = name.trim()
    if (!nextName) {
      throw new Error('Folder name cannot be empty')
    }

    const duplicate = this.listFolders().find(
      (folder) =>
        folder.id !== folderId &&
        folder.parentId === current.parentId &&
        folder.name.toLowerCase() === nextName.toLowerCase(),
    )
    if (duplicate) {
      throw new Error('A folder with that name already exists')
    }

    this.db
      .prepare('UPDATE archive_folders SET name = ?, updated_at = ? WHERE id = ?')
      .run(nextName, nowIso(), folderId)

    return this.listFolders()
  }

  updateFolder(input: ArchiveFolderUpdateInput): ArchiveFolder[] {
    const folders = this.listFolders()
    const current = folders.find((folder) => folder.id === input.id)
    if (!current) {
      throw new Error('Archive folder not found')
    }

    const nextName = input.name?.trim() || current.name
    const nextParentId = input.parentId !== undefined ? input.parentId : current.parentId
    if (!nextName) {
      throw new Error('Folder name cannot be empty')
    }

    if (nextParentId && !folders.some((folder) => folder.id === nextParentId && folder.id !== input.id)) {
      throw new Error('Parent folder not found')
    }

    if (nextParentId && isDescendantFolder(folders, nextParentId, input.id)) {
      throw new Error('Cannot move a folder into itself')
    }

    const duplicate = folders.find(
      (folder) =>
        folder.id !== input.id &&
        folder.parentId === (nextParentId ?? null) &&
        folder.name.toLowerCase() === nextName.toLowerCase(),
    )
    if (duplicate) {
      throw new Error('A folder with that name already exists')
    }

    this.db
      .prepare('UPDATE archive_folders SET name = ?, parent_id = ?, color = ?, updated_at = ? WHERE id = ?')
      .run(nextName, nextParentId ?? null, input.color ?? current.color, nowIso(), input.id)

    return this.listFolders()
  }

  deleteFolder(folderId: string): ArchiveFolder[] {
    const current = this.listFolders().find((folder) => folder.id === folderId)
    if (!current) {
      throw new Error('Archive folder not found')
    }

    const timestamp = nowIso()
    const descendantIds = [folderId, ...collectDescendantFolderIds(this.listFolders(), folderId)]
    const placeholders = descendantIds.map(() => '?').join(', ')

    this.db
      .prepare(`UPDATE archive_items SET folder_id = NULL, updated_at = ? WHERE folder_id IN (${placeholders})`)
      .run(timestamp, ...descendantIds)
    this.db.prepare(`DELETE FROM archive_folders WHERE id IN (${placeholders})`).run(...descendantIds)
    return this.listFolders()
  }

  addFiles(filePaths: string[], folderId?: string | null): ArchiveItem[] {
    const timestamp = nowIso()
    const insert = this.db.prepare(`
      INSERT INTO archive_items (
        id, folder_id, name, file_path, kind, extension, file_size, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const addedIds: string[] = []
    filePaths.forEach((filePath) => {
      const normalized = filePath.trim()
      if (!normalized) return
      const existing = this.db
        .prepare('SELECT id FROM archive_items WHERE file_path = ?')
        .get(normalized) as { id: string } | undefined
      if (existing) {
        this.db
          .prepare('UPDATE archive_items SET folder_id = ?, updated_at = ? WHERE id = ?')
          .run(folderId ?? null, timestamp, existing.id)
        addedIds.push(existing.id)
        return
      }

      const stats = safeStat(normalized)
      const id = createId('archive_item')
      insert.run(
        id,
        folderId ?? null,
        path.basename(normalized),
        normalized,
        inferArchiveKind(normalized),
        path.extname(normalized).replace('.', '').toLowerCase(),
        stats?.size ?? 0,
        timestamp,
        timestamp,
      )
      addedIds.push(id)
    })

    const items = this.listItems()
    return items.filter((item) => addedIds.includes(item.id))
  }

  updateItem(input: ArchiveItemUpdateInput): ArchiveItem {
    const current = this.listItems().find((item) => item.id === input.id)
    if (!current) {
      throw new Error('Archive item not found')
    }

    const nextName = input.name?.trim() || current.name
    const nextFolderId = input.folderId !== undefined ? input.folderId : current.folderId
    this.db
      .prepare('UPDATE archive_items SET folder_id = ?, name = ?, updated_at = ? WHERE id = ?')
      .run(nextFolderId, nextName, nowIso(), input.id)

    return this.listItems().find((item) => item.id === input.id) as ArchiveItem
  }

  deleteItem(itemId: string): void {
    this.db.prepare('DELETE FROM archive_items WHERE id = ?').run(itemId)
  }
}

function inferArchiveKind(filePath: string): ArchiveItemKind {
  const extension = path.extname(filePath).replace('.', '').toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg'].includes(extension)) return 'image'
  if (['mp3', 'wav', 'm4a', 'aiff'].includes(extension)) return 'audio'
  if (['mp4', 'mov', 'm4v', 'avi'].includes(extension)) return 'video'
  if (extension === 'pdf') return 'pdf'
  if (['csv', 'xlsx', 'xls', 'numbers'].includes(extension)) return 'spreadsheet'
  if (['txt', 'md', 'doc', 'docx', 'rtf', 'pages'].includes(extension)) return 'document'
  return 'other'
}

function safeStat(filePath: string) {
  try {
    return fs.statSync(filePath)
  } catch {
    return null
  }
}

function collectDescendantFolderIds(folders: ArchiveFolder[], folderId: string): string[] {
  const directChildren = folders.filter((folder) => folder.parentId === folderId)
  return directChildren.flatMap((folder) => [folder.id, ...collectDescendantFolderIds(folders, folder.id)])
}

function isDescendantFolder(folders: ArchiveFolder[], candidateParentId: string, folderId: string): boolean {
  if (candidateParentId === folderId) return true
  let current = folders.find((folder) => folder.id === candidateParentId) ?? null

  while (current) {
    if (current.parentId === folderId) {
      return true
    }
    current = current.parentId ? folders.find((folder) => folder.id === current?.parentId) ?? null : null
  }

  return false
}
