import type Database from 'better-sqlite3'

const SCHEMA_VERSION = 3

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      synopsis TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT 'charcoal',
      status TEXT NOT NULL DEFAULT 'candidate',
      is_key_scene INTEGER NOT NULL DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'general'
    );

    CREATE TABLE IF NOT EXISTS scene_tags (
      scene_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      PRIMARY KEY (scene_id, tag_id),
      FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  ensureColumn(db, 'scenes', 'is_key_scene', 'INTEGER NOT NULL DEFAULT 0')
  ensureBoardItemsTable(db)

  db.prepare(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_version', ?)`,
  ).run(String(SCHEMA_VERSION))
}

function ensureBoardItemsTable(db: Database.Database) {
  const tableExists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'board_items'`)
    .get() as { name: string } | undefined

  if (!tableExists) {
    createBoardItemsTable(db)
    return
  }

  const columns = db.prepare(`PRAGMA table_info(board_items)`).all() as Array<{ name: string }>
  const hasKind = columns.some((column) => column.name === 'kind')
  const hasTitle = columns.some((column) => column.name === 'title')
  const hasBody = columns.some((column) => column.name === 'body')
  const hasColor = columns.some((column) => column.name === 'color')

  if (hasKind && hasTitle && hasBody && hasColor) {
    ensureBoardItemIndexes(db)
    return
  }

  db.exec(`
    ALTER TABLE board_items RENAME TO board_items_legacy;
    DROP INDEX IF EXISTS idx_board_items_board_position;
  `)

  createBoardItemsTable(db)

  db.exec(`
    INSERT INTO board_items (
      id, board_id, scene_id, kind, title, body, color, position, created_at, updated_at
    )
    SELECT
      id,
      board_id,
      scene_id,
      'scene',
      '',
      '',
      'charcoal',
      position,
      created_at,
      updated_at
    FROM board_items_legacy;

    DROP TABLE board_items_legacy;
  `)

  ensureBoardItemIndexes(db)
}

function createBoardItemsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_items (
      id TEXT PRIMARY KEY,
      board_id TEXT NOT NULL,
      scene_id TEXT,
      kind TEXT NOT NULL DEFAULT 'scene',
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT 'charcoal',
      position INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
      FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
    );
  `)

  ensureBoardItemIndexes(db)
}

function ensureBoardItemIndexes(db: Database.Database) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_board_items_board_position
      ON board_items(board_id, position);

    CREATE INDEX IF NOT EXISTS idx_scene_tags_scene_tag
      ON scene_tags(scene_id, tag_id);
  `)
}

function ensureColumn(
  db: Database.Database,
  tableName: string,
  columnName: string,
  definition: string,
) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  if (!columns.some((column) => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`)
  }
}
