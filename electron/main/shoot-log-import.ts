import path from 'node:path'

import { Workbook, type Cell, type CellValue, type FillPattern, type Row, type Worksheet } from 'exceljs'

import { clampKeyRating } from '@/lib/scene-rating'
import type { SceneColor, SceneStatus } from '@/types/scene'
import type { ShootLogImportError, ShootLogImportResult } from '@/types/project'

import type { ProjectDatabase } from './db/connection'
import { createId, nowIso } from './db/repositories/helpers'

const README_SHEET = 'README'
const SCENES_SHEET = 'Scenes'
const BEATS_SHEET = 'Beats'

const sceneHeaders = [
  'scene_ref',
  'shoot_date',
  'shoot_block',
  'sort_order',
  'title',
  'synopsis',
  'location',
  'characters_pipe_separated',
  'category',
  'function',
  'estimated_duration_sec',
  'actual_duration_sec',
  'editorial_status',
  'key_rating',
  'color',
  'capture_status',
  'camera_notes',
  'audio_notes',
  'source_reference',
  'notes',
  'source_paths_pipe_separated',
  'quote_moment',
  'quality',
] as const

const beatHeaders = ['scene_ref', 'beat_order', 'beat_text'] as const

const requiredSceneHeaders = new Set(['scene_ref', 'shoot_date', 'title', 'synopsis'])
const requiredBeatHeaders = new Set(['scene_ref', 'beat_text'])

const sceneStatuses = new Set<SceneStatus>(['candidate', 'selected', 'maybe', 'omitted', 'locked'])
const sceneColors = new Set<SceneColor>([
  'charcoal',
  'slate',
  'amber',
  'ochre',
  'crimson',
  'rose',
  'olive',
  'moss',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'plum',
])
const captureStatuses = new Set(['complete', 'partial', 'pickup'] as const)

type CaptureStatus = 'complete' | 'partial' | 'pickup'

type ParsedSceneRow = {
  rowNumber: number
  sceneRef: string
  shootDate: string
  shootBlock: string
  sortOrder: number | null
  title: string
  synopsis: string
  location: string
  characters: string[]
  category: string
  functionText: string
  estimatedDuration: number
  actualDuration: number
  editorialStatus: SceneStatus
  keyRating: number
  color: SceneColor
  captureStatus: CaptureStatus | ''
  cameraNotes: string
  audioNotes: string
  sourceReference: string
  sourcePaths: string[]
  quoteMoment: string
  quality: string
  notes: string
}

type ParsedBeatRow = {
  rowNumber: number
  sceneRef: string
  beatOrder: number | null
  beatText: string
}

type ParsedShootLog = {
  scenes: ParsedSceneRow[]
  beats: ParsedBeatRow[]
  skippedRowCount: number
  errors: ShootLogImportError[]
  /** Prepended to the first imported scene's notes (OPPTAKSLOGG metadata / credits). */
  notesPreamble?: string
}

export async function importShootLogWorkbook(db: ProjectDatabase, filePath: string): Promise<ShootLogImportResult> {
  try {
    const workbook = new Workbook()
    await workbook.xlsx.readFile(filePath)

    const parsed = parseShootLogWorkbook(workbook, path.basename(filePath))
    if (parsed.errors.length > 0) {
      return {
        addedSceneCount: 0,
        addedBeatCount: 0,
        skippedRowCount: parsed.skippedRowCount,
        errors: parsed.errors,
      }
    }

    appendParsedShootLog(db, parsed)

    return {
      addedSceneCount: parsed.scenes.length,
      addedBeatCount: parsed.beats.length,
      skippedRowCount: parsed.skippedRowCount,
      errors: [],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      addedSceneCount: 0,
      addedBeatCount: 0,
      skippedRowCount: 0,
      errors: [
        {
          sheet: '(fil)',
          row: 0,
          message: `Kunne ikke lese eller tolke Excel-filen: ${message}`,
        },
      ],
    }
  }
}

export async function writeShootLogTemplate(filePath: string) {
  const workbook = buildShootLogTemplateWorkbook()
  await workbook.xlsx.writeFile(filePath)
}

