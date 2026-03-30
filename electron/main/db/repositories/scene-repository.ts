import type Database from 'better-sqlite3'

import { clampKeyRating } from '@/lib/scene-rating'
import type { Scene, SceneBeat, SceneBeatUpdateInput, SceneColor, SceneStatus, SceneUpdateInput } from '@/types/scene'

import { createId, nowIso } from './helpers'

type SceneRow = Omit<Scene, 'tagIds' | 'characters' | 'beats'> & {
  characters: string
  keyRating: number | boolean
}

type SceneBeatRow = SceneBeat

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
    const sceneBeats = this.db
      .prepare(`
        SELECT
          id,
          scene_id AS sceneId,
          sort_order AS sortOrder,
          text,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM scene_beats
        ORDER BY scene_id ASC, sort_order ASC, created_at ASC
      `)
      .all() as SceneBeatRow[]

    const tagsByScene = new Map<string, string[]>()
    sceneTags.forEach(({ sceneId, tagId }) => {
      const current = tagsByScene.get(sceneId) ?? []
      current.push(tagId)
      tagsByScene.set(sceneId, current)
    })

    const beatsByScene = new Map<string, SceneBeat[]>()
    sceneBeats.forEach((beat) => {
      const current = beatsByScene.get(beat.sceneId) ?? []
      current.push(beat)
      beatsByScene.set(beat.sceneId, current)
    })

    return rows.map((row) => ({
      ...row,
      keyRating: clampKeyRating(row.keyRating),
      characters: parseJsonArray(row.characters),
      tagIds: tagsByScene.get(row.id) ?? [],
      beats: beatsByScene.get(row.id) ?? [],
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

  createBeat(sceneId: string, afterBeatId?: string | null): SceneBeat {
    this.getById(sceneId)
    const beats = this.getBeatsBySceneId(sceneId)
    const nextOrder = resolveBeatInsertOrder(beats, afterBeatId)
    const timestamp = nowIso()
    const beat: SceneBeat = {
      id: createId('beat'),
      sceneId,
      sortOrder: nextOrder,
      text: '',
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    const insert = this.db.transaction(() => {
      this.shiftBeatSortOrder(sceneId, nextOrder)
      this.db
        .prepare(`
          INSERT INTO scene_beats (
            id,
            scene_id,
            sort_order,
            text,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(beat.id, beat.sceneId, beat.sortOrder, beat.text, beat.createdAt, beat.updatedAt)
    })

    insert()
    return this.getBeatById(beat.id)
  }

  updateBeat(input: SceneBeatUpdateInput): SceneBeat {
    const existing = this.getBeatById(input.id)
    const next: SceneBeat = {
      ...existing,
      ...input,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      text: typeof input.text === 'string' ? input.text : existing.text,
      updatedAt: nowIso(),
    }

    this.db
      .prepare(`
        UPDATE scene_beats
        SET
          sort_order = ?,
          text = ?,
          updated_at = ?
        WHERE id = ?
      `)
      .run(next.sortOrder, next.text, next.updatedAt, next.id)

    return this.getBeatById(next.id)
  }

  deleteBeat(id: string) {
    const beat = this.getBeatById(id)
    this.db.prepare('DELETE FROM scene_beats WHERE id = ?').run(id)
    this.normalizeBeatSortOrder(beat.sceneId)
  }

  reorderBeats(sceneId: string, beatIds: string[]) {
    this.getById(sceneId)
    const currentIds = this.getBeatsBySceneId(sceneId).map((beat) => beat.id)
    const orderedIds = beatIds.filter((id, index) => currentIds.includes(id) && beatIds.indexOf(id) === index)
    const remainingIds = currentIds.filter((id) => !orderedIds.includes(id))
    const nextIds = [...orderedIds, ...remainingIds]
    const update = this.db.prepare('UPDATE scene_beats SET sort_order = ?, updated_at = ? WHERE id = ?')
    const timestamp = nowIso()
    nextIds.forEach((id, index) => {
      update.run(index, timestamp, id)
    })
    return this.getBeatsBySceneId(sceneId)
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

  private getBeatsBySceneId(sceneId: string): SceneBeat[] {
    return this.list().find((scene) => scene.id === sceneId)?.beats ?? []
  }

  private getBeatById(id: string): SceneBeat {
    const beat = this.db
      .prepare(`
        SELECT
          id,
          scene_id AS sceneId,
          sort_order AS sortOrder,
          text,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM scene_beats
        WHERE id = ?
      `)
      .get(id) as SceneBeatRow | undefined

    if (!beat) {
      throw new Error(`Beat ${id} was not found`)
    }

    return beat
  }

  private shiftBeatSortOrder(sceneId: string, fromOrder: number) {
    this.db
      .prepare(`
        UPDATE scene_beats
        SET sort_order = sort_order + 1
        WHERE scene_id = ? AND sort_order >= ?
      `)
      .run(sceneId, fromOrder)
  }

  private normalizeBeatSortOrder(sceneId: string) {
    const beats = this.db
      .prepare(`
        SELECT id
        FROM scene_beats
        WHERE scene_id = ?
        ORDER BY sort_order ASC, created_at ASC
      `)
      .all(sceneId) as Array<{ id: string }>

    const update = this.db.prepare('UPDATE scene_beats SET sort_order = ? WHERE id = ?')
    beats.forEach((beat, index) => {
      update.run(index, beat.id)
    })
  }
}

function resolveBeatInsertOrder(beats: SceneBeat[], afterBeatId?: string | null) {
  if (!afterBeatId) {
    return beats.length
  }

  const afterBeat = beats.find((beat) => beat.id === afterBeatId)
  if (!afterBeat) {
    return beats.length
  }

  return afterBeat.sortOrder + 1
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}
