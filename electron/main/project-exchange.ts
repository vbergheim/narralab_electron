import { clampKeyRating } from '@/lib/scene-rating'
import type { Board, BoardItem, BoardTextItem } from '@/types/board'
import type {
  BoardScriptExportFormat,
  NotebookDocument,
  ProjectMeta,
  ProjectSettings,
  ProjectSettingsUpdateInput,
  ProjectSnapshot,
  ProjectSnapshotV1,
  ProjectSnapshotV7,
} from '@/types/project'
import type { Scene } from '@/types/scene'
import type { Tag } from '@/types/tag'

import type { ProjectDatabase } from './db/connection'
import { normalizeNotebookFromSnapshot } from './notebook-service'

export type ProjectExchangeContext = {
  ensureDatabase(): ProjectDatabase
  getMeta(): ProjectMeta | null
  getProjectSettings(): ProjectSettings
  listScenes(): Scene[]
  listTags(): Tag[]
  listBoards(): Board[]
  getNotebook(): NotebookDocument
  updateProjectSettings(input: ProjectSettingsUpdateInput): ProjectSettings
  updateNotebook(document: NotebookDocument): NotebookDocument
}

export class ProjectExchangeService {
  private readonly context: ProjectExchangeContext

  constructor(context: ProjectExchangeContext) {
    this.context = context
  }

  getSnapshot(): ProjectSnapshotV7 {
    return {
      schemaVersion: 7,
      exportedAt: new Date().toISOString(),
      project: this.context.getMeta(),
      projectSettings: this.context.getProjectSettings(),
      scenes: this.context.listScenes(),
      tags: this.context.listTags(),
      boards: this.context.listBoards(),
      notebook: this.context.getNotebook(),
    }
  }

  replaceWithSnapshot(rawSnapshot: ProjectSnapshot) {
    const snapshot = normalizeSnapshot(rawSnapshot)
    const db = this.context.ensureDatabase()

    const replace = db.transaction(() => {
      db.exec(`
        DELETE FROM scene_tags;
        DELETE FROM scene_beats;
        DELETE FROM board_items;
        DELETE FROM boards;
        DELETE FROM tags;
        DELETE FROM scenes;
      `)

      const insertScene = db.prepare(`
        INSERT INTO scenes (
          id, sort_order, title, synopsis, notes, color, status, is_key_scene, folder, category,
          estimated_duration, actual_duration, location, characters,
          function, source_reference, quote_moment, quality, source_paths, created_at, updated_at
        ) VALUES (
          @id, @sortOrder, @title, @synopsis, @notes, @color, @status, @keyRating, @folder, @category,
          @estimatedDuration, @actualDuration, @location, @characters,
          @function, @sourceReference, @quoteMoment, @quality, @sourcePaths, @createdAt, @updatedAt
        )
      `)

      const insertTag = db.prepare('INSERT INTO tags (id, name, type) VALUES (@id, @name, @type)')
      const insertSceneTag = db.prepare('INSERT INTO scene_tags (scene_id, tag_id) VALUES (?, ?)')
      const insertSceneBeat = db.prepare(`
        INSERT INTO scene_beats (
          id, scene_id, sort_order, text, created_at, updated_at
        ) VALUES (
          @id, @sceneId, @sortOrder, @text, @createdAt, @updatedAt
        )
      `)
      const insertBoard = db.prepare(
        'INSERT INTO boards (id, name, description, color, folder, sort_order, created_at, updated_at) VALUES (@id, @name, @description, @color, @folder, @sortOrder, @createdAt, @updatedAt)',
      )
      const insertBoardItem = db.prepare(`
        INSERT INTO board_items (
          id, board_id, scene_id, kind, title, body, color, position, board_x, board_y, board_w, board_h, created_at, updated_at
        ) VALUES (
          @id, @boardId, @sceneId, @kind, @title, @body, @color, @position, @boardX, @boardY, @boardW, @boardH, @createdAt, @updatedAt
        )
      `)

      snapshot.tags.forEach((tag) => insertTag.run(tag))

      snapshot.scenes.forEach((scene, index) => {
        const sourcePaths = normalizeStringList(scene.sourcePaths)
        insertScene.run({
          ...scene,
          sortOrder: scene.sortOrder ?? index,
          folder: scene.folder ?? '',
          keyRating: normalizeSceneKeyRating(scene),
          characters: JSON.stringify(scene.characters),
          sourceReference: sourcePaths[0] ?? scene.sourceReference ?? '',
          quoteMoment: scene.quoteMoment ?? '',
          quality: scene.quality ?? '',
          sourcePaths: JSON.stringify(sourcePaths),
        })
        scene.tagIds.forEach((tagId) => {
          insertSceneTag.run(scene.id, tagId)
        })
        scene.beats.forEach((beat, beatIndex) => {
          insertSceneBeat.run({
            ...beat,
            sceneId: scene.id,
            sortOrder: beat.sortOrder ?? beatIndex,
            text: beat.text ?? '',
            createdAt: beat.createdAt ?? scene.createdAt,
            updatedAt: beat.updatedAt ?? scene.updatedAt,
          })
        })
      })

      snapshot.boards.forEach((board) => {
        insertBoard.run(board)
        board.items.forEach((item) => {
          insertBoardItem.run({
            ...item,
            sceneId: item.kind === 'scene' ? item.sceneId : null,
            title: item.kind === 'scene' ? '' : item.title,
            body: item.kind === 'scene' ? '' : item.body,
            color: item.kind === 'scene' ? 'charcoal' : item.color,
            boardX: item.boardX ?? item.position * 320,
            boardY: item.boardY ?? 0,
            boardW: item.boardW ?? (item.kind === 'scene' ? 300 : 260),
            boardH: item.boardH ?? (item.kind === 'scene' ? 132 : 108),
          })
        })
      })

      this.context.updateNotebook(normalizeNotebookFromSnapshot(snapshot.notebook))
      this.context.updateProjectSettings(snapshot.projectSettings)
    })

    replace()
  }