export function buildShootLogTemplateWorkbook() {
  const workbook = new Workbook()
  workbook.creator = 'NarraLab'
  workbook.created = new Date()
  workbook.modified = new Date()

  const readme = workbook.addWorksheet(README_SHEET, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 22 },
  })
  readme.columns = [
    { width: 26 },
    { width: 108 },
  ]
  readme.addRow(['Sheet', 'How to use this template'])
  styleHeaderRow(readme.getRow(1))
  readme.addRows([
    ['Scenes', 'One row per scene captured during the shoot day. Required fields: scene_ref, shoot_date, title, synopsis.'],
    ['Beats', 'Optional beat rows for moments inside a scene. Required fields: scene_ref, beat_text.'],
    ['scene_ref', 'Internal key used to connect Scenes and Beats during import. Keep it unique inside the file.'],
    ['shoot_date', 'Use YYYY-MM-DD. This becomes the scene folder in the app.'],
    ['shoot_block', 'Optional subfolder, for example Morning, Interview block, Pickup.'],
    ['editorial_status', 'Allowed values: candidate, selected, maybe, omitted, locked.'],
    ['capture_status', 'Allowed values: complete, partial, pickup.'],
    ['characters_pipe_separated', 'Separate names with |, for example Mia|Mamma|Intervjuer.'],
    ['source_paths_pipe_separated', 'Optional list of files or folders separated by |. The first entry becomes the primary source reference.'],
    ['quote_moment', 'Optional memorable quote, beat, or observation tied to the scene.'],
    ['quality', 'Optional quality note, for example Strong, Usable, Pickup, Needs follow-up.'],
    ['Example scene', 'scene_ref=2026-03-29_mia_kitchen, shoot_date=2026-03-29, title=Kitchen reset, synopsis=Mia resets in the kitchen after the interview.'],
    ['Example beat', 'scene_ref=2026-03-29_mia_kitchen, beat_order=1, beat_text=Mia laughs, then goes quiet while clearing mugs.'],
  ])
  readme.getColumn(2).alignment = { wrapText: true, vertical: 'top' }

  const scenes = workbook.addWorksheet(SCENES_SHEET, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 22 },
  })
  scenes.addRow([...sceneHeaders])
  configureImportSheet(scenes, sceneHeaders, requiredSceneHeaders, {
    shoot_date: 16,
    shoot_block: 18,
    sort_order: 12,
    title: 28,
    synopsis: 48,
    location: 24,
    characters_pipe_separated: 30,
    category: 18,
    function: 28,
    estimated_duration_sec: 18,
    actual_duration_sec: 18,
    editorial_status: 18,
    key_rating: 12,
    color: 14,
    capture_status: 16,
    camera_notes: 28,
    audio_notes: 28,
    source_reference: 30,
    source_paths_pipe_separated: 32,
    quote_moment: 32,
    quality: 18,
    notes: 44,
  })
  applyListValidation(scenes, 'M2:M500', [...sceneStatuses])
  applyListValidation(scenes, 'O2:O500', [...sceneColors])
  applyListValidation(scenes, 'P2:P500', [...captureStatuses])
  scenes.getColumn(2).numFmt = 'yyyy-mm-dd'

  const beats = workbook.addWorksheet(BEATS_SHEET, {
    views: [{ state: 'frozen', ySplit: 1 }],
    properties: { defaultRowHeight: 22 },
  })
  beats.addRow([...beatHeaders])
  configureImportSheet(beats, beatHeaders, requiredBeatHeaders, {
    scene_ref: 28,
    beat_order: 12,
    beat_text: 80,
  })

  return workbook
}

function parseShootLogWorkbook(workbook: Workbook, workbookFileName: string): ParsedShootLog {
  const scenesSheet = workbook.getWorksheet(SCENES_SHEET)
  if (!scenesSheet) {
    return {
      scenes: [],
      beats: [],
      skippedRowCount: 0,
      errors: [{ sheet: SCENES_SHEET, row: 1, message: `Missing required sheet "${SCENES_SHEET}".` }],
    }
  }

  const beatsSheet = workbook.getWorksheet(BEATS_SHEET)
  if (rowHasMachineSceneHeaders(scenesSheet)) {
    return parseMachineShootLogWorkbook(scenesSheet, beatsSheet, workbookFileName)
  }

  return parseOpptaksloggShootLogWorkbook(scenesSheet, beatsSheet, workbookFileName)
}

