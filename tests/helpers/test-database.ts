import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { openProjectDatabase } from '../../electron/main/db/connection'
import { ArchiveRepository } from '../../electron/main/db/repositories/archive-repository'
import { BoardRepository } from '../../electron/main/db/repositories/board-repository'
import { SceneRepository } from '../../electron/main/db/repositories/scene-repository'

export function createTestDatabase() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docudoc-test-'))
  const filePath = path.join(tempDir, 'project.docudoc')
  const db = openProjectDatabase(filePath)

  return {
    tempDir,
    filePath,
    db,
    scenes: new SceneRepository(db),
    boards: new BoardRepository(db),
    archive: new ArchiveRepository(db),
    cleanup() {
      db.close()
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}
