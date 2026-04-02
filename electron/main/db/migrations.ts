import type Database from 'better-sqlite3'

const SCHEMA_VERSION = 15

export function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scenes (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      synopsis TEXT NOT NULL DEFAULT '',
      shoot_date TEXT NOT NULL DEFAULT '',
      shoot_block TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      camera_notes TEXT NOT NULL DEFAULT '',
      audio_notes TEXT NOT NULL DEFAULT '',
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
      quote_moment TEXT NOT NULL DEFAULT '',
      quality TEXT NOT NULL DEFAULT '',
      source_paths TEXT NOT NULL DEFAULT '[]',
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

    CREATE TABLE IF NOT EXISTS scene_beats (
      id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS boards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT 'charcoal',
      folder TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS archive_folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      color TEXT NOT NULL DEFAULT 'slate',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES archive_folders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS archive_items (
      id TEXT PRIMARY KEY,
      folder_id TEXT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'document',
      extension TEXT NOT NULL DEFAULT '',
      file_size INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES archive_folders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS project_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      title TEXT NOT NULL DEFAULT '',
      genre TEXT NOT NULL DEFAULT '',
      format TEXT NOT NULL DEFAULT '',
      target_runtime_minutes INTEGER NOT NULL DEFAULT 90,
      logline TEXT NOT NULL DEFAULT '',
      default_board_view TEXT NOT NULL DEFAULT 'outline',
      enabled_block_kinds TEXT NOT NULL DEFAULT '["chapter","voiceover","narration","text-card","note"]',
      block_kind_order TEXT NOT NULL DEFAULT '["chapter","voiceover","narration","text-card","note"]',
      updated_at TEXT NOT NULL DEFAULT ''
    );
 
    CREATE TABLE IF NOT EXISTS transcription_folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      color TEXT NOT NULL DEFAULT 'slate',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES transcription_folders(id) ON DELETE SET NULL
    );
 
    CREATE TABLE IF NOT EXISTS transcription_items (
      id TEXT PRIMARY KEY,
      folder_id TEXT,
      scene_id TEXT,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      source_file_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES transcription_folders(id) ON DELETE SET NULL,
      FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE SET NULL
    );
  `)

  ensureColumn(db, 'scenes', 'is_key_scene', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'scenes', 'sort_order', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'scenes', 'shoot_date', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'scenes', 'shoot_block', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'scenes', 'folder', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'scenes', 'camera_notes', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'scenes', 'audio_notes', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'scenes', 'quote_moment', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'scenes', 'quality', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'scenes', 'source_paths', `TEXT NOT NULL DEFAULT '[]'`)
  backfillSceneSourcePaths(db)
  ensureColumn(db, 'boards', 'description', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'boards', 'color', "TEXT NOT NULL DEFAULT 'charcoal'")
  ensureColumn(db, 'boards', 'folder', "TEXT NOT NULL DEFAULT ''")
  ensureColumn(db, 'boards', 'sort_order', 'INTEGER NOT NULL DEFAULT 0')
  ensureColumn(db, 'archive_folders', 'color', "TEXT NOT NULL DEFAULT 'slate'")
  ensureColumn(db, 'archive_folders', 'parent_id', 'TEXT')
  ensureArchiveFolderHierarchy(db)
  ensureArchiveItemsForeignKey(db)
  ensureSceneBeatsTable(db)
  normalizeSceneSortOrder(db)
  normalizeBoardSortOrder(db)
  ensureBoardItemsTable(db)
  ensureArchiveIndexes(db)
  ensureProjectSettingsRow(db)
  migrateTranscriptionLibraryToPathModel(db)

  db.prepare(
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('schema_version', ?)`,
  ).run(String(SCHEMA_VERSION))
}

function normalizeSceneSortOrder(db: Database.Database) {
  const scenes = db
    .prepare(`
      SELECT id
      FROM scenes
      ORDER BY sort_order ASC, updated_at DESC, id ASC
    `)
    .all() as Array<{ id: string }>

  const update = db.prepare('UPDATE scenes SET sort_order = ? WHERE id = ?')
  scenes.forEach((scene, index) => {
    update.run(index, scene.id)
  })
}

function ensureSceneBeatsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scene_beats (
      id TEXT PRIMARY KEY,
      scene_id TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      text TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_scene_beats_scene_sort
      ON scene_beats(scene_id, sort_order);
  `)
}

function normalizeBoardSortOrder(db: Database.Database) {
  const boards = db
    .prepare(`
      SELECT id
      FROM boards
      ORDER BY sort_order ASC, created_at ASC, id ASC
    `)
    .all() as Array<{ id: string }>

  const update = db.prepare('UPDATE boards SET sort_order = ? WHERE id = ?')
  boards.forEach((board, index) => {
    update.run(index, board.id)
  })
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
  const hasBoardX = columns.some((column) => column.name === 'board_x')
  const hasBoardY = columns.some((column) => column.name === 'board_y')
  const hasBoardW = columns.some((column) => column.name === 'board_w')
  const hasBoardH = columns.some((column) => column.name === 'board_h')

  if (hasKind && hasTitle && hasBody && hasColor && hasBoardX && hasBoardY && hasBoardW && hasBoardH) {
    ensureBoardItemIndexes(db)
    return
  }

  if (hasKind && hasTitle && hasBody && hasColor) {
    ensureColumn(db, 'board_items', 'board_x', 'REAL NOT NULL DEFAULT 0')
    ensureColumn(db, 'board_items', 'board_y', 'REAL NOT NULL DEFAULT 0')
    ensureColumn(db, 'board_items', 'board_w', 'REAL NOT NULL DEFAULT 300')
    ensureColumn(db, 'board_items', 'board_h', 'REAL NOT NULL DEFAULT 132')
    seedBoardCoordinates(db)
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
      id, board_id, scene_id, kind, title, body, color, position, board_x, board_y, board_w, board_h, created_at, updated_at
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
      position * 320,
      0,
      300,
      132,
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
      board_x REAL NOT NULL DEFAULT 0,
      board_y REAL NOT NULL DEFAULT 0,
      board_w REAL NOT NULL DEFAULT 300,
      board_h REAL NOT NULL DEFAULT 132,
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

    CREATE INDEX IF NOT EXISTS idx_scene_beats_scene_sort
      ON scene_beats(scene_id, sort_order);
  `)
}

function ensureArchiveIndexes(db: Database.Database) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_archive_folders_sort_order
      ON archive_folders(sort_order);

    CREATE INDEX IF NOT EXISTS idx_archive_folders_parent_sort
      ON archive_folders(parent_id, sort_order);

    CREATE INDEX IF NOT EXISTS idx_archive_items_folder_name
      ON archive_items(folder_id, name);
  `)
}

function ensureArchiveFolderHierarchy(db: Database.Database) {
  const createSql = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'archive_folders'`)
    .get() as { sql?: string } | undefined

  if (!createSql?.sql?.includes('UNIQUE')) {
    return
  }

  db.exec(`
    PRAGMA foreign_keys = OFF;

    ALTER TABLE archive_folders RENAME TO archive_folders_legacy;

    CREATE TABLE archive_folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parent_id TEXT,
      color TEXT NOT NULL DEFAULT 'slate',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES archive_folders(id) ON DELETE SET NULL
    );

    INSERT INTO archive_folders (id, name, parent_id, color, sort_order, created_at, updated_at)
    SELECT id, name, parent_id, color, sort_order, created_at, updated_at
    FROM archive_folders_legacy;

    DROP TABLE archive_folders_legacy;

    PRAGMA foreign_keys = ON;
  `)
}