function parseMachineShootLogWorkbook(
  scenesSheet: Worksheet,
  beatsSheet: Worksheet | undefined,
  workbookFileName: string,
): ParsedShootLog {
  const errors: ShootLogImportError[] = []
  let skippedRowCount = 0

  const sceneIndex = readHeaderIndex(scenesSheet, sceneHeaders, requiredSceneHeaders, errors)
  if (!sceneIndex) {
    return { scenes: [], beats: [], skippedRowCount, errors }
  }

  const scenes: ParsedSceneRow[] = []
  const seenSceneRefs = new Map<string, number>()

  for (let rowNumber = 2; rowNumber <= scenesSheet.rowCount; rowNumber += 1) {
    const row = scenesSheet.getRow(rowNumber)
    if (!row.hasValues) {
      continue
    }
    const cells = readCells(row, sceneIndex)

    if (isBlankRecord(cells)) {
      skippedRowCount += 1
      continue
    }

    const sceneRef = cells.scene_ref
    const shootDate = cells.shoot_date
    const title = cells.title
    const synopsis = cells.synopsis

    if (!sceneRef) {
      errors.push({ sheet: SCENES_SHEET, row: rowNumber, message: 'scene_ref is required.' })
      continue
    }
    if (!shootDate) {
      errors.push({ sheet: SCENES_SHEET, row: rowNumber, message: 'shoot_date is required.' })
      continue
    }
    if (!title) {
      errors.push({ sheet: SCENES_SHEET, row: rowNumber, message: 'title is required.' })
      continue
    }
    if (!synopsis) {
      errors.push({ sheet: SCENES_SHEET, row: rowNumber, message: 'synopsis is required.' })
      continue
    }
    if (seenSceneRefs.has(sceneRef)) {
      errors.push({
        sheet: SCENES_SHEET,
        row: rowNumber,
        message: `scene_ref "${sceneRef}" is duplicated. First seen on row ${seenSceneRefs.get(sceneRef)}.`,
      })
      continue
    }
    seenSceneRefs.set(sceneRef, rowNumber)

    const sortOrder = parseOptionalNumber(cells.sort_order, SCENES_SHEET, rowNumber, 'sort_order', errors)
    const estimatedDuration = parseNumberWithDefault(cells.estimated_duration_sec, 0, SCENES_SHEET, rowNumber, 'estimated_duration_sec', errors)
    const actualDuration = parseNumberWithDefault(cells.actual_duration_sec, 0, SCENES_SHEET, rowNumber, 'actual_duration_sec', errors)
    const keyRating = parseKeyRating(cells.key_rating, SCENES_SHEET, rowNumber, errors)
    const editorialStatus = parseSceneStatus(cells.editorial_status, SCENES_SHEET, rowNumber, errors)
    const color = parseSceneColor(cells.color, SCENES_SHEET, rowNumber, errors)
    const captureStatus = parseCaptureStatus(cells.capture_status, SCENES_SHEET, rowNumber, errors)
    const sourceReference = cells.source_reference || workbookFileName
    const sourcePaths = normalizeStringList([
      ...parsePipeSeparatedList(cells.source_paths_pipe_separated),
      ...(sourceReference ? [sourceReference] : []),
    ])

    scenes.push({
      rowNumber,
      sceneRef,
      shootDate,
      shootBlock: cells.shoot_block,
      sortOrder,
      title,
      synopsis,
      location: cells.location,
      characters: parsePipeSeparatedList(cells.characters_pipe_separated),
      category: cells.category,
      functionText: cells.function,
      estimatedDuration,
      actualDuration,
      editorialStatus,
      keyRating,
      color,
      captureStatus,
      cameraNotes: cells.camera_notes,
      audioNotes: cells.audio_notes,
      sourceReference: sourcePaths[0] ?? sourceReference,
      sourcePaths,
      quoteMoment: cells.quote_moment,
      quality: cells.quality,
      notes: cells.notes,
    })
  }

  const sceneRefSet = new Set(scenes.map((scene) => scene.sceneRef))
  const beatResult = parseBeatsSheet(beatsSheet, sceneRefSet, errors, skippedRowCount)

  return {
    scenes,
    beats: beatResult.beats,
    skippedRowCount: beatResult.skippedRowCount,
    errors,
  }
}

