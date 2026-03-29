import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { Workbook } from 'exceljs'
import { describe, expect, it } from 'vitest'

import { buildShootLogTemplateWorkbook, importShootLogWorkbook } from '../../electron/main/shoot-log-import'
import { createTestDatabase } from '../helpers/test-database'

const shootLogTemplatePath = path.join(__dirname, '../../sample-data/shoot-log-template.xlsx')

describe('shoot log import', () => {
  it('imports scenes and beats from a valid workbook without touching existing scenes', async () => {
    const harness = createTestDatabase()
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'narralab-shoot-log-'))
    const filePath = path.join(tempDir, 'shoot-log.xlsx')

    try {
      const existingScene = harness.scenes.create()
      harness.scenes.update({ id: existingScene.id, title: 'Existing scene' })

      const workbook = buildShootLogTemplateWorkbook()
      setRow(workbook.getWorksheet('Scenes')!, 2, [
        'scene_kitchen',
        '2026-03-29',
        'Morning',
        20,
        'Kitchen reset',
        'Mia resets in the kitchen after the interview.',
        'Kitchen',
        'Mia|Mom',
        'verite',
        'Reset emotional baseline',
        120,
        90,
        'selected',
        2,
        'teal',
        'partial',
        'Tight handheld on hands and dishes.',
        'Fridge hum in the room tone.',
        '',
        'Need tighter entry beat.',
      ])
      setRow(workbook.getWorksheet('Scenes')!, 3, [
        'scene_car',
        '2026-03-29',
        '',
        10,
        'Car pickup',
        'Mia rides in silence toward the next location.',
        'Car',
        'Mia',
        'pickup',
        'Bridge to next scene',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ])
      setRow(workbook.getWorksheet('Beats')!, 2, ['scene_kitchen', 2, 'Mia stops talking when the room goes quiet.'])
      setRow(workbook.getWorksheet('Beats')!, 3, ['scene_kitchen', 1, 'Mia laughs while stacking mugs.'])
      setRow(workbook.getWorksheet('Beats')!, 4, ['scene_car', '', 'Mia watches the road through the side window.'])
      setRow(workbook.getWorksheet('Beats')!, 5, ['scene_car', '', ''])
      await workbook.xlsx.writeFile(filePath)

      const result = await importShootLogWorkbook(harness.db, filePath)
      const scenes = harness.scenes.list()
      const importedKitchen = scenes.find((scene) => scene.title === 'Kitchen reset')
      const importedCar = scenes.find((scene) => scene.title === 'Car pickup')

      expect(result).toEqual({
        addedSceneCount: 2,
        addedBeatCount: 3,
        skippedRowCount: 1,
        errors: [],
      })
      expect(scenes).toHaveLength(3)
      expect(scenes.map((scene) => scene.title)).toEqual(['Existing scene', 'Car pickup', 'Kitchen reset'])
      expect(importedKitchen?.folder).toBe('2026-03-29/Morning')
      expect(importedCar?.folder).toBe('2026-03-29')
      expect(importedKitchen?.characters).toEqual(['Mia', 'Mom'])
      expect(importedKitchen?.sourceReference).toBe('shoot-log.xlsx')
      expect(importedKitchen?.notes).toBe(
        [
          'Shoot date: 2026-03-29',
          'Shoot block: Morning',
          'Capture status: partial',
          'Camera notes: Tight handheld on hands and dishes.',
          'Audio notes: Fridge hum in the room tone.',
          '',
          'Need tighter entry beat.',
        ].join('\n'),
      )
      expect(importedKitchen?.beats.map((beat) => beat.text)).toEqual([
        'Mia laughs while stacking mugs.',
        'Mia stops talking when the room goes quiet.',
      ])
      expect(importedCar?.beats.map((beat) => beat.text)).toEqual([
        'Mia watches the road through the side window.',
      ])
    } finally {
      harness.cleanup()
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('returns row-specific validation errors and leaves the database untouched on invalid workbooks', async () => {
    const harness = createTestDatabase()
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'narralab-shoot-log-invalid-'))
    const filePath = path.join(tempDir, 'invalid-shoot-log.xlsx')

    try {
      const workbook = buildShootLogTemplateWorkbook()
      setRow(workbook.getWorksheet('Scenes')!, 2, [
        'scene_dup',
        '2026-03-29',
        '',
        '',
        'Valid title',
        'Valid synopsis',
        '',
        '',
        '',
        '',
        'abc',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ])
      setRow(workbook.getWorksheet('Scenes')!, 3, [
        'scene_dup',
        '2026-03-29',
        '',
        '',
        'Duplicate title',
        'Another synopsis',
        '',
        '',
        '',
        '',
        '',
        '',
        'wrong',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ])
      setRow(workbook.getWorksheet('Beats')!, 2, ['missing_scene', '', 'This beat points to nothing.'])
      await workbook.xlsx.writeFile(filePath)

      const result = await importShootLogWorkbook(harness.db, filePath)

      expect(result.addedSceneCount).toBe(0)
      expect(result.addedBeatCount).toBe(0)
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sheet: 'Scenes',
            row: 2,
            message: 'estimated_duration_sec must be a number.',
          }),
          expect.objectContaining({
            sheet: 'Scenes',
            row: 3,
            message: 'scene_ref "scene_dup" is duplicated. First seen on row 2.',
          }),
          expect.objectContaining({
            sheet: 'Beats',
            row: 2,
            message: 'scene_ref "missing_scene" does not exist in the Scenes sheet.',
          }),
        ]),
      )
      expect(harness.scenes.list()).toHaveLength(0)
    } finally {
      harness.cleanup()
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('returns a file-level error when the workbook is not valid xlsx', async () => {
    const harness = createTestDatabase()
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'narralab-bad-xlsx-'))
    const filePath = path.join(tempDir, 'broken.xlsx')
    fs.writeFileSync(filePath, 'not a real xlsx')

    try {
      const result = await importShootLogWorkbook(harness.db, filePath)
      expect(result.addedSceneCount).toBe(0)
      expect(result.addedBeatCount).toBe(0)
      expect(result.errors.length).toBeGreaterThanOrEqual(1)
      expect(result.errors[0]?.sheet).toBe('(fil)')
      expect(result.errors[0]?.message).toMatch(/Kunne ikke lese|Excel/i)
    } finally {
      harness.cleanup()
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('imports the OPPTAKSLOGG workbook (sample template) with metadata and duration times', async () => {
    if (!fs.existsSync(shootLogTemplatePath)) {
      throw new Error(`Missing template at ${shootLogTemplatePath}`)
    }

    const expectedFolderDate = await readOpptaksloggDatoFromTemplate(shootLogTemplatePath)

    const harness = createTestDatabase()

    try {
      const result = await importShootLogWorkbook(harness.db, shootLogTemplatePath)
      expect(result.errors).toEqual([])
      expect(result.addedSceneCount).toBe(8)
      expect(result.addedBeatCount).toBe(0)

      const scenes = harness.scenes.list()
      expect(scenes).toHaveLength(8)

      const first = scenes.find((scene) => scene.title === 'Morgenrapport på vaktrommet')
      expect(first?.folder).toBe(expectedFolderDate)
      expect(first?.estimatedDuration).toBe(90)
      expect(first?.keyRating).toBe(5)
      expect(first?.characters).toEqual(['Hai'])
      expect(first?.notes).toContain('Regi: Ina Lerner Grevstad')
      expect(first?.notes).toMatch(/Opptakssted:\s+\S/)
      expect(first?.notes).toContain('Opptaksdag:')
      expect(first?.sourceReference).toBe('shoot-log-template.xlsx')
    } finally {
      harness.cleanup()
    }
  })
})

function setRow(worksheet: NonNullable<ReturnType<typeof buildShootLogTemplateWorkbook>['getWorksheet']>, rowNumber: number, values: unknown[]) {
  const row = worksheet.getRow(rowNumber)
  values.forEach((value, index) => {
    row.getCell(index + 1).value = value as never
  })
}

/** DATO value next to «DATO:» in the sample OPPTAKSLOGG sheet (row 4, value column). */
async function readOpptaksloggDatoFromTemplate(filePath: string): Promise<string> {
  const workbook = new Workbook()
  await workbook.xlsx.readFile(filePath)
  const cell = workbook.getWorksheet('Scenes')?.getRow(4).getCell(3).value
  if (cell instanceof Date) {
    return cell.toISOString().slice(0, 10)
  }
  if (typeof cell === 'string') {
    const trimmed = cell.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed
    }
    const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed)
    if (dmy) {
      return `${dmy[3]}-${dmy[2]!.padStart(2, '0')}-${dmy[1]!.padStart(2, '0')}`
    }
  }
  throw new Error(`Could not read DATO from template (cell Scenes!C4): ${String(cell)}`)
}
