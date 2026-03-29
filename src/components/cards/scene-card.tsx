import type { KeyboardEvent, MouseEvent, ReactNode } from 'react'
import { Clock3, Film, MapPin, Users } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { KeyRatingMark } from '@/components/ui/key-rating-button'
import { cn } from '@/lib/cn'
import { sceneColors } from '@/lib/constants'
import { formatDuration } from '@/lib/durations'
import type { Scene } from '@/types/scene'
import type { Tag } from '@/types/tag'
import type { SceneDensity } from '@/types/view'

type Props = {
  scene: Scene
  tags: Tag[]
  density?: SceneDensity
  selected?: boolean
  draggable?: boolean
  overlay?: boolean
  actions?: ReactNode
  onClick?: (event?: MouseEvent<HTMLDivElement>) => void
  onDoubleClick?: (event?: MouseEvent<HTMLDivElement>) => void
}

export function SceneCard({
  scene,
  tags,
  density = 'compact',
  selected,
  draggable,
  overlay,
  actions,
  onClick,
  onDoubleClick,
}: Props) {
  const accent = sceneColors.find((entry) => entry.value === scene.color)?.hex ?? '#7f8895'
  const cardStyle = {
    borderLeftColor: accent,
    borderLeftWidth: 4,
    backgroundImage: `linear-gradient(90deg, ${hexToRgba(accent, 0.24)} 0%, ${hexToRgba(accent, 0.08)} 18%, ${hexToRgba(accent, 0.03)} 42%, transparent 78%)`,
  }

  if (density === 'table') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={(event) => handleKeyDown(event, onClick)}
        className={cn(
          'group w-full rounded-lg border bg-white/[0.015] px-3 py-1.5 text-left transition duration-150',
          overlay ? 'rotate-1 shadow-panel' : 'shadow-none',
          selected
            ? 'border-accent/60 bg-white/[0.035] ring-2 ring-accent/20'
            : 'border-transparent hover:bg-white/[0.025]',
          draggable && 'cursor-grab active:cursor-grabbing',
        )}
        style={cardStyle}
      >
        <div className="flex items-center gap-3 text-[13px] leading-5">
          <div className="min-w-0 flex-[0.95] truncate font-medium text-foreground">
            {scene.title}
          </div>
          <div className="min-w-0 flex-[1.85] truncate text-muted">
            {scene.synopsis || 'No synopsis yet'}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
          </div>
        </div>
      </div>
    )
  }

  if (density === 'compact') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={(event) => handleKeyDown(event, onClick)}
        className={cn(
          'group w-full rounded-xl border bg-white/[0.02] px-3 py-2.5 text-left transition duration-150',
          overlay ? 'rotate-1 shadow-panel' : 'shadow-none',
          selected
            ? 'border-accent/60 bg-white/[0.035] ring-2 ring-accent/20'
            : 'border-transparent hover:bg-white/[0.03]',
          draggable && 'cursor-grab active:cursor-grabbing',
        )}
        style={cardStyle}
      >
        <div className="flex items-center gap-3 text-sm">
          <div className="min-w-0 flex-[1.15]">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-foreground">{scene.title}</span>
            </div>
          </div>
          <div className="min-w-0 flex-[1.85] truncate text-muted">
            {scene.synopsis || 'No synopsis yet'}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {tags.slice(0, 1).map((tag) => (
              <Badge key={tag.id} className="hidden md:inline-flex">
                {tag.name}
              </Badge>
            ))}
            {actions}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(event) => handleKeyDown(event, onClick)}
      className={cn(
        'group w-full rounded-2xl border bg-white/[0.02] px-4 py-4 text-left transition duration-150',
        overlay ? 'rotate-1 shadow-panel' : 'shadow-card',
        selected
          ? 'border-accent/60 bg-white/[0.04] ring-2 ring-accent/20'
          : 'border-transparent hover:bg-white/[0.03]',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
      style={cardStyle}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-display text-[15px] font-semibold text-foreground">
            {scene.title}
          </div>
          <div className="mt-1 line-clamp-2 text-sm text-muted">
            {scene.synopsis || 'No synopsis yet'}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions ?? (scene.keyRating > 0 ? <KeyRatingMark value={scene.keyRating} /> : null)}
          <Badge className="capitalize">{scene.status}</Badge>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {tags.slice(0, 3).map((tag) => (
          <Badge key={tag.id}>{tag.name}</Badge>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
        <Meta icon={<Clock3 className="h-3.5 w-3.5" />} label={formatDuration(scene.estimatedDuration)} />
        <Meta icon={<MapPin className="h-3.5 w-3.5" />} label={scene.location || 'Location'} />
        <Meta icon={<Users className="h-3.5 w-3.5" />} label={scene.characters[0] || 'Contributors'} />
        <Meta icon={<Film className="h-3.5 w-3.5" />} label={scene.category || 'Category'} />
      </div>
    </div>
  )
}

function Meta({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 truncate">
      <span className="text-muted/80">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  )
}

function handleKeyDown(event: KeyboardEvent<HTMLDivElement>, onClick?: () => void) {
  if (!onClick) return

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onClick()
  }
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : normalized

  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
