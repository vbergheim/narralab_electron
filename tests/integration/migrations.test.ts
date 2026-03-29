import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'

import { runMigrations } from '../../electron/main/db/migrations'

describe('runMigrations', () => {
  it('repairs archive item foreign keys that still reference archive_folders_legacy', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docudoc-migrations-'))
    const filePath = path.join(tempDir, 'legacy.docudoc')
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
})