  renderBoardScript(board: Board, format: BoardScriptExportFormat) {
    return buildBoardScript(board, this.context.listScenes(), format)
  }

  getConsultantContext(activeBoardId: string | null) {
    const meta = this.context.getMeta()
    if (!meta) {
      return 'No project is currently open.'
    }

    const boards = this.context.listBoards()
    const activeBoard = boards.find((board) => board.id === activeBoardId) ?? boards[0] ?? null
    if (!activeBoard) {
      return 'No active board.'
    }

    const scenes = this.context.listScenes()
    const tags = this.context.listTags()
    const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]))
    const tagMap = new Map(tags.map((tag) => [tag.id, tag.name]))
    const boardLines = activeBoard.items.slice(0, 40).map((item, index) => {
      if (item.kind === 'scene') {
        const scene = sceneMap.get(item.sceneId)
        if (!scene) {
          return `${index + 1}. [Missing scene]`
        }

        const tagNames = scene.tagIds.map((id) => tagMap.get(id)).filter(Boolean)
        return `${index + 1}. Scene: ${scene.title || 'Untitled'} | Synopsis: ${trimForConsultant(scene.synopsis, 140)} | Category: ${scene.category || '-'} | Key rating: ${normalizeSceneKeyRating(scene)}/5 | Tags: ${tagNames.join(', ') || '-'}`
      }

      return `${index + 1}. ${item.kind}: ${trimForConsultant(item.title || item.body, 140)}`
    })

    return [`Project: ${meta.name}`, `Active board: ${activeBoard.name}`, 'Outline:', ...boardLines].join('\n')
  }
}

