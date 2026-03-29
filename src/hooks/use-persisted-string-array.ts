import { useEffect, useState } from 'react'

export function usePersistedStringArray(key: string) {
  const [value, setValue] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []

    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === 'string')
        : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ignore persistence issues and keep UI functional.
    }
  }, [key, value])

  return [value, setValue] as const
}
