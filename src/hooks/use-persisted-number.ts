import { useEffect, useState } from 'react'

export function usePersistedNumber(key: string, fallback: number) {
  const [value, setValue] = useState<number>(() => {
    if (typeof window === 'undefined') return fallback

    try {
      const raw = window.localStorage.getItem(key)
      if (!raw) return fallback
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : fallback
    } catch {
      return fallback
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(key, String(value))
    } catch {
      // Ignore persistence issues and keep UI functional.
    }
  }, [key, value])

  return [value, setValue] as const
}