function parseOpptaksloggShootLogWorkbook(
  scenesSheet: Worksheet,
  beatsSheet: Worksheet | undefined,
  workbookFileName: string,
): ParsedShootLog {
  const errors: ShootLogImportError[] = []
  let skippedRowCount = 0

  const meta = parseOpptaksloggMetadata(scenesSheet, errors)
  if (!meta) {
    return { scenes: [], beats: [], skippedRowCount, errors }
  }

  const headerRowNumber = findOpptaksloggHeaderRow(scenesSheet)
  if (!headerRowNumber) {
    errors.push({
      sheet: SCENES_SHEET,
      row: 1,
      message: 'Fant ikke tabellheader (forventet kolonner som Nr., SCENE og SYNOPSIS).',
    })
    return { scenes: [], beats: [], skippedRowCount, errors }
  }

  const colMap = mapOpptaksloggColumns(scenesSheet.getRow(headerRowNumber))
  if (!colMap) {
    errors.push({
      sheet: SCENES_SHEET,
      row: headerRowNumber,
      message: 'Mangler påkrevde kolonneoverskrifter SCENE og SYNOPSIS.',
    })
    return { scenes: [], beats: [], skippedRowCount, errors }
  }

  const scenes: ParsedSceneRow[] = []
  const seenSceneRefs = new Map<string, number>()

  const cellStr = (row: Row, key: string) => {
    const col = colMap.get(key)
    return col ? readCellValue(row.getCell(col).value) : ''
  }

  for (let rowNumber = headerRowNumber + 1; rowNumber <= scenesSheet.rowCount; rowNumber += 1) {
    const row = scenesSheet.getRow(rowNumber)
    if (!row.hasValues) {
      continue
    }

    const title = cellStr(row, 'scene')
    const synopsis = cellStr(row, 'synopsis')
    const nrRaw = cellStr(row, 'nr')

    if (!title.trim() && !synopsis.trim()) {
      skippedRowCount += 1
      continue
    }

    if (!title) {
      errors.push({ sheet: SCENES_SHEET, row: rowNumber, message: 'SCENE (tittel) er påkrevd.' })
      continue
    }
    if (!synopsis) {
      errors.push({ sheet: SCENES_SHEET, row: rowNumber, message: 'SYNOPSIS er påkrevd.' })
      continue
    }

    const nrToken = (nrRaw.trim() || String(rowNumber)).replace(/\s+/g, '_')
    const sceneRef = sanitizeSceneRef(`${meta.shootDate}_opptak_${nrToken}`)

    if (seenSceneRefs.has(sceneRef)) {
      errors.push({
        sheet: SCENES_SHEET,
        row: rowNumber,
        message: `Scene-nr. "${nrRaw || nrToken}" gir duplikat referanse. Først brukt på rad ${seenSceneRefs.get(sceneRef)}.`,
      })
      continue
    }
    seenSceneRefs.set(sceneRef, rowNumber)

    const estCol = colMap.get('est_tid')
    const estimatedDuration = estCol != null ? readOpptaksloggEstTidSeconds(row.getCell(estCol)) : 0

    const ratingRaw = cellStr(row, 'rating')
    const keyRating = parseKeyRating(ratingRaw, SCENES_SHEET, rowNumber, errors)

    const sortOrder = parseOptionalNumber(nrRaw, SCENES_SHEET, rowNumber, 'Nr.', errors)

    const sourcePaths = normalizeStringList(workbookFileName ? [workbookFileName] : [])

    scenes.push({
      rowNumber,
      sceneRef,
      shootDate: meta.shootDate,
      shootBlock: meta.shootBlock,
      sortOrder,
      title,
      synopsis,
      location: cellStr(row, 'location'),
      characters: splitMedvirkende(cellStr(row, 'medvirkende')),
      category: cellStr(row, 'type'),
      functionText: cellStr(row, 'funksjon'),
      estimatedDuration,
      actualDuration: 0,
      editorialStatus: 'candidate',
      keyRating,
      color: 'charcoal',
      captureStatus: '',
      cameraNotes: '',
      audioNotes: '',
      sourceReference: sourcePaths[0] ?? workbookFileName,
      sourcePaths,
      quoteMoment: cellStr(row, 'quote_moment'),
      quality: cellStr(row, 'quality'),
      notes: cellStr(row, 'notater'),
    })
  }

  const sceneRefSet = new Set(scenes.map((scene) => scene.sceneRef))
  const beatResult = parseBeatsSheet(beatsSheet, sceneRefSet, errors, skippedRowCount)

  return {
    scenes,
    beats: beatResult.beats,
    skippedRowCount: beatResult.skippedRowCount,
    errors,
    notesPreamble: meta.preamble || undefined,
  }
}

function parseBeatsSheet(
  beatsSheet: Worksheet | undefined,
  sceneRefSet: Set<string>,
  errors: ShootLogImportError[],
  initialSkipped: number,
): { beats: ParsedBeatRow[]; skippedRowCount: number } {
  let skippedRowCount = initialSkipped
  if (!beatsSheet) {
    return { beats: [], skippedRowCount }
  }

  const beatIndex = readHeaderIndex(beatsSheet, beatHeaders, requiredBeatHeaders, errors)
  if (!beatIndex) {
    return { beats: [], skippedRowCount }
  }

  const beats: ParsedBeatRow[] = []

  for (let rowNumber = 2; rowNumber <= beatsSheet.rowCount; rowNumber += 1) {
    const row = beatsSheet.getRow(rowNumber)
    if (!row.hasValues) {
      continue
    }
    const cells = readCells(row, beatIndex)

    if (isBlankRecord(cells)) {
      skippedRowCount += 1
      continue
    }

    if (!cells.beat_text) {
      skippedRowCount += 1
      continue
    }

    if (!cells.scene_ref) {
      errors.push({ sheet: BEATS_SHEET, row: rowNumber, message: 'scene_ref is required.' })
      continue
    }

    if (!sceneRefSet.has(cells.scene_ref)) {
      errors.push({
        sheet: BEATS_SHEET,
        row: rowNumber,
        message: `scene_ref "${cells.scene_ref}" does not exist in the Scenes sheet.`,
      })
      continue
    }

    beats.push({
      rowNumber,
      sceneRef: cells.scene_ref,
      beatOrder: parseOptionalNumber(cells.beat_order, BEATS_SHEET, rowNumber, 'beat_order', errors),
      beatText: cells.beat_text,
    })
  }

  return { beats, skippedRowCount }
}

