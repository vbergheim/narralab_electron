import type Database from 'better-sqlite3'

export const NOTEBOOK_META_KEY = 'project_notebooks_v1'
const LEGACY_NOTEBOOK_CONTENT_KEY = 'project_notebook'
const LEGACY_NOTEBOOK_UPDATED_AT_KEY = 'project_notebook_updated_at'
const BOARD_FOLDERS_META_KEY = 'board_folders'
const SCENE_FOLDERS_META_KEY = 'scene_folders'
const BLOCK_TEMPLATES_META_KEY = 'block_templates'
const TRANSCRIPTION_FOLDERS_META_KEY = 'transcription_folders'

export class ProjectMetadataRepository {
  private readonly db: Database.Database

  constructor(db: Database.Database) {
    this.db = db
  }

  getBoardFolders() {
    return this.getValue(BOARD_FOLDERS_META_KEY)
  }

  setBoardFolders(value: string) {
    this.setValue(BOARD_FOLDERS_META_KEY, value)
  }

  getSceneFolders() {
    return this.getValue(SCENE_FOLDERS_META_KEY)
  }

  setSceneFolders(value: string) {
    this.setValue(SCENE_FOLDERS_META_KEY, value)
  }

  getBlockTemplates() {
    return this.getValue(BLOCK_TEMPLATES_META_KEY)
  }

  setBlockTemplates(value: string) {
    this.setValue(BLOCK_TEMPLATES_META_KEY, value)
  }

  getTranscriptionFolders() {
    return this.getValue(TRANSCRIPTION_FOLDERS_META_KEY)
  }

  setTranscriptionFolders(value: string) {
    this.setValue(TRANSCRIPTION_FOLDERS_META_KEY, value)
  }

  getNotebook() {
    return this.getValue(NOTEBOOK_META_KEY)
  }

  getLegacyNotebook() {
    return {
      content: this.getValue(LEGACY_NOTEBOOK_CONTENT_KEY) ?? '',
      updatedAt: this.getValue(LEGACY_NOTEBOOK_UPDATED_AT_KEY),
    }
  }

  setNotebook(value: string) {
    this.setValue(NOTEBOOK_META_KEY, value)
    this.deleteValues([LEGACY_NOTEBOOK_CONTENT_KEY, LEGACY_NOTEBOOK_UPDATED_AT_KEY])
  }

  private getValue(key: string) {
    return (
      this.db.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as
        | { value: string }
        | undefined
    )?.value ?? null
  }

  private setValue(key: string, value: string) {
    this.db
      .prepare(`
        INSERT INTO app_meta (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)
      .run(key, value)
  }

  private deleteValues(keys: string[]) {
    const remove = this.db.prepare('DELETE FROM app_meta WHERE key = ?')
    const removeMany = this.db.transaction((entries: string[]) => {
      entries.forEach((key) => remove.run(key))
    })

    removeMany(keys)
  }
}
