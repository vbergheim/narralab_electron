import type Database from 'better-sqlite3'

import type { Tag, TagType } from '@/types/tag'

import { createId } from './helpers'

export class TagRepository {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  list(): Tag[] {
    return this.db
      .prepare('SELECT id, name, type FROM tags ORDER BY name COLLATE NOCASE ASC')
      .all() as Tag[]
  }

  upsert(input: { id?: string; name: string; type?: TagType }): Tag {
    const normalizedName = input.name.trim()
    const existing = this.db
      .prepare('SELECT id, name, type FROM tags WHERE LOWER(name) = LOWER(?)')
      .get(normalizedName) as Tag | undefined

    const id = input.id ?? existing?.id ?? createId('tag')
    const type = input.type ?? existing?.type ?? 'general'

    this.db
      .prepare(`
        INSERT INTO tags (id, name, type)
        VALUES (@id, @name, @type)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          type = excluded.type
      `)
      .run({ id, name: normalizedName, type })

    return this.db
      .prepare('SELECT id, name, type FROM tags WHERE id = ?')
      .get(id) as Tag
  }

  delete(id: string) {
    this.db.prepare('DELETE FROM tags WHERE id = ?').run(id)
  }
}