function normalizeSnapshot(snapshot: ProjectSnapshot): ProjectSnapshotV7 {
  if (snapshot.schemaVersion === 7) {
    return {
      ...snapshot,
      scenes: snapshot.scenes.map(normalizeSnapshotScene),
      projectSettings: normalizeProjectSettings(snapshot.projectSettings),
      boards: snapshot.boards.map(normalizeBoardSnapshot),
      notebook: normalizeNotebookFromSnapshot(snapshot.notebook),
    }
  }

  if (snapshot.schemaVersion === 6) {
    return {
      ...snapshot,
      schemaVersion: 7,
      scenes: snapshot.scenes.map(normalizeSnapshotScene),
      projectSettings: normalizeProjectSettings(snapshot.projectSettings),
      boards: snapshot.boards.map(normalizeBoardSnapshot),
      notebook: normalizeNotebookFromSnapshot(snapshot.notebook),
    }
  }

  if (snapshot.schemaVersion === 5) {
    return {
      ...snapshot,
      schemaVersion: 7,
      scenes: snapshot.scenes.map(normalizeSnapshotScene),
      projectSettings: normalizeProjectSettings(snapshot.projectSettings),
      boards: snapshot.boards.map(normalizeBoardSnapshot),
      notebook: normalizeNotebookFromSnapshot(snapshot.notebook),
    }
  }

  if (snapshot.schemaVersion === 4) {
    return {
      ...snapshot,
      schemaVersion: 7,
      scenes: snapshot.scenes.map(normalizeSnapshotScene),
      projectSettings: defaultProjectSettings(),
      boards: snapshot.boards.map(normalizeBoardSnapshot),
      notebook: normalizeNotebookFromSnapshot(snapshot.notebook),
    }
  }

  if (snapshot.schemaVersion === 3) {
    return {
      ...snapshot,
      schemaVersion: 7,
      scenes: snapshot.scenes.map(normalizeSnapshotScene),
      projectSettings: defaultProjectSettings(),
      boards: snapshot.boards.map((board) =>
        normalizeBoardSnapshot({
          ...board,
          description: 'description' in board ? board.description : '',
          color: 'color' in board ? board.color : 'charcoal',
          folder: 'folder' in board ? board.folder : '',
          sortOrder: 'sortOrder' in board ? board.sortOrder : 0,
        }),
      ),
      notebook: normalizeNotebookFromSnapshot(snapshot.notebook),
    }
  }

  if (snapshot.schemaVersion === 2) {
    return {
      ...snapshot,
      schemaVersion: 7,
      scenes: snapshot.scenes.map(normalizeSnapshotScene),
      projectSettings: defaultProjectSettings(),
      boards: snapshot.boards.map((board) =>
        normalizeBoardSnapshot({
          ...board,
          description: '',
          color: 'charcoal',
          folder: '',
          sortOrder: 0,
        }),
      ),
      notebook: normalizeNotebookFromSnapshot({ content: '', updatedAt: null }),
    }
  }

  return {
    schemaVersion: 7,
    exportedAt: snapshot.exportedAt,
    project: snapshot.project,
    projectSettings: defaultProjectSettings(),
    scenes: snapshot.scenes.map(normalizeSnapshotScene),
    tags: snapshot.tags,
    boards: snapshot.boards.map((board) =>
      normalizeBoardSnapshot({
        ...board,
        description: '',
        color: 'charcoal',
        folder: '',
        sortOrder: 0,
        items: board.items.map(normalizeSnapshotBoardItem),
      }),
    ),
    notebook: normalizeNotebookFromSnapshot({ content: '', updatedAt: null }),
  }
}

function normalizeSnapshotScene(scene: Scene) {
  const sourcePaths = normalizeStringList(
    Array.isArray(scene.sourcePaths)
      ? scene.sourcePaths
      : typeof scene.sourceReference === 'string' && scene.sourceReference.trim().length > 0
        ? [scene.sourceReference]
        : [],
  )

  return {
    ...scene,
    sourceReference: sourcePaths[0] ?? (typeof scene.sourceReference === 'string' ? scene.sourceReference : ''),
    quoteMoment: typeof scene.quoteMoment === 'string' ? scene.quoteMoment : '',
    quality: typeof scene.quality === 'string' ? scene.quality : '',
    sourcePaths,
    beats: Array.isArray(scene.beats)
      ? scene.beats.map((beat, index) => ({
          id: typeof beat.id === 'string' ? beat.id : `beat_${Math.random().toString(36).slice(2, 10)}`,
          sceneId: scene.id,
          sortOrder: typeof beat.sortOrder === 'number' ? beat.sortOrder : index,
          text: typeof beat.text === 'string' ? beat.text : '',
          createdAt: typeof beat.createdAt === 'string' ? beat.createdAt : scene.createdAt,
          updatedAt: typeof beat.updatedAt === 'string' ? beat.updatedAt : scene.updatedAt,
        }))
      : [],
  }
}