function rowHasMachineSceneHeaders(sheet: Worksheet) {
  const row = sheet.getRow(1)
  const limit = Math.max(row.cellCount, 24)
  for (let column = 1; column <= limit; column += 1) {
    if (readCellValue(row.getCell(column).value).toLowerCase() === 'scene_ref') {
      return true
    }
  }
  return false
}

function scanOpptaksloggLabelPairs(sheet: Worksheet) {
  const fields = new Map<string, string>()
  let firstBeskrivelse = ''

  const maxRow = Math.min(sheet.rowCount, 30)
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const collectPair = (labelCol: number, valueCol: number) => {
      const labelRaw = readCellValue(row.getCell(labelCol).value).trim()
      const valueRaw = readCellValue(row.getCell(valueCol).value).trim()
      if (!labelRaw || !valueRaw) {
        return
      }
      if (!/:$/.test(labelRaw)) {
        return
      }
      const key = labelRaw.replace(/:+\s*$/, '').trim().toLowerCase()
      if (key === 'beskrivelse') {
        if (!firstBeskrivelse) {
          firstBeskrivelse = valueRaw
        }
        return
      }
      if (!fields.has(key)) {
        fields.set(key, valueRaw)
      }
    }

    collectPair(2, 3)
    collectPair(5, 6)
  }

  if (firstBeskrivelse) {
    fields.set('__beskrivelse__', firstBeskrivelse)
  }

  return fields
}

function parseOpptaksloggMetadata(
  scenesSheet: Worksheet,
  errors: ShootLogImportError[],
): { shootDate: string; shootBlock: string; preamble: string } | null {
  const fields = scanOpptaksloggLabelPairs(scenesSheet)
  const dateRaw = fields.get('dato') ?? ''
  const shootDate = parseFlexibleDate(dateRaw)
  if (!shootDate) {
    errors.push({
      sheet: SCENES_SHEET,
      row: 1,
      message: 'Feltet «DATO» (ved siden av DATO:) må være en gyldig dato, for eksempel YYYY-MM-DD eller DD.MM.YYYY.',
    })
    return null
  }

  const sted = fields.get('sted') ?? ''

  const lines: string[] = []
  const creditOrder = [
    ['regi', 'Regi'],
    ['fotograf', 'Foto'],
    ['produksjon', 'Produksjon'],
    ['cast', 'Cast'],
  ] as const
  for (const [key, label] of creditOrder) {
    const value = fields.get(key)
    if (value) {
      lines.push(`${label}: ${value}`)
    }
  }
  if (sted.trim()) {
    lines.push(`Opptakssted: ${sted.trim()}`)
  }
  const beskrivelse = fields.get('__beskrivelse__')
  if (beskrivelse) {
    lines.push(`Opptaksdag: ${beskrivelse}`)
  }

  return {
    shootDate,
    // OPPTAKSLOGG: mappe i appen = kun dato. STED ligger i preamble (notater på første scene).
    shootBlock: '',
    preamble: lines.join('\n'),
  }
}

function parseFlexibleDate(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed
  }
  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed)
  if (dmy) {
    const day = dmy[1]!.padStart(2, '0')
    const month = dmy[2]!.padStart(2, '0')
    const year = dmy[3]!
    return `${year}-${month}-${day}`
  }
  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }
  return null
}

function findOpptaksloggHeaderRow(sheet: Worksheet) {
  const maxRow = Math.min(sheet.rowCount, 40)
  for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    const tokens: string[] = []
    for (let column = 1; column <= 20; column += 1) {
      tokens.push(normalizeOpptaksloggHeaderToken(readCellValue(row.getCell(column).value)))
    }
    const hasNr = tokens.some((token) => token === 'nr')
    const hasScene = tokens.some((token) => token === 'scene')
    const hasSynopsis = tokens.some((token) => token === 'synopsis')
    if (hasNr && hasScene && hasSynopsis) {
      return rowNumber
    }
  }
  return null
}

function normalizeOpptaksloggHeaderToken(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/\s+/g, ' ')
}

