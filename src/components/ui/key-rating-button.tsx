import { Star } from 'lucide-react'

import { cn } from '@/lib/cn'
import { clampKeyRating, maxKeyRating } from '@/lib/scene-rating'
import { nextKeyRating } from '@/lib/scene-rating'

type Props = {
  value: number
  onChange(value: number): void
}

export function KeyRatingButton({ value, onChange }: Props) {
  const nextValue = nextKeyRating(value)

  return (
    <button
      type="button"
      aria-label={`Cycle key rating. Current ${value} of 5`}
      title={value > 0 ? `Key rating ${value} of ${maxKeyRating}` : 'Increase key rating'}
      className="inline-flex h-7 items-center rounded-md border border-transparent px-1.5 text-muted transition hover:border-border hover:bg-panelMuted hover:text-foreground"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onChange(nextValue)
      }}
    >
      <KeyRatingMark value={value} />
    </button>
  )
}

export function KeyRatingMark({ value, className }: { value: number; className?: string }) {
  const normalized = clampKeyRating(value)
  const strength = normalized / maxKeyRating
  const color =
    normalized <= 0
      ? 'rgba(255,255,255,0.18)'
      : normalized <= 2
        ? `rgba(245, 189, 92, ${0.48 + strength * 0.16})`
        : normalized <= 4
          ? `rgba(247, 178, 62, ${0.72 + strength * 0.12})`
          : 'rgba(255, 164, 28, 0.98)'

  return (
    <span
      className={cn('inline-flex items-center', className)}
      title={normalized > 0 ? `Key rating ${normalized} of ${maxKeyRating}` : 'No key rating'}
      aria-label={normalized > 0 ? `Key rating ${normalized} of ${maxKeyRating}` : 'No key rating'}
    >
      <Star
        className="h-3.5 w-3.5 transition"
        style={{
          color,
          fill: normalized > 0 ? color : 'transparent',
          filter: normalized >= 4 ? 'drop-shadow(0 0 4px rgba(255, 178, 48, 0.24))' : 'none',
          opacity: normalized > 0 ? 0.55 + strength * 0.45 : 1,
        }}
      />
    </span>
  )
}
