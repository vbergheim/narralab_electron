import { describe, expect, it } from 'vitest'
import { Workbook } from 'exceljs'

import { readOpptaksloggEstTidSeconds } from '../../electron/main/shoot-log-import'

function cellAt(row: number, col: number) {
  const wb = new Workbook()
  const ws = wb.addWorksheet('t')
  return ws.getRow(row).getCell(col)
}

describe('readOpptaksloggEstTidSeconds', () => {
  it('reads fraction-of-day as total seconds', () => {
    const cell = cellAt(1, 1)
    cell.value = 90 / 86400
    cell.numFmt = '[m]:ss'
    expect(readOpptaksloggEstTidSeconds(cell)).toBe(90)
  })

  it('reads Date with [m]:ss as minutes and seconds', () => {
    const cell = cellAt(1, 1)
    cell.value = new Date(Date.UTC(1899, 11, 30, 0, 1, 30))
    cell.numFmt = '[m]:ss'
    expect(readOpptaksloggEstTidSeconds(cell)).toBe(90)
  })

  it('reads h:mm as hours and minutes (90 minutes for 1:30)', () => {
    const cell = cellAt(1, 1)
    cell.value = new Date(Date.UTC(1899, 11, 30, 1, 30, 0))
    cell.numFmt = 'h:mm'
    expect(readOpptaksloggEstTidSeconds(cell)).toBe(5400)
  })

  it('without hour-first numFmt, treats 1:30 Date as 1 min 30 sec', () => {
    const cell = cellAt(1, 1)
    cell.value = new Date(Date.UTC(1899, 11, 30, 1, 30, 0))
    cell.numFmt = undefined
    expect(readOpptaksloggEstTidSeconds(cell)).toBe(90)
  })

  it('accepts plain integer seconds', () => {
    const cell = cellAt(1, 1)
    cell.value = 125
    expect(readOpptaksloggEstTidSeconds(cell)).toBe(125)
  })
})