function mapOpptaksloggColumns(headerRow: Row) {
  const map = new Map<string, number>()
  for (let column = 1; column <= headerRow.cellCount; column += 1) {
    const token = normalizeOpptaksloggHeaderToken(readCellValue(headerRow.getCell(column).value))
    let key: string | null = null
    if (token === 'nr') {
      key = 'nr'
    } else if (token === 'scene') {
      key = 'scene'
    } else if (token === 'synopsis') {
      key = 'synopsis'
    } else if (token === 'location') {
      key = 'location'
    } else if (token === 'medvirkende') {
      key = 'medvirkende'
    } else if (token === 'type') {
      key = 'type'
    } else if (token === 'funksjon') {
      key = 'funksjon'
    } else if (token === 'est tid' || token === 'est. tid') {
      key = 'est_tid'
    } else if (token.startsWith('rating')) {
      key = 'rating'
    } else if (token === 'notater') {
      key = 'notater'
    } else if (token === 'sitat / øyeblikk') {
      key = 'quote_moment'
    } else if (token === 'kvalitet') {
      key = 'quality'
    }
    if (key && !map.has(key)) {
      map.set(key, column)
    }
  }

  if (!map.has('scene') || !map.has('synopsis')) {
    return null
  }
  return map
}

function sanitizeSceneRef(value: string) {
  return value.replace(/[^a-zA-Z0-9_.-]+/g, '_')
}