function normalizeBoardSnapshot(board: Board): Board {
  return {
    ...board,
    items: board.items.map((item) => ({
      ...item,
      boardX: item.boardX ?? item.position * 320,
      boardY: item.boardY ?? 0,
      boardW: item.boardW ?? (item.kind === 'scene' ? 300 : 260),
      boardH: item.boardH ?? (item.kind === 'scene' ? 132 : 108),
    })),
  }
}

function normalizeSceneKeyRating(scene: Scene | (Scene & { isKeyScene?: boolean })) {
  const legacyScene = scene as Scene & { isKeyScene?: boolean }
  return clampKeyRating(legacyScene.keyRating ?? legacyScene.isKeyScene)
}

function normalizeStringList(values: string[]) {
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

export function defaultProjectSettings(): ProjectSettings {
  return {
    title: '',
    genre: '',
    format: '',
    targetRuntimeMinutes: 90,
    logline: '',
    defaultBoardView: 'outline',
    enabledBlockKinds: ['chapter', 'voiceover', 'narration', 'text-card', 'note'],
    blockKindOrder: ['chapter', 'voiceover', 'narration', 'text-card', 'note'],
  }
}

export function normalizeProjectSettings(value?: Partial<ProjectSettings> | null): ProjectSettings {
  const defaults = defaultProjectSettings()
  return {
    title: value?.title?.trim() ?? defaults.title,
    genre: value?.genre?.trim() ?? defaults.genre,
    format: value?.format?.trim() ?? defaults.format,
    targetRuntimeMinutes:
      typeof value?.targetRuntimeMinutes === 'number' && Number.isFinite(value.targetRuntimeMinutes)
        ? value.targetRuntimeMinutes
        : defaults.targetRuntimeMinutes,
    logline: value?.logline ?? defaults.logline,
    defaultBoardView: normalizeStoredBoardView(value?.defaultBoardView ?? defaults.defaultBoardView),
    enabledBlockKinds: normalizeBlockKindList(value?.enabledBlockKinds ?? defaults.enabledBlockKinds),
    blockKindOrder: normalizeBlockKindList(value?.blockKindOrder ?? defaults.blockKindOrder),
  }
}

export function parseBlockKindList(value: string): ProjectSettings['enabledBlockKinds'] {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return defaultProjectSettings().enabledBlockKinds
    }
    return normalizeBlockKindList(parsed)
  } catch {
    return defaultProjectSettings().enabledBlockKinds
  }
}

export function normalizeBlockKindList(value: unknown): ProjectSettings['enabledBlockKinds'] {
  const allowed: Array<ProjectSettings['enabledBlockKinds'][number]> = [
    'chapter',
    'voiceover',
    'narration',
    'text-card',
    'note',
  ]

  if (!Array.isArray(value)) {
    return [...allowed]
  }

  const next = value.filter((entry): entry is ProjectSettings['enabledBlockKinds'][number] =>
    typeof entry === 'string' && allowed.includes(entry as ProjectSettings['enabledBlockKinds'][number]),
  )

  return next.length > 0 ? Array.from(new Set(next)) : [...allowed]
}

function isBoardView(value: unknown): value is ProjectSettings['defaultBoardView'] {
  return value === 'outline' || value === 'timeline' || value === 'canvas'
}

export function normalizeStoredBoardView(value: unknown): ProjectSettings['defaultBoardView'] {
  if (value === 'board') return 'canvas'
  if (value === 'timeline') return 'outline'
  if (!isBoardView(value)) return 'outline'
  return value
}

