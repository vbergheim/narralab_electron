import type Database from 'better-sqlite3'
import { createId, nowIso } from './helpers'
import type { TranscriptHighlight, TranscriptionItem, TranscriptionItemUpdateInput } from '@/types/transcription'

type TranscriptionItemRow = {
  id: string
  folder: string
  scene_id: string | null
  name: string
  content: string
  highlight_terms: string
  source_file_path: string | null
  created_at: string
  updated_at: string
}

export class TranscriptionLibraryRepository {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  listItems(): TranscriptionItem[] {
    const rows = this.db
      .prepare(`
        SELECT id, folder, scene_id, name, content, highlight_terms, source_file_path, created_at, updated_at
        FROM transcription_items
        ORDER BY updated_at DESC, created_at DESC
      `)
      .all() as TranscriptionItemRow[]

    return rows.map((row) => ({
      id: row.id,
      folder: row.folder ?? '',
      sceneId: row.scene_id,
      name: row.name,
      content: row.content,
      highlights: parseHighlights(row.highlight_terms),
      sourceFilePath: row.source_file_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }

  createItem(input: {
    name: string
    content: string
    folder?: string
    highlights?: TranscriptHighlight[]
    sourceFilePath?: string | null
  }): TranscriptionItem {
    const timestamp = nowIso()
    const id = createId('tx_item')
    const folder = (input.folder ?? '').trim()
    this.db
      .prepare(`
        INSERT INTO transcription_items (id, folder_id, folder, scene_id, name, content, highlight_terms, source_file_path, created_at, updated_at)
        VALUES (?, NULL, ?, NULL, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        folder,
        input.name,
        input.content,
        stringifyHighlights(input.highlights),
        input.sourceFilePath ?? null,
        timestamp,
        timestamp,
      )

    return this.getItemById(id)
  }

  updateItem(input: TranscriptionItemUpdateInput): TranscriptionItem {
    const existing = this.getItemById(input.id)
    const timestamp = nowIso()
    const merged = {
      id: existing.id,
      folder: input.folder !== undefined ? input.folder : existing.folder,
      sceneId: input.sceneId !== undefined ? input.sceneId : existing.sceneId,
      name: input.name !== undefined ? input.name : existing.name,
      content: input.content !== undefined ? input.content : existing.content,
      highlights: input.highlights !== undefined ? input.highlights : existing.highlights,
      sourceFilePath: existing.sourceFilePath,
      createdAt: existing.createdAt,
      updatedAt: timestamp,
    }

    this.db
      .prepare(`
        UPDATE transcription_items
        SET name = ?, folder = ?, scene_id = ?, content = ?, highlight_terms = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        merged.name,
        merged.folder,
        merged.sceneId,
        merged.content,
        stringifyHighlights(merged.highlights),
        merged.updatedAt,
        merged.id,
      )

    return this.getItemById(input.id)
  }

  getItemById(id: string): TranscriptionItem {
    const item = this.listItems().find((i) => i.id === id)
    if (!item) throw new Error(`Transcription item ${id} not found`)
    return item
  }

  deleteItem(itemId: string): void {
    this.db.prepare('DELETE FROM transcription_items WHERE id = ?').run(itemId)
  }
}

function parseHighlights(value: string | null | undefined): TranscriptHighlight[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is TranscriptHighlight =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        Number.isInteger((entry as { start?: unknown }).start) &&
        Number.isInteger((entry as { end?: unknown }).end),
    )
  } catch {
    return []
  }
}

function stringifyHighlights(value: TranscriptHighlight[] | null | undefined): string {
  if (!value || value.length === 0) return '[]'
  return JSON.stringify(value)
}