function splitMedvirkende(raw: string) {
  return raw
    .split(/[,;|]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function readDurationSecondsFromCell(value: CellValue) {
  if (value == null || value === '') {
    return 0
  }
  if (value instanceof Date) {
    return value.getUTCHours() * 3600 + value.getUTCMinutes() * 60 + value.getUTCSeconds()
  }
  const asString = String(value).trim()
  const hm = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(asString)
  if (hm) {
    const hours = Number(hm[1])
    const minutes = Number(hm[2])
    const seconds = hm[3] ? Number(hm[3]) : 0
    return hours * 3600 + minutes * 60 + seconds
  }
  const numeric = Number(asString.replace(',', '.'))
  return Number.isFinite(numeric) ? numeric : 0
}

/**
 * OPPTAKSLOGG «EST. TID» = minutter og sekunder (ikke timer:minutter som Excel h:mm).
 * Tall i celle som dag-del (0–1) tolkes som brøk av døgn → sekunder.
 */
export function readOpptaksloggEstTidSeconds(cell: Cell) {
  const raw = cell.value

  if (raw == null || raw === '') {
    return 0
  }

  if (typeof raw === 'number' && raw > 0 && raw < 1) {
    return Math.round(raw * 86400)
  }

  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 && Number.isInteger(raw) && raw <= 86400) {
    return raw
  }

  const text = String(cell.text ?? '')
    .trim()
    .replace(/\s/g, '')
  const textMatch = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(text)
  if (textMatch) {
    const a = Number(textMatch[1])
    const b = Number(textMatch[2])
    const c = textMatch[3] !== undefined ? Number(textMatch[3]) : null
    if (opptaksloggNumFmtIsHourMinuteFirst(cell.numFmt)) {
      if (c !== null) {
        return a * 3600 + b * 60 + c
      }
      return a * 3600 + b * 60
    }
    if (c !== null) {
      if (a === 0) {
        return b * 60 + c
      }
      return a * 3600 + b * 60 + c
    }
    return a * 60 + b
  }

  if (raw instanceof Date) {
    const H = raw.getUTCHours()
    const M = raw.getUTCMinutes()
    const S = raw.getUTCSeconds()
    if (opptaksloggNumFmtIsHourMinuteFirst(cell.numFmt)) {
      return H * 3600 + M * 60 + S
    }
    if (S !== 0) {
      return H * 3600 + M * 60 + S
    }
    if (H === 0) {
      return M * 60 + S
    }
    return H * 60 + M
  }

  return readDurationSecondsFromCell(raw as CellValue)
}

function opptaksloggNumFmtIsHourMinuteFirst(numFmt: string | undefined) {
  if (!numFmt) {
    return false
  }
  const fmt = numFmt.toLowerCase()
  if (fmt.includes('[m]')) {
    return false
  }
  if (fmt.includes('mm:ss') && !/h{1,2}:mm/.test(fmt)) {
    return false
  }
  return /h{1,2}:mm|^\[h/.test(fmt)
}

function appendParsedShootLog(db: ProjectDatabase, parsed: ParsedShootLog) {
  const existingSortOrder = (
    db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS maxSortOrder FROM scenes').get() as { maxSortOrder: number } | undefined
  )?.maxSortOrder ?? -1

  const scenesInOrder = [...parsed.scenes].sort(
    (left, right) => compareNullableNumber(left.sortOrder, right.sortOrder) || left.rowNumber - right.rowNumber,
  )
  const sceneIdByRef = new Map<string, string>()

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

  const insertBeat = db.prepare(`
    INSERT INTO scene_beats (
      id, scene_id, sort_order, text, created_at, updated_at
    ) VALUES (
      @id, @sceneId, @sortOrder, @text, @createdAt, @updatedAt
    )
  `)

  const beatsBySceneRef = new Map<string, ParsedBeatRow[]>()
  parsed.beats.forEach((beat) => {
    const current = beatsBySceneRef.get(beat.sceneRef) ?? []
    current.push(beat)
    beatsBySceneRef.set(beat.sceneRef, current)
  })

  // Write scenes and beats together so an import either fully lands or not at all.
  const append = db.transaction(() => {
    scenesInOrder.forEach((scene, index) => {
      const sceneId = createId('scene')
      const timestamp = nowIso()

      sceneIdByRef.set(scene.sceneRef, sceneId)
      const baseNotes = buildSceneNotes(scene)
      const notes =
        index === 0 && parsed.notesPreamble?.trim()
          ? `${parsed.notesPreamble.trim()}\n\n${baseNotes}`
          : baseNotes

      insertScene.run({
        id: sceneId,
        sortOrder: existingSortOrder + index + 1,
        title: scene.title,
        synopsis: scene.synopsis,
        notes,
        color: scene.color,
        status: scene.editorialStatus,
        keyRating: scene.keyRating,
        folder: buildSceneFolder(scene.shootDate, scene.shootBlock),
        category: scene.category,
        estimatedDuration: scene.estimatedDuration,
        actualDuration: scene.actualDuration,
        location: scene.location,
        characters: JSON.stringify(scene.characters),
        function: scene.functionText,
        sourceReference: scene.sourceReference,
        quoteMoment: scene.quoteMoment,
        quality: scene.quality,
        sourcePaths: JSON.stringify(scene.sourcePaths),
        createdAt: timestamp,
        updatedAt: timestamp,
      })
    })

    scenesInOrder.forEach((scene) => {
      const sceneId = sceneIdByRef.get(scene.sceneRef)
      if (!sceneId) return

      const beats = [...(beatsBySceneRef.get(scene.sceneRef) ?? [])].sort(
        (left, right) => compareNullableNumber(left.beatOrder, right.beatOrder) || left.rowNumber - right.rowNumber,
      )

      beats.forEach((beat, index) => {
        const timestamp = nowIso()
        insertBeat.run({
          id: createId('beat'),
          sceneId,
          sortOrder: index,
          text: beat.beatText,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      })
    })
  })

  append()
}

function readHeaderIndex<THeader extends string>(
  worksheet: Worksheet,
  supportedHeaders: readonly THeader[],
  requiredHeaders: ReadonlySet<THeader>,
  errors: ShootLogImportError[],
) {
  const headerErrorsBefore = errors.length
  const headerRow = worksheet.getRow(1)
  const headerIndex = new Map<THeader, number>()
  const seenHeaders = new Map<string, number>()
  const supportedHeaderSet = new Set(supportedHeaders)

  for (let column = 1; column <= headerRow.cellCount; column += 1) {
    const rawHeader = readCellValue(headerRow.getCell(column).value).toLowerCase()
    if (!rawHeader) continue

    if (seenHeaders.has(rawHeader)) {
      errors.push({
        sheet: worksheet.name,
        row: 1,
        message: `Header "${rawHeader}" is duplicated.`,
      })
      continue
    }

    seenHeaders.set(rawHeader, column)
    if (!supportedHeaderSet.has(rawHeader as THeader)) {
      errors.push({
        sheet: worksheet.name,
        row: 1,
        message: `Header "${rawHeader}" is not supported.`,
      })
      continue
    }

    headerIndex.set(rawHeader as THeader, column)
  }

  supportedHeaders.forEach((header) => {
    if (!requiredHeaders.has(header) || headerIndex.has(header)) {
      return
    }
    errors.push({
      sheet: worksheet.name,
      row: 1,
      message: `Missing required header "${header}".`,
    })
  })

  if (errors.length > headerErrorsBefore) {
    return null
  }

  return headerIndex
}

function readCells<THeader extends string>(
  row: Row,
  headerIndex: Map<THeader, number>,
) {
  const record = {} as Record<THeader, string>

  headerIndex.forEach((column, header) => {
    record[header] = readCellValue(row.getCell(column).value)
  })

  return record
}

function readCellValue(value: CellValue): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim()
  if (typeof value === 'object' && 'text' in value && typeof value.text === 'string') {
    return value.text.trim()
  }
  if (typeof value === 'object' && 'result' in value) {
    return readCellValue(value.result as CellValue)
  }
  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((entry) => entry.text).join('').trim()
  }
  return ''
}

function isBlankRecord(record: Record<string, string>) {
  return Object.values(record).every((value) => value.trim().length === 0)
}

function parseOptionalNumber(
  rawValue: string,
  sheet: string,
  row: number,
  field: string,
  errors: ShootLogImportError[],
) {
  if (!rawValue) return null
  const normalized = Number(rawValue.replace(',', '.'))
  if (!Number.isFinite(normalized)) {
    errors.push({ sheet, row, message: `${field} must be a number.` })
    return null
  }
  return normalized
}

function parseNumberWithDefault(
  rawValue: string,
  defaultValue: number,
  sheet: string,
  row: number,
  field: string,
  errors: ShootLogImportError[],
) {
  const parsed = parseOptionalNumber(rawValue, sheet, row, field, errors)
  return parsed ?? defaultValue
}

function parseKeyRating(rawValue: string, sheet: string, row: number, errors: ShootLogImportError[]) {
  if (!rawValue) return 0
  const parsed = parseOptionalNumber(rawValue, sheet, row, 'key_rating', errors)
  if (parsed == null) return 0
  if (clampKeyRating(parsed) !== parsed) {
    errors.push({ sheet, row, message: 'key_rating must be an integer between 0 and 5.' })
    return 0
  }
  return parsed
}

function parseSceneStatus(rawValue: string, sheet: string, row: number, errors: ShootLogImportError[]): SceneStatus {
  if (!rawValue) return 'candidate'
  const normalized = rawValue.toLowerCase() as SceneStatus
  if (!sceneStatuses.has(normalized)) {
    errors.push({ sheet, row, message: `editorial_status "${rawValue}" is invalid.` })
    return 'candidate'
  }
  return normalized
}

function parseSceneColor(rawValue: string, sheet: string, row: number, errors: ShootLogImportError[]): SceneColor {
  if (!rawValue) return 'charcoal'
  const normalized = rawValue.toLowerCase() as SceneColor
  if (!sceneColors.has(normalized)) {
    errors.push({ sheet, row, message: `color "${rawValue}" is invalid.` })
    return 'charcoal'
  }
  return normalized
}

function parseCaptureStatus(rawValue: string, sheet: string, row: number, errors: ShootLogImportError[]) {
  if (!rawValue) return ''
  const normalized = rawValue.toLowerCase() as CaptureStatus
  if (!captureStatuses.has(normalized)) {
    errors.push({ sheet, row, message: `capture_status "${rawValue}" is invalid.` })
    return ''
  }
  return normalized
}

function parsePipeSeparatedList(value: string) {
  return value
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean)
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

function buildSceneFolder(shootDate: string, shootBlock: string) {
  return shootBlock ? normalizeFolderPath(`${shootDate}/${shootBlock}`) : normalizeFolderPath(shootDate)
}

function buildSceneNotes(scene: ParsedSceneRow) {
  const metadataLines = [
    `Shoot date: ${scene.shootDate}`,
    scene.shootBlock ? `Shoot block: ${scene.shootBlock}` : '',
    scene.captureStatus ? `Capture status: ${scene.captureStatus}` : '',
    scene.cameraNotes ? `Camera notes: ${scene.cameraNotes}` : '',
    scene.audioNotes ? `Audio notes: ${scene.audioNotes}` : '',
  ].filter(Boolean)

  return scene.notes ? `${metadataLines.join('\n')}\n\n${scene.notes}` : metadataLines.join('\n')
}

function compareNullableNumber(left: number | null, right: number | null) {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  return left - right
}

function normalizeFolderPath(value?: string | null) {
  if (!value) return ''
  return value
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/')
}

function configureImportSheet<THeader extends string>(
  worksheet: Worksheet,
  headers: readonly THeader[],
  requiredHeaders: Set<string>,
  widths: Partial<Record<THeader, number>>,
) {
  const headerRow = worksheet.getRow(1)
  styleHeaderRow(headerRow)
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  }

  headers.forEach((header, index) => {
    const column = worksheet.getColumn(index + 1)
    column.width = widths[header] ?? 18
    column.alignment = { vertical: 'top', wrapText: true }

    if (requiredHeaders.has(header)) {
      headerRow.getCell(index + 1).fill = solidFill('FFF3C4')
    }
  })
}

function styleHeaderRow(row: Row) {
  row.font = { bold: true, color: { argb: 'FF0B1320' } }
  row.alignment = { vertical: 'middle', wrapText: true }
  row.fill = solidFill('FFDCE5F3')
  row.border = {
    bottom: { style: 'thin', color: { argb: 'FF9AA8BA' } },
  }
}

function solidFill(argb: string): FillPattern {
  return {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb },
  }
}

function applyListValidation(worksheet: Worksheet, range: string, values: string[]) {
  const [start, end] = range.split(':')
  if (!start || !end) return

  const startCell = worksheet.getCell(start)
  const endCell = worksheet.getCell(end)

  for (let row = startCell.row; row <= endCell.row; row += 1) {
    worksheet.getCell(row, startCell.col).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`"${values.join(',')}"`],
      showErrorMessage: true,
      errorTitle: 'Invalid value',
      error: `Allowed values: ${values.join(', ')}`,
    }
  }
}