function normalizeSnapshotBoardItem(item: ProjectSnapshotV1['boards'][number]['items'][number]): BoardItem {
  if (item.kind && item.kind !== 'scene') {
    return {
      id: item.id,
      boardId: item.boardId,
      kind: item.kind,
      title: item.title ?? '',
      body: item.body ?? '',
      color: item.color ?? 'charcoal',
      position: item.position,
      boardX: 'boardX' in item && typeof item.boardX === 'number' ? item.boardX : item.position * 320,
      boardY: 'boardY' in item && typeof item.boardY === 'number' ? item.boardY : 0,
      boardW: 'boardW' in item && typeof item.boardW === 'number' ? item.boardW : 260,
      boardH: 'boardH' in item && typeof item.boardH === 'number' ? item.boardH : 108,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }
  }

  return {
    id: item.id,
    boardId: item.boardId,
    kind: 'scene',
    sceneId: item.sceneId ?? '',
    position: item.position,
    boardX: 'boardX' in item && typeof item.boardX === 'number' ? item.boardX : item.position * 320,
    boardY: 'boardY' in item && typeof item.boardY === 'number' ? item.boardY : 0,
    boardW: 'boardW' in item && typeof item.boardW === 'number' ? item.boardW : 300,
    boardH: 'boardH' in item && typeof item.boardH === 'number' ? item.boardH : 132,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

function buildBoardScript(board: Board, scenes: Scene[], format: BoardScriptExportFormat) {
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]))

  const sections = board.items
    .map((item) => {
      if (item.kind === 'scene') {
        const scene = sceneMap.get(item.sceneId)
        if (!scene) return null
        return formatSceneSection(scene, format)
      }

      if (item.kind === 'note') {
        return null
      }

      return formatBoardTextSection(item, format)
    })
    .filter((entry): entry is string => Boolean(entry))

  if (format === 'html-screenplay' || format === 'doc-screenplay') {
    return buildBoardScreenplayHtml(board, sections)
  }

  if (format === 'md') {
    const header = [`# ${board.name || 'Untitled Board'}`]
    if (board.description.trim()) {
      header.push('', board.description.trim())
    }
    return [...header, '', ...sections].join('\n\n').replace(/\n{3,}/g, '\n\n')
  }

  const isFormattedText = format === 'txt-formatted'
  const header = [
    isFormattedText ? centerText((board.name || 'Untitled Board').toUpperCase()) : (board.name || 'Untitled Board').toUpperCase(),
  ]
  if (board.description.trim()) {
    header.push('', ...(isFormattedText ? wrapText(board.description.trim()) : wrapText(board.description.trim(), 78)))
  }
  return [...header, '', ...sections].join('\n\n').replace(/\n{3,}/g, '\n\n')
}

function buildBoardScreenplayHtml(board: Board, sections: string[]) {
  const title = escapeHtml(board.name || 'Untitled Board')
  const description = board.description.trim() ? `<p class="description">${escapeHtml(board.description.trim())}</p>` : ''

  return `<!doctype html>
<html lang="nb">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        background: #f3f0ea;
        color: #111;
        font-family: "Courier Prime", "Courier New", Courier, monospace;
        line-height: 1.45;
      }
      .page {
        width: 8.5in;
        min-height: 11in;
        margin: 24px auto;
        background: #fff;
        padding: 0.9in 0.9in 1in;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.12);
      }
      .title {
        text-align: center;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 18px;
        margin: 0 0 10px;
      }
      .description {
        margin: 0 0 34px;
        text-align: center;
        font-size: 13px;
      }
      .scene {
        margin: 0 0 26px;
      }
      .scene-heading {
        margin: 0 0 10px;
        text-transform: uppercase;
        font-size: 13px;
        letter-spacing: 0.04em;
      }
      .action {
        margin: 0;
        max-width: 6.2in;
        white-space: pre-wrap;
      }
      .center-block {
        margin: 28px auto;
        max-width: 4.6in;
        text-align: center;
      }
      .center-label {
        margin: 0 0 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 13px;
      }
      .center-body {
        margin: 0;
        white-space: pre-wrap;
      }
      .chapter {
        margin-top: 36px;
      }
      .chapter .center-label {
        font-size: 16px;
      }
      .text-card .center-label {
        letter-spacing: 0.12em;
      }
    </style>
  </head>
  <body>
    <main class="page">
      <h1 class="title">${title}</h1>
      ${description}
      ${sections.join('\n')}
    </main>
  </body>
</html>`
}

