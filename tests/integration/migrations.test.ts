import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import { runMigrations } from '../../electron/main/db/migrations'

describe('runMigrations', () => {
  it('repairs archive item foreign keys that still reference archive_folders_legacy', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'narralab-migrations-'))
    const filePath = path.join(tempDir, 'legacy.narralab')
    const db = new Database(filePath)

    try {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE archive_folders (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          parent_id TEXT,
          color TEXT NOT NULL DEFAULT 'slate',
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE archive_items (
          id TEXT PRIMARY KEY,
          folder_id TEXT,
          name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          kind TEXT NOT NULL DEFAULT 'document',
          extension TEXT NOT NULL DEFAULT '',
          file_size INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (folder_id) REFERENCES archive_folders_legacy(id) ON DELETE SET NULL
        );
        PRAGMA foreign_keys = ON;
      `)

      runMigrations(db)

      const archiveItemsSql = (
        db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'archive_items'`).get() as
          | { sql: string }
          | undefined
      )?.sql
      const projectSettingsRow = db.prepare('SELECT COUNT(*) AS count FROM project_settings WHERE id = 1').get() as {
        count: number
      }

      expect(archiveItemsSql).toContain('REFERENCES archive_folders(id)')
      expect(archiveItemsSql).not.toContain('archive_folders_legacy')
      expect(projectSettingsRow.count).toBe(1)
    } finally {
      db.close()
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('adds new scene metadata columns and backfills source_paths from source_reference', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'narralab-migrations-'))
    const filePath = path.join(tempDir, 'legacy-scenes.narralab')
    const db = new Database(filePath)

    try {
      db.exec(`
        CREATE TABLE scenes (
          id TEXT PRIMARY KEY,
          sort_order INTEGER NOT NULL DEFAULT 0,
          title TEXT NOT NULL,
          synopsis TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          color TEXT NOT NULL DEFAULT 'charcoal',
          status TEXT NOT NULL DEFAULT 'candidate',
          is_key_scene INTEGER NOT NULL DEFAULT 0,
          folder TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT '',
          estimated_duration INTEGER NOT NULL DEFAULT 0,
          actual_duration INTEGER NOT NULL DEFAULT 0,
          location TEXT NOT NULL DEFAULT '',
          characters TEXT NOT NULL DEFAULT '[]',
          function TEXT NOT NULL DEFAULT '',
          source_reference TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO scenes (
          id, title, source_reference, created_at, updated_at
        ) VALUES (
          'scene_1', 'Legacy scene', 'legacy/source.mov', '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'
        );
      `)

      runMigrations(db)

      const scene = db.prepare(`
        SELECT
          shoot_day_place AS shootDayPlace,
          shoot_day_description AS shootDayDescription,
          source_reference AS sourceReference,
          quote_moment AS quoteMoment,
          quality,
          source_paths AS sourcePaths
        FROM scenes
        WHERE id = 'scene_1'
      `).get() as {
        shootDayPlace: string
        shootDayDescription: string
        sourceReference: string
        quoteMoment: string
        quality: string
        sourcePaths: string
      }

      expect(scene.shootDayPlace).toBe('')
      expect(scene.shootDayDescription).toBe('')
      expect(scene.sourceReference).toBe('legacy/source.mov')
      expect(scene.quoteMoment).toBe('')
      expect(scene.quality).toBe('')
      expect(scene.sourcePaths).toBe('["legacy/source.mov"]')

      runMigrations(db)
      const rerun = db.prepare(`SELECT source_paths AS sourcePaths FROM scenes WHERE id = 'scene_1'`).get() as {
        sourcePaths: string
      }
      expect(rerun.sourcePaths).toBe('["legacy/source.mov"]')
    } finally {
      db.close()
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
