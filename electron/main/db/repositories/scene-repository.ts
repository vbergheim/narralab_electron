import type Database from 'better-sqlite3'

import { clampKeyRating } from '@/lib/scene-rating'
import type { Scene, SceneBeat, SceneBeatUpdateInput, SceneColor, SceneStatus, SceneUpdateInput } from '@/types/scene'

import { createId, nowIso } from './helpers'

type SceneRow = Omit<Scene, 'tagIds' | 'characters' | 'beats'> & {
  characters: string
  sourcePaths: string
  keyRating: number | boolean
}

type SceneBeatRow = SceneBeat

const defaultSceneRecord = {
  sortOrder: 0,
  title: 'Untitled scene',
  synopsis: '',
  shootDate: '',
  shootBlock: '',
  notes: '',
  cameraNotes: '',
  audioNotes: '',
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
  quoteMoment: '',
  quality: '',
  sourcePaths: [] as string[],
}

export class SceneRepository {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  list(): Scene[] {
    const rows = this.listSceneRows()
    const tagsByScene = this.listSceneTagRows().reduce<Map<string, string[]>>((map, { sceneId, tagId }) => {
      const current = map.get(sceneId) ?? []
      current.push(tagId)
      map.set(sceneId, current)
      return map
    }, new Map())

    const beatsByScene = this.listSceneBeatRows().reduce<Map<string, SceneBeat[]>>((map, beat) => {
      const current = map.get(beat.sceneId) ?? []
      current.push(beat)
      map.set(beat.sceneId, current)
      return map
    }, new Map())

    return rows.map((row) => ({
      ...row,
      keyRating: clampKeyRating(row.keyRating),
      characters: parseJsonArray(row.characters),
      sourcePaths: parseJsonArray(row.sourcePaths),
      sourceReference: resolvePrimarySourceReference(row.sourceReference, row.sourcePaths),
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
          id, sort_order, title, synopsis, shoot_date, shoot_block, notes, camera_notes, audio_notes, color, status, is_key_scene, folder,
          category,
          estimated_duration, actual_duration, location, characters,
          function, source_reference, quote_moment, quality, source_paths, created_at, updated_at
        ) VALUES (
          @id, @sortOrder, @title, @synopsis, @shootDate, @shootBlock, @notes, @cameraNotes, @audioNotes, @color, @status, @keyRating, @folder, @category,
          @estimatedDuration, @actualDuration, @location, @characters,
          @function, @sourceReference, @quoteMoment, @quality, @sourcePaths, @createdAt, @updatedAt
        )
      `)
      .run({
        id,
        ...defaultSceneRecord,
        sortOrder: this.getNextSortOrder(),
        keyRating: defaultSceneRecord.keyRating,
        characters: JSON.stringify(defaultSceneRecord.characters),
        sourcePaths: JSON.stringify(defaultSceneRecord.sourcePaths),
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
      sourcePaths: normalizeStringArray(input.sourcePaths ?? existing.sourcePaths),
    }
    const sourceReference = resolvePrimarySourceReference(input.sourceReference ?? existing.sourceReference, merged.sourcePaths)

    this.db
      .prepare(`
        UPDATE scenes SET
          sort_order = @sortOrder,
          title = @title,
          synopsis = @synopsis,
          shoot_date = @shootDate,
          shoot_block = @shootBlock,
          notes = @notes,
          camera_notes = @cameraNotes,
          audio_notes = @audioNotes,
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
          quote_moment = @quoteMoment,
          quality = @quality,
          source_paths = @sourcePaths,
          updated_at = @updatedAt
        WHERE id = @id
      `)
      .run({
        ...merged,
        sourceReference,
        keyRating: clampKeyRating(merged.keyRating),
        characters: JSON.stringify(merged.characters),
        sourcePaths: JSON.stringify(merged.sourcePaths),
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
    const currentIds = this.listSceneIds()
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
    const row = this.db
      .prepare(`
        SELECT
          id,
          sort_order AS sortOrder,
          title,
          synopsis,
          shoot_date AS shootDate,
          shoot_block AS shootBlock,
          notes,
          camera_notes AS cameraNotes,
          audio_notes AS audioNotes,
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
          quote_moment AS quoteMoment,
          quality,
          source_paths AS sourcePaths,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM scenes
        WHERE id = ?
      `)
      .get(id) as SceneRow | undefined

    if (!row) {
      throw new Error(`Scene ${id} was not found`)
    }

    return {
      ...row,
      keyRating: clampKeyRating(row.keyRating),
      characters: parseJsonArray(row.characters),
      sourcePaths: parseJsonArray(row.sourcePaths),
      sourceReference: resolvePrimarySourceReference(row.sourceReference, row.sourcePaths),
      tagIds: this.getTagIdsBySceneId(id),
      beats: this.getBeatsBySceneId(id),
    }
  }

  private getNextSortOrder() {
    const row = this.db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS sortOrder FROM scenes').get() as
      | { sortOrder: number }
      | undefined
    return row?.sortOrder ?? 0
  }

  private getBeatsBySceneId(sceneId: string): SceneBeat[] {
    return this.db
      .prepare(`
        SELECT
          id,
          scene_id AS sceneId,
          sort_order AS sortOrder,
          text,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM scene_beats
        WHERE scene_id = ?
        ORDER BY sort_order ASC, created_at ASC
      `)
      .all(sceneId) as SceneBeat[]
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

  private getTagIdsBySceneId(sceneId: string) {
    return this.db
      .prepare('SELECT tag_id AS tagId FROM scene_tags WHERE scene_id = ? ORDER BY rowid ASC')
      .all(sceneId)
      .map((row) => (row as { tagId: string }).tagId)
  }

  private listSceneIds() {
    return this.db
      .prepare('SELECT id FROM scenes ORDER BY sort_order ASC, updated_at DESC')
      .all()
      .map((row) => (row as { id: string }).id)
  }

  private listSceneRows() {
    return this.db
      .prepare(`
        SELECT
          id,
          sort_order AS sortOrder,
          title,
          synopsis,
          shoot_date AS shootDate,
          shoot_block AS shootBlock,
          notes,
          camera_notes AS cameraNotes,
          audio_notes AS audioNotes,
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
          quote_moment AS quoteMoment,
          quality,
          source_paths AS sourcePaths,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM scenes
        ORDER BY sort_order ASC, updated_at DESC
      `)
      .all() as SceneRow[]
  }

  private listSceneTagRows() {
    return this.db
      .prepare('SELECT scene_id AS sceneId, tag_id AS tagId FROM scene_tags')
      .all() as Array<{ sceneId: string; tagId: string }>
  }

  private listSceneBeatRows() {
    return this.db
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
    return Array.isArray(parsed) ? normalizeStringArray(parsed.filter((item) => typeof item === 'string')) : []
  } catch {
    return []
  }
}

function normalizeStringArray(values: string[]) {
  const normalized: string[] = []
  const seen = new Set<string>()

  values.forEach((value) => {
    const trimmed = value.trim()
    if (!trimmed) return
    const display = trimmed.replace(/\\/g, '/')
    const key = display.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    normalized.push(display)
  })

  return normalized
}

function resolvePrimarySourceReference(sourceReference: string, sourcePathsRaw: string | string[]) {
  const sourcePaths = Array.isArray(sourcePathsRaw) ? normalizeStringArray(sourcePathsRaw) : parseJsonArray(sourcePathsRaw)
  return sourcePaths[0] ?? sourceReference
}
