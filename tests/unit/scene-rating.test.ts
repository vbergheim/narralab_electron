import { describe, expect, it } from 'vitest'

import { clampKeyRating, maxKeyRating, nextKeyRating } from '@/lib/scene-rating'

describe('scene rating helpers', () => {
  it('normalizes booleans and invalid input', () => {
    expect(clampKeyRating(true)).toBe(1)
    expect(clampKeyRating(false)).toBe(0)
    expect(clampKeyRating(undefined)).toBe(0)
    expect(clampKeyRating(Number.NaN)).toBe(0)
  })

  it('clamps to the supported range', () => {
    expect(clampKeyRating(-10)).toBe(0)
    expect(clampKeyRating(3.2)).toBe(3)
    expect(clampKeyRating(99)).toBe(maxKeyRating)
  })

  it('cycles key rating values', () => {
    expect(nextKeyRating(0)).toBe(1)
    expect(nextKeyRating(4)).toBe(5)
    expect(nextKeyRating(5)).toBe(0)
  })
})
