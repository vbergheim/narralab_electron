import type { MouseEvent, ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { CircleOff, Filter, Layers3, SearchX, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { cn } from '@/lib/cn'
import { sceneColors, sceneStatuses } from '@/lib/constants'
import { useFilterStore } from '@/stores/filter-store'
import type { Board } from '@/types/board'
import type { Scene } from '@/types/scene'
import type { Tag } from '@/types/tag'

type Props = {
  boards: Board[]
  scenes: Scene[]
  tags: Tag[]
  activeBoardId: string | null
  onSelectBoard(boardId: string): void
  onRenameBoard(boardId: string, name: string): void
  onDuplicateBoard(boardId: string): void
}

export function FiltersSidebar({
  boards,
  scenes,
  tags,
  activeBoardId,
  onSelectBoard,
  onRenameBoard,
  onDuplicateBoard,
}: Props) {
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
  const [menuState, setMenuState] = useState<{ boardId: string; x: number; y: number } | null>(null)
  const boardMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!menuState) return []
    const board = boards.find((entry) => entry.id === menuState.boardId)
    if (!board) return []

    return [
      {
        label: 'Rename Board',
        onSelect: () => {
          const nextName = window.prompt('Rename board', board.name)?.trim()
          if (nextName && nextName !== board.name) {
            onRenameBoard(board.id, nextName)
          }
        },
      },
      {
        label: 'Duplicate Board',
        onSelect: () => onDuplicateBoard(board.id),
      },
    ]
  }, [boards, menuState, onDuplicateBoard, onRenameBoard])

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pb-4 pt-3">
      <SectionHeader
        icon={<Layers3 className="h-4 w-4 text-accent" />}
        title="Boards"
      />
      <div className="mt-3 space-y-2">
        {boards.map((board) => (
          <button
            key={board.id}
            type="button"
            onClick={() => onSelectBoard(board.id)}
            onContextMenu={(event) => openBoardMenu(event, board.id, onSelectBoard, setMenuState)}
            className={cn(
              'w-full rounded-xl border px-3 py-3 text-left transition',
              activeBoardId === board.id
                ? 'border-accent/60 bg-accent/10'
                : 'border-border bg-panelMuted/70 hover:border-accent/30',
            )}
          >
            <div className="font-medium text-foreground">{board.name}</div>
            <div className="mt-1 text-xs text-muted">{board.items.length} scenes</div>
          </button>
        ))}
      </div>

      <div className="my-5 h-px bg-border/80" />

      <SectionHeader
        icon={<Filter className="h-4 w-4 text-accent" />}
        title="Filters"
        action={(
          <Button variant="ghost" size="sm" onClick={clear}>
            <CircleOff className="h-4 w-4" />
            Clear
          </Button>
        )}
      />

      <Section label="Tags">
        {tags.length > 0 ? (
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
        ) : (
          <EmptyHint text="No tags yet" />
        )}
      </Section>

      <Section label="Categories">
        {categories.length > 0 ? (
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
        ) : (
          <EmptyHint text="No categories used" />
        )}
      </Section>

      <Section label="Status">
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
      </Section>

      <Section label="Color">
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
      </Section>

      <ContextMenu
        open={Boolean(menuState)}
        x={menuState?.x ?? 0}
        y={menuState?.y ?? 0}
        items={boardMenuItems}
        onClose={() => setMenuState(null)}
      />
    </div>
  )
}

function openBoardMenu(
  event: MouseEvent<HTMLButtonElement>,
  boardId: string,
  onSelectBoard: (boardId: string) => void,
  setMenuState: (state: { boardId: string; x: number; y: number } | null) => void,
) {
  event.preventDefault()
  onSelectBoard(boardId)
  setMenuState({ boardId, x: event.clientX, y: event.clientY })
}

function SectionHeader({
  icon,
  title,
  action,
}: {
  icon: ReactNode
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </div>
      {action}
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">{label}</div>
      {children}
    </div>
  )
}

function ChipGrid({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick(): void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs transition',
        active
          ? 'border-accent/60 bg-accent/10 text-foreground'
          : 'border-border bg-panelMuted text-muted hover:border-accent/30',
      )}
    >
      {children}
    </button>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-panelMuted px-3 py-3 text-sm text-muted">
      <SearchX className="h-4 w-4" />
      {text}
    </div>
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
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'h-9 w-9 rounded-full border transition',
        active
          ? 'border-accent/70 ring-2 ring-accent/30'
          : 'border-border/80 hover:border-foreground/30',
      )}
      style={{ backgroundColor: color }}
    >
      <span className="sr-only">{label}</span>
    </button>
  )
}