function ensureArchiveItemsForeignKey(db: Database.Database) {
  const createSql = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'archive_items'`)
    .get() as { sql?: string } | undefined

  if (!createSql?.sql) {
    return
  }

  if (
    createSql.sql.includes('REFERENCES archive_folders(id)') &&
    !createSql.sql.includes('archive_folders_legacy')
  ) {
    return
  }

  db.exec(`
    PRAGMA foreign_keys = OFF;

    ALTER TABLE archive_items RENAME TO archive_items_legacy;

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
      FOREIGN KEY (folder_id) REFERENCES archive_folders(id) ON DELETE SET NULL
    );

    INSERT INTO archive_items (
      id, folder_id, name, file_path, kind, extension, file_size, created_at, updated_at
    )
    SELECT
      id, folder_id, name, file_path, kind, extension, file_size, created_at, updated_at
    FROM archive_items_legacy;

    DROP TABLE archive_items_legacy;

    PRAGMA foreign_keys = ON;
  `)
}

const TRANSCRIPTION_PATH_MIGRATION_META_KEY = 'transcription_library_path_model_v1'

function normalizeTranscriptionPathSegments(value: string): string {
  return value
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/')
}

/** Move transcription library from SQL folder IDs to path strings + app_meta (Scene Bank model). */
function migrateTranscriptionLibraryToPathModel(db: Database.Database) {
  ensureColumn(db, 'transcription_items', 'folder', "TEXT NOT NULL DEFAULT ''")

  const flag = db.prepare(`SELECT value FROM app_meta WHERE key = ?`).get(TRANSCRIPTION_PATH_MIGRATION_META_KEY) as
    | { value: string }
    | undefined
  if (flag) return

  type FolderRow = { id: string; name: string; parent_id: string | null }
  let folderRows: FolderRow[] = []
  try {
    folderRows = db.prepare(`SELECT id, name, parent_id FROM transcription_folders`).all() as FolderRow[]
  } catch {
    folderRows = []
  }

  const memo = new Map<string, string>()

  function pathForFolderId(id: string): string {
    if (memo.has(id)) return memo.get(id)!
    const row = folderRows.find((r) => r.id === id)
    if (!row) {
      memo.set(id, '')
      return ''
    }
    const seg = normalizeTranscriptionPathSegments(row.name)
    if (!row.parent_id) {
      memo.set(id, seg)
      return seg
    }
    const parentPath = pathForFolderId(row.parent_id)
    const full = parentPath ? `${parentPath}/${seg}` : seg
    memo.set(id, full)
    return full
  }

  folderRows.forEach((r) => pathForFolderId(r.id))

  const items = db
    .prepare(`SELECT id, folder_id FROM transcription_items`)
    .all() as Array<{ id: string; folder_id: string | null }>
  const updateItemFolder = db.prepare(`UPDATE transcription_items SET folder = ? WHERE id = ?`)
  for (const item of items) {
    let folderPath = ''
    if (item.folder_id) {
      folderPath = normalizeTranscriptionPathSegments(pathForFolderId(item.folder_id))
    }
    updateItemFolder.run(folderPath, item.id)
  }

  try {
    db.exec(`UPDATE transcription_items SET folder_id = NULL`)
  } catch {
    /* ignore if column missing */
  }

  const pathSet = new Set<string>()
  for (const r of folderRows) {
    const p = normalizeTranscriptionPathSegments(pathForFolderId(r.id))
    if (p) pathSet.add(p)
  }

  const readMeta = db.prepare(`SELECT value FROM app_meta WHERE key = ?`)
  const metaRow = readMeta.get('transcription_folders') as { value: string } | undefined
  const merged: Array<{
    path: string
    name: string
    parentPath: string | null
    color: string
    sortOrder: number
  }> = []
  if (metaRow?.value) {
    try {
      const parsed = JSON.parse(metaRow.value)
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (!entry || typeof entry !== 'object') continue
          const e = entry as Record<string, unknown>
          const path =
            typeof e.path === 'string'
              ? normalizeTranscriptionPathSegments(e.path)
              : typeof e.name === 'string'
                ? normalizeTranscriptionPathSegments(e.name)
                : ''
          if (!path) continue
          merged.push({
            path,
            name: typeof e.name === 'string' ? e.name : path.split('/').pop() ?? path,
            parentPath:
              typeof e.parentPath === 'string' && e.parentPath.trim()
                ? normalizeTranscriptionPathSegments(e.parentPath)
                : null,
            color: typeof e.color === 'string' ? e.color : 'slate',
            sortOrder: typeof e.sortOrder === 'number' ? e.sortOrder : merged.length,
          })
        }
      }
    } catch {
      /* ignore */
    }
  }

  for (const p of pathSet) {
    if (!merged.some((f) => f.path.toLowerCase() === p.toLowerCase())) {
      const segments = p.split('/').filter(Boolean)
      const name = segments[segments.length - 1] ?? p
      const parentPath = segments.length > 1 ? segments.slice(0, -1).join('/') : null
      merged.push({ path: p, name, parentPath, color: 'slate', sortOrder: merged.length })
    }
  }

  const upsertMeta = db.prepare(`
    INSERT INTO app_meta (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)
  upsertMeta.run('transcription_folders', JSON.stringify(merged))
  upsertMeta.run(TRANSCRIPTION_PATH_MIGRATION_META_KEY, '1')
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

function backfillSceneSourcePaths(db: Database.Database) {
  db.exec(`
    UPDATE scenes
    SET source_paths = json_array(source_reference)
    WHERE TRIM(source_reference) <> ''
      AND (
        source_paths IS NULL
        OR TRIM(source_paths) = ''
        OR TRIM(source_paths) = '[]'
      )
  `)

  db.exec(`
    UPDATE scenes
    SET source_paths = '[]'
    WHERE source_paths IS NULL OR TRIM(source_paths) = ''
  `)
}

function ensureProjectSettingsRow(db: Database.Database) {
  db.prepare(
    `
      INSERT OR IGNORE INTO project_settings (
        id, title, genre, format, target_runtime_minutes, logline, default_board_view,
        enabled_block_kinds, block_kind_order, updated_at
      ) VALUES (
        1, '', '', '', 90, '', 'outline',
        '["chapter","voiceover","narration","text-card","note"]',
        '["chapter","voiceover","narration","text-card","note"]',
        ''
      )
    `,
  ).run()
}

function seedBoardCoordinates(db: Database.Database) {
  db.exec(`
    UPDATE board_items
    SET
      board_x = CASE WHEN board_x = 0 THEN position * 320 ELSE board_x END,
      board_y = COALESCE(board_y, 0),
      board_w = CASE WHEN board_w = 300 THEN board_w ELSE board_w END,
      board_h = CASE WHEN board_h = 132 THEN board_h ELSE board_h END
  `)
}
