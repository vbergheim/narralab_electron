export const maxKeyRating = 5

export function clampKeyRating(value: number | boolean | null | undefined) {
  if (typeof value === 'boolean') {
    return value ? 1 : 0
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0
  }

  return Math.max(0, Math.min(maxKeyRating, Math.round(value)))
}

export function nextKeyRating(current: number) {
  const normalized = clampKeyRating(current)
  return normalized >= maxKeyRating ? 0 : normalized + 1
}
