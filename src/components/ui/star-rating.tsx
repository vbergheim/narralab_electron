import { Star } from 'lucide-react'

import { cn } from '@/lib/cn'
import { maxKeyRating } from '@/lib/scene-rating'

type Props = {
  value: number
  onChange?: (value: number) => void
  max?: number
  size?: 'sm' | 'md'
  interactive?: boolean
  className?: string
}

export function StarRating({
  value,
  onChange,
  max = maxKeyRating,
  size = 'sm',
  interactive = false,
  className,
}: Props) {
  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      {Array.from({ length: max }, (_, index) => {
        const starValue = index + 1
        const filled = starValue <= value
        const icon = (
          <Star
            className={cn(
              size === 'md' ? 'h-5 w-5' : 'h-3.5 w-3.5',
              filled ? 'fill-amber-400 text-amber-400' : 'text-white/18',
            )}
          />
        )

        if (!interactive || !onChange) {
          return <span key={starValue}>{icon}</span>
        }

        return (
          <button
            key={starValue}
            type="button"
            aria-label={`Set key rating to ${starValue}`}
            title={`${starValue} star${starValue === 1 ? '' : 's'}`}
            className="rounded-sm"
            onClick={() => onChange(starValue)}
          >
            {icon}
          </button>
        )
      })}
    </div>
  )
}