function formatSceneSection(scene: Scene, format: BoardScriptExportFormat) {
  const title = scene.title.trim() || 'Untitled Scene'
  const synopsis = scene.synopsis.trim() || scene.notes.trim() || ''

  if (format === 'html-screenplay') {
    return `<section class="scene"><h2 class="scene-heading">${escapeHtml(title)}</h2>${synopsis ? `<p class="action">${escapeHtml(synopsis)}</p>` : ''}</section>`
  }

  if (format === 'md') {
    const parts = [`## ${title}`]
    if (synopsis) {
      parts.push('', synopsis)
    }
    return parts.join('\n')
  }

  const wrappedSynopsis = wrapText(synopsis, format === 'txt-formatted' ? 64 : 78).join('\n')
  return [title, synopsis ? `\n${wrappedSynopsis}` : ''].join('')
}

function formatBoardTextSection(item: BoardTextItem, format: BoardScriptExportFormat) {
  const title = formatBlockTitle(item)
  const body = item.body.trim()

  if (format === 'html-screenplay') {
    const kindClass = item.kind.replace(/[^a-z-]/g, '')
    return `<section class="center-block ${kindClass}"><h3 class="center-label">${escapeHtml(title.toUpperCase())}</h3>${body ? `<p class="center-body">${escapeHtml(body)}</p>` : ''}</section>`
  }

  if (format === 'md') {
    switch (item.kind) {
      case 'chapter':
        return [`<div align="center">`, '', `## ${title}`, ...(body ? ['', body] : []), '', `</div>`].join('\n')
      case 'text-card':
        return [`<div align="center">`, '', `### ${title}`, ...(body ? ['', body] : []), '', `</div>`].join('\n')
      case 'voiceover':
      case 'narration':
        return [`<div align="center">`, '', `**${title}**`, '', body || '', '', `</div>`]
          .filter(Boolean)
          .join('\n')
      default:
        return null
    }
  }

  if (format === 'txt-plain') {
    switch (item.kind) {
      case 'chapter':
      case 'text-card':
        return [title.toUpperCase(), ...(body ? ['', ...wrapText(body, 78)] : [])].join('\n')
      case 'voiceover':
      case 'narration':
        return [`${title.toUpperCase()}:`, ...(body ? wrapText(body, 72) : [])].join('\n')
      default:
        return null
    }
  }

  switch (item.kind) {
    case 'chapter':
      return [centerText(title.toUpperCase()), ...(body ? ['', ...wrapText(body).map((line) => centerText(line))] : [])].join('\n')
    case 'text-card':
      return [centerText(title.toUpperCase()), ...(body ? ['', ...wrapText(body).map((line) => centerText(line))] : [])].join('\n')
    case 'voiceover':
    case 'narration':
      return [centerText(title.toUpperCase()), body ? '' : null, ...(body ? wrapText(body).map((line) => centerText(line)) : [])]
        .filter((line): line is string => line !== null)
        .join('\n')
    default:
      return null
  }
}

function formatBlockTitle(item: BoardTextItem) {
  if (item.kind === 'voiceover') return 'Voiceover'
  if (item.kind === 'narration') return 'Forteller'
  return item.title.trim() || fallbackBlockTitle(item.kind)
}

function fallbackBlockTitle(kind: BoardTextItem['kind']) {
  switch (kind) {
    case 'chapter':
      return 'Kapittel'
    case 'text-card':
      return 'Mellomtekst'
    case 'voiceover':
      return 'Voiceover'
    case 'narration':
      return 'Forteller'
    default:
      return ''
  }
}

function wrapText(value: string, width = 64) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  const words = normalized.split(' ')
  const lines: string[] = []
  let current = ''

  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length > width && current) {
      lines.push(current)
      current = word
      return
    }
    current = candidate
  })

  if (current) {
    lines.push(current)
  }

  return lines
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function centerText(value: string, width = 72) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const padding = Math.max(0, Math.floor((width - trimmed.length) / 2))
  return `${' '.repeat(padding)}${trimmed}`
}

function trimForConsultant(value: string, limit: number) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized
}
