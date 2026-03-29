import { describe, expect, it } from 'vitest'

import { formatDuration, minutesToSeconds, secondsToMinutes } from '@/lib/durations'

describe('durations', () => {
  it('formats minute-only durations', () => {
    expect(formatDuration(540)).toBe('9m')
  })

  it('formats hour and minute durations', () => {
    expect(formatDuration(5400)).toBe('1h 30m')
  })

  it('converts minutes to seconds with rounding', () => {
    expect(minutesToSeconds(2.5)).toBe(150)
  })

  it('converts seconds to minutes with one decimal', () => {
    expect(secondsToMinutes(95)).toBe(1.6)
  })
})
