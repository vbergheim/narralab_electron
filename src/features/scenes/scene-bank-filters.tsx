import { CircleOff, Filter, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { sceneColors, sceneStatuses } from '@/lib/constants'
import { useFilterStore } from '@/stores/filter-store'
import type { Scene } from '@/types/scene'
import type { Tag } from '@/types/tag'

type Props = {
  scenes: Scene[]
  tags: Tag[]
  expanded: boolean
}

export function SceneBankFilters({ scenes, tags, expanded }: Props) {
  const {
    selectedTagIds,
    selectedStatuses,
    selectedColors,
    selectedCategories,
    onlyKeyScenes,
    toggleOnlyKeyScenes,
    toggleTag,
    toggleStatus,
    toggleColor,
    toggleCategory,
    clear,
  } = useFilterStore()

  const categories = Array.from(
    new Set(scenes.map((scene) => scene.category.trim()).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b))

  const activeFiltersCount =
    (onlyKeyScenes ? 1 : 0) +
    selectedTagIds.length +
    selectedStatuses.length +
    selectedColors.length +
    selectedCategories.length

  if (!expanded) {
    if (activeFiltersCount === 0) return null
    
    return (
      <div className="flex items-center gap-2 text-xs text-muted">
        <Filter className="h-3.5 w-3.5" />
        <span>{activeFiltersCount} active filter{activeFiltersCount === 1 ? '' : 's'}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4 border-b border-border/50 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-foreground">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">
              {activeFiltersCount}
            </span>
          )}
        </div>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clear}>
            <CircleOff className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {tags.length > 0 && (
        <FilterSection label="Tags">
          <ChipGrid>
            {tags.map((tag) => (
              <Chip
                key={tag.id}
                active={selectedTagIds.includes(tag.id)}
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </Chip>
            ))}
          </ChipGrid>
        </FilterSection>
      )}

      {categories.length > 0 && (
        <FilterSection label="Categories">
          <ChipGrid>
            {categories.map((category) => (
              <Chip
                key={category}
                active={selectedCategories.includes(category)}
                onClick={() => toggleCategory(category)}
              >
                {category}
              </Chip>
            ))}
          </ChipGrid>
        </FilterSection>
      )}

      <FilterSection label="Status">
        <ChipGrid>
          <Chip active={onlyKeyScenes} onClick={toggleOnlyKeyScenes}>
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3" />
              Key Scenes
            </span>
          </Chip>
          {sceneStatuses.map((status) => (
            <Chip
              key={status.value}
              active={selectedStatuses.includes(status.value)}
              onClick={() => toggleStatus(status.value)}
            >
              {status.label}
            </Chip>
          ))}
        </ChipGrid>
      </FilterSection>

      <FilterSection label="Color">
        <ChipGrid>
          {sceneColors.map((color) => (
            <ColorSwatch
              key={color.value}
              active={selectedColors.includes(color.value)}
              color={color.hex}
              label={color.label}
              onClick={() => toggleColor(color.value)}
            />
          ))}
        </ChipGrid>
      </FilterSection>
    </div>
  )
}

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{label}</div>
      {children}
    </div>
  )
}

function ChipGrid({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick(): void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition',
        active
          ? 'border-accent/60 bg-accent/15 text-accent'
          : 'border-border/60 bg-panelMuted/30 text-muted hover:border-border hover:bg-panelMuted hover:text-foreground',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function ColorSwatch({
  active,
  color,
  label,
  onClick,
}: {
  active: boolean
  color: string
  label: string
  onClick(): void
}) {
  return (
    <button
      type="button"
      className={cn(
        'h-6 w-6 shrink-0 rounded-md border-2 transition',
        active ? 'border-white/90 ring-2 ring-white/30' : 'border-white/20 hover:border-white/40',
      )}
      style={{ backgroundColor: color }}
      onClick={onClick}
      aria-label={label}
      title={label}
    />
  )
}
