import { cn } from '@/lib/cn'
import type { SceneDensity } from '@/types/view'

type Props = {
  variant: 'outline' | 'bank'
  density: SceneDensity
  count?: number
}

export function SceneReorderGap({ variant, density, count = 1 }: Props) {
  const heightClass = getHeightClass(variant, density)

  if (count <= 0) {
    return null
  }

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'pointer-events-none w-full rounded-xl border border-dashed border-accent/40 bg-accent/[0.03] transition',
            heightClass,
          )}
        />
      ))}
    </>
  )
}

function getHeightClass(variant: 'outline' | 'bank', density: SceneDensity): string {
  if (variant === 'bank') {
    if (density === 'table') {
      return 'h-[52px]'
    }
    if (density === 'compact') {
      return 'h-[88px]'
    }
    return 'h-[136px]'
  }

  if (density === 'table') {
    return 'h-[44px]'
  }
  if (density === 'compact') {
    return 'h-[88px]'
  }
  return 'h-[124px]'
}
