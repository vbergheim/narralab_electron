import Database from 'better-sqlite3'

import { runMigrations } from './migrations'

export type ProjectDatabase = Database.Database

export function openProjectDatabase(filePath: string): ProjectDatabase {
  const db = new Database(filePath)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')
  runMigrations(db)
  return db
}
