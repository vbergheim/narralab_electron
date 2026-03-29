import type Database from 'better-sqlite3'

import { clampKeyRating } from '@/lib/scene-rating'
import type { Scene, SceneColor, SceneStatus, SceneUpdateInput } from '@/types/scene'

import { createId, nowIso } from './helpers'

type SceneRow = Omit<Scene, 'tagIds' | 'characters'> & {
  characters: string
  keyRating: number | boolean
}

const defaultSceneRecord = {
  sortOrder: 0,
  title: 'Untitled scene',
  synopsis: '',
  notes: '',
  color: 'charcoal' as SceneColor,
  status: 'candidate' as SceneStatus,
  keyRating: 0,
  folder: '',
  category: '',
  estimatedDuration: 0,
  actualDuration: 0,
  location: '',
  characters: [] as string[],
  function: '',
  sourceReference: '',
}

export class SceneRepository {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  list(): Scene[] {
    const rows = this.db
      .prepare(`
        SELECT
          id,
          sort_order AS sortOrder,
          title,
          synopsis,
          notes,
          color,
          status,
          is_key_scene AS keyRating,
          folder,
          category,
          estimated_duration AS estimatedDuration,
          actual_duration AS actualDuration,
          location,
          characters,
          function,
          source_reference AS sourceReference,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM scenes
        ORDER BY sort_order ASC, updated_at DESC
      `)
      .all() as SceneRow[]

    const sceneTags = this.db
      .prepare('SELECT scene_id AS sceneId, tag_id AS tagId FROM scene_tags')
      .all() as Array<{ sceneId: string; tagId: string }>

    const tagsByScene = new Map<string, string[]>()
    sceneTags.forEach(({ sceneId, tagId }) => {
      const current = tagsByScene.get(sceneId) ?? []
      current.push(tagId)
      tagsByScene.set(sceneId, current)
    })

    return rows.map((row) => ({
      ...row,
      keyRating: clampKeyRating(row.keyRating),
      characters: parseJsonArray(row.characters),
      tagIds: tagsByScene.get(row.id) ?? [],
    }))
  }

  create(): Scene {
    const id = createId('scene')
    const timestamp = nowIso()

    this.db
      .prepare(`
        INSERT INTO scenes (
          id, sort_order, title, synopsis, notes, color, status, is_key_scene, category,
          folder,
          estimated_duration, actual_duration, location, characters,
          function, source_reference, created_at, updated_at
        ) VALUES (
          @id, @sortOrder, @title, @synopsis, @notes, @color, @status, @keyRating, @folder, @category,
          @estimatedDuration, @actualDuration, @location, @characters,
          @function, @sourceReference, @createdAt, @updatedAt
        )
      `)
      .run({
        id,
        ...defaultSceneRecord,
        sortOrder: this.getNextSortOrder(),
        keyRating: defaultSceneRecord.keyRating,
        characters: JSON.stringify(defaultSceneRecord.characters),
        createdAt: timestamp,
        updatedAt: timestamp,
      })

    return this.getById(id)
  }

  update(input: SceneUpdateInput): Scene {
    const existing = this.getById(input.id)
    const merged = {
      ...existing,
      ...input,
      updatedAt: nowIso(),
      tagIds: input.tagIds ?? existing.tagIds,
    }

    this.db
      .prepare(`
        UPDATE scenes SET
          sort_order = @sortOrder,
          title = @title,
          synopsis = @synopsis,
          notes = @notes,
          color = @color,
          status = @status,
          is_key_scene = @keyRating,
          folder = @folder,
          category = @category,
          estimated_duration = @estimatedDuration,
          actual_duration = @actualDuration,
          location = @location,
          characters = @characters,
          function = @function,
          source_reference = @sourceReference,
          updated_at = @updatedAt
        WHERE id = @id
      `)
      .run({
        ...merged,
        keyRating: clampKeyRating(merged.keyRating),
        characters: JSON.stringify(merged.characters),
      })

    if (input.tagIds) {
      this.db.prepare('DELETE FROM scene_tags WHERE scene_id = ?').run(input.id)
      const insertTag = this.db.prepare(
        'INSERT INTO scene_tags (scene_id, tag_id) VALUES (?, ?)',
      )

      merged.tagIds.forEach((tagId) => {
        insertTag.run(input.id, tagId)
      })
    }

    return this.getById(input.id)
  }

  delete(id: string) {
    this.db.prepare('DELETE FROM scenes WHERE id = ?').run(id)
  }

  reorder(sceneIds: string[]) {
    const currentIds = this.list().map((scene) => scene.id)
    const orderedIds = sceneIds.filter((id, index) => currentIds.includes(id) && sceneIds.indexOf(id) === index)
    const remainingIds = currentIds.filter((id) => !orderedIds.includes(id))
    const nextIds = [...orderedIds, ...remainingIds]

    const update = this.db.prepare('UPDATE scenes SET sort_order = ? WHERE id = ?')
    nextIds.forEach((id, index) => {
      update.run(index, id)
    })

    return this.list()
  }

  getById(id: string): Scene {
    const scene = this.list().find((entry) => entry.id === id)

    if (!scene) {
      throw new Error(`Scene ${id} was not found`)
    }

    return scene
  }

  private getNextSortOrder() {
    const row = this.db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS sortOrder FROM scenes').get() as
      | { sortOrder: number }
      | undefined
    return row?.sortOrder ?? 0
  }
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}
