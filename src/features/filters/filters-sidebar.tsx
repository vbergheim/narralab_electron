import type { MouseEvent, ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, CircleOff, Filter, Folder, FolderPlus, Layers3, PanelLeftClose, PanelRightOpen, Plus, SearchX, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { InlineEditScope, InlineNameEditor } from '@/components/ui/inline-name-editor'
import { usePersistedStringArray } from '@/hooks/use-persisted-string-array'
import { cn } from '@/lib/cn'
import { sceneColors, sceneStatuses } from '@/lib/constants'
import { comparePathDepthDesc, computeListSelection, ensureContextSelection } from '@/lib/selection'
import { useFilterStore } from '@/stores/filter-store'
import type { Board, BoardFolder } from '@/types/board'
import type { Scene } from '@/types/scene'
import type { Tag } from '@/types/tag'

type Props = {
  boards: Board[]
  folders: BoardFolder[]
  scenes: Scene[]
  tags: Tag[]
  activeBoardId: string | null
  onCollapse?(): void
  onSelectBoard(boardId: string): void
  onOpenBoardInspector(boardId: string): void
  onInlineUpdateBoard(boardId: string, input: { name: string }): void
  onDuplicateBoard(boardId: string): void
  onCreateBoard(folder?: string | null): void
  onCreateFolder(name: string, parentPath?: string | null): void
  onUpdateFolder(currentPath: string, input: { name?: string; color?: BoardFolder['color']; parentPath?: string | null }): void
  onDeleteFolder(currentPath: string): void
  onDeleteBoard(boardId: string): void
  onMoveBoard(boardId: string, folder: string, beforeBoardId?: string | null): void
  onReorderBoards(boardIds: string[]): void
}

export function FiltersSidebar({
  boards,
  folders,
  scenes,
  tags,
  activeBoardId,
  onCollapse,
  onSelectBoard,
  onOpenBoardInspector,
  onInlineUpdateBoard,
  onDuplicateBoard,
  onCreateBoard,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onDeleteBoard,
  onMoveBoard,
  onReorderBoards,
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
  const boardGroups = useMemo(() => groupBoards(boards, folders), [boards, folders])
  const [menuState, setMenuState] = useState<{ boardId: string; x: number; y: number } | null>(null)
  const [folderMenuState, setFolderMenuState] = useState<{ folderPath: string; color: BoardFolder['color']; x: number; y: number } | null>(null)
  const [draggedBoardId, setDraggedBoardId] = useState<string | null>(null)
  const [draggedFolderPath, setDraggedFolderPath] = useState<string | null>(null)
  const [collapsedFolders, setCollapsedFolders] = usePersistedStringArray('narralab:collapsed:board-folders')
  const [folderDraft, setFolderDraft] = useState('')
  const [folderFormOpen, setFolderFormOpen] = useState(false)
  const [editingFolderName, setEditingFolderName] = useState<string | null>(null)
  const [editingFolderDraft, setEditingFolderDraft] = useState('')
  const [editingFolderColor, setEditingFolderColor] = useState<BoardFolder['color']>('slate')
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null)
  const [editingBoardDraft, setEditingBoardDraft] = useState('')
  const [selectedFolderPaths, setSelectedFolderPaths] = useState<string[]>([])
  const folderSelectionAnchorRef = useRef<number | null>(null)
  const folderPathOrder = useMemo(
    () => boardGroups.filter((group) => Boolean(group.folderPath)).map((group) => group.folderPath),
    [boardGroups],
  )
  const visibleSelectedFolderPaths = useMemo(
    () => selectedFolderPaths.filter((path) => folderPathOrder.includes(path)),
    [folderPathOrder, selectedFolderPaths],
  )
  const boardMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!menuState) return []
    const board = boards.find((entry) => entry.id === menuState.boardId)
    if (!board) return []
    const moveUp = reorderBoardsWithinFolder(boards, board.id, -1)
    const moveDown = reorderBoardsWithinFolder(boards, board.id, 1)

    return [
      {
        label: 'Open Board Inspector',
        onSelect: () => onOpenBoardInspector(board.id),
      },
      {
        label: 'Duplicate Board',
        onSelect: () => onDuplicateBoard(board.id),
      },
      {
        label: 'Delete Board',
        danger: true,
        onSelect: () => {
          if (window.confirm(`Delete board "${board.name}"?`)) {
            onDeleteBoard(board.id)
          }
        },
      },
      {
        label: 'Move Up',
        onSelect: () => onReorderBoards(moveUp),
        disabled: moveUp.length === 0,
      },
      {
        label: 'Move Down',
        onSelect: () => onReorderBoards(moveDown),
        disabled: moveDown.length === 0,
      },
    ]
  }, [boards, menuState, onDeleteBoard, onDuplicateBoard, onOpenBoardInspector, onReorderBoards])
  const folderMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!folderMenuState) return []
    const targetFolderPaths = visibleSelectedFolderPaths.includes(folderMenuState.folderPath)
      ? visibleSelectedFolderPaths
      : [folderMenuState.folderPath]
    const orderedFolderPaths = [...targetFolderPaths].sort(comparePathDepthDesc)

    return [
      ...(targetFolderPaths.length === 1
        ? [{
        label: 'Rename Folder',
        onSelect: () => {
          setEditingFolderName(folderMenuState.folderPath)
          setEditingFolderDraft(folderMenuState.folderPath.split('/').at(-1) ?? folderMenuState.folderPath)
          setEditingFolderColor(folderMenuState.color)
        },
      }]
        : []),
      {
        label: 'Expand All',
        onSelect: () => {
          setCollapsedFolders((current) =>
            current.filter(
              (entry) =>
                !targetFolderPaths.some(
                  (folderPath) => entry === folderPath || entry.startsWith(`${folderPath}/`),
                ),
            ),
          )
        },
      },
      {
        label: targetFolderPaths.length > 1 ? 'Delete Selection' : 'Delete Folder',
        danger: true,
        onSelect: () => {
          const confirmText =
            targetFolderPaths.length > 1
              ? `Delete ${targetFolderPaths.length} selected folders? Boards will be moved to the root list.`
              : `Delete folder "${folderMenuState.folderPath}"? Boards will be moved to the root list.`
          if (window.confirm(confirmText)) {
            orderedFolderPaths.forEach((folderPath) => onDeleteFolder(folderPath))
            setSelectedFolderPaths([])
          }
        },
      },
    ]
  }, [folderMenuState, onDeleteFolder, setCollapsedFolders, visibleSelectedFolderPaths])

  const submitFolderEdit = () => {
    if (!editingFolderName) return
    const nextName = editingFolderDraft.trim()
    if (!nextName) return
    onUpdateFolder(editingFolderName, { name: nextName, color: editingFolderColor })
    setEditingFolderName(null)
    setEditingFolderDraft('')
  }

  const submitNewFolder = () => {
    const name = folderDraft.trim()
    if (!name) return
    onCreateFolder(name, null)
    setFolderDraft('')
    setFolderFormOpen(false)
  }

  const handleFolderSelection = (event: MouseEvent<HTMLElement>, folderPath: string) => {
    const { nextSelectedIds, nextAnchorIndex } = computeListSelection({
      id: folderPath,
      orderedIds: folderPathOrder,
      selectedIds: visibleSelectedFolderPaths,
      anchorIndex: folderSelectionAnchorRef.current,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
    })
    folderSelectionAnchorRef.current = nextAnchorIndex
    setSelectedFolderPaths(nextSelectedIds)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto overscroll-contain px-4 pb-4 pt-3">
      <SectionHeader
        icon={<Layers3 className="h-4 w-4 text-accent" />}
        title="Boards"
        action={(
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateBoard(boards.find((board) => board.id === activeBoardId)?.folder ?? null)}
              title="New Board"
              aria-label="New Board"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFolderFormOpen((current) => !current)}
            >
              <FolderPlus className="h-4 w-4" />
              Folder
            </Button>
            {onCollapse ? (
              <Button variant="ghost" size="sm" onClick={onCollapse} title="Collapse sidebar" aria-label="Collapse sidebar">
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        )}
      />
      {folderFormOpen ? (
        <div className="mt-3 px-2">
          <InlineNameEditor
            autoFocus
            value={folderDraft}
            placeholder="New folder name"
            onChange={setFolderDraft}
            onSubmit={submitNewFolder}
            onCancel={() => {
              setFolderDraft('')
              setFolderFormOpen(false)
            }}
          />
        </div>
      ) : null}
      <div
        className="mt-3 space-y-1.5"
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDrop={(event) => {
          event.preventDefault()
          if (draggedBoardId) {
            onMoveBoard(draggedBoardId, '', null)
            setDraggedBoardId(null)
          }
          if (draggedFolderPath) {
            onUpdateFolder(draggedFolderPath, { parentPath: null })
            setDraggedFolderPath(null)
          }
        }}
      >
        {boardGroups.map((group) => (
          <div
            key={group.folderPath || '__root__'}
            className={cn(
              group.folderPath
                ? 'rounded-xl border border-border/50 bg-panelMuted/20 px-2 py-1.5 transition'
                : 'transition',
              (draggedBoardId || draggedFolderPath) && 'bg-white/[0.01]',
              group.folderPath && hasCollapsedAncestor(group.folderPath, collapsedFolders) && 'hidden',
            )}
            onDragOver={(event) => {
              event.preventDefault()
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (draggedBoardId) {
                onMoveBoard(draggedBoardId, group.folderPath, null)
                setDraggedBoardId(null)
              }
              if (draggedFolderPath && draggedFolderPath !== group.folderPath) {
                onUpdateFolder(draggedFolderPath, { parentPath: group.folderPath || null })
                setDraggedFolderPath(null)
              }
            }}
          >
            {group.folderPath ? (
              <div
                draggable
                className={cn(
                  'flex min-h-8 items-center justify-between gap-2 rounded-lg px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted transition',
                  visibleSelectedFolderPaths.includes(group.folderPath) && 'bg-accent/10 text-foreground ring-1 ring-accent/35',
                )}
                style={{ paddingLeft: `${group.depth * 14 + 4}px` }}
                onDragStart={() => setDraggedFolderPath(group.folderPath)}
                onDragEnd={() => setDraggedFolderPath(null)}
                onClick={(event) => handleFolderSelection(event, group.folderPath)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  const nextSelection = ensureContextSelection(group.folderPath, visibleSelectedFolderPaths, folderPathOrder)
                  setSelectedFolderPaths(nextSelection)
                  folderSelectionAnchorRef.current = folderPathOrder.indexOf(group.folderPath)
                  setFolderMenuState({ folderPath: group.folderPath, color: group.color, x: event.clientX, y: event.clientY })
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <button
                    type="button"
                    className="flex shrink-0 items-center rounded-md px-1 py-0.5 transition hover:bg-panelMuted hover:text-foreground"
                    onClick={(event) => {
                      event.stopPropagation()
                      setCollapsedFolders((current) =>
                        current.includes(group.folderPath)
                          ? current.filter((entry) => entry !== group.folderPath)
                          : [...current, group.folderPath],
                      )
                    }}
                  >
                    {collapsedFolders.includes(group.folderPath) ? (
                      <ChevronRight className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: colorHex(group.color) }} />
                  <button
                    type="button"
                    className="min-w-0 rounded-md px-1 py-0.5 text-left transition hover:bg-panelMuted hover:text-foreground"
                    onDoubleClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setEditingFolderName(group.folderPath)
                      setEditingFolderDraft(group.label)
                      setEditingFolderColor(group.color)
                    }}
                  >
                    <span className="truncate">{formatFolderLabel(group.label)}</span>
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="min-w-4 text-right text-[10px] text-muted/80">{group.boards.length}</span>
                  <button
                    type="button"
                    className="rounded-md p-1 transition hover:bg-panelMuted hover:text-foreground"
                    onClick={(event) => {
                      event.stopPropagation()
                      onCreateBoard(group.folderPath)
                    }}
                    title={`New board in ${group.label}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : null}
            {editingFolderName === group.folderPath ? (
              <InlineEditScope
                className="space-y-2 px-6 pb-1 pt-1"
                onSubmit={submitFolderEdit}
                onCancel={() => {
                  setEditingFolderName(null)
                  setEditingFolderDraft('')
                }}
              >
                <InlineNameEditor
                  autoFocus
                  value={editingFolderDraft}
                  onChange={setEditingFolderDraft}
                  onSubmit={submitFolderEdit}
                  onCancel={() => {
                    setEditingFolderName(null)
                    setEditingFolderDraft('')
                  }}
                  className="h-7 min-w-[120px] text-xs"
                />
                <div className="flex flex-wrap gap-1">
                  {sceneColors.map((color) => (
                    <button
                      key={`${group.folderPath}-${color.value}`}
                      type="button"
                      className={cn(
                        'h-4 w-4 rounded-full border transition',
                        editingFolderColor === color.value ? 'border-white/90 ring-1 ring-white/40' : 'border-white/10',
                      )}
                      style={{ backgroundColor: color.hex }}
                      onClick={() => setEditingFolderColor(color.value)}
                      aria-label={color.label}
                      title={color.label}
                    />
                  ))}
                </div>
              </InlineEditScope>
            ) : null}
              <div
                className={cn(
                group.folderPath ? 'mt-1.5 space-y-1.5 pl-5' : 'space-y-1.5',
                group.folderPath && collapsedFolders.includes(group.folderPath) && 'hidden',
              )}
            >
              {group.boards.map((board) => (
                <div
                  key={board.id}
                  draggable={editingBoardId !== board.id}
                  onDragStart={() => {
                    if (editingBoardId === board.id) {
                      return
                    }
                    setDraggedBoardId(board.id)
                  }}
                  onDragEnd={() => setDraggedBoardId(null)}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    if (!draggedBoardId || draggedBoardId === board.id) return
                    onMoveBoard(draggedBoardId, board.folder, board.id)
                    setDraggedBoardId(null)
                  }}
                  onClick={() => {
                    setSelectedFolderPaths([])
                    onSelectBoard(board.id)
                  }}
                  onDoubleClick={() => {
                    setEditingBoardId(board.id)
                    setEditingBoardDraft(board.name)
                  }}
                  onContextMenu={(event) => {
                    setSelectedFolderPaths([])
                    openBoardMenu(event, board.id, onSelectBoard, setMenuState)
                  }}
                  className={cn(
                    'w-full rounded-xl border px-3 py-3 text-left transition',
                    activeBoardId === board.id
                      ? 'border-accent/60 bg-accent/10'
                      : 'border-border bg-panelMuted/70 hover:border-accent/30',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: sceneColors.find((entry) => entry.value === board.color)?.hex ?? '#7f8895' }}
                    />
                    <div className="min-w-0">
                      {editingBoardId === board.id ? (
                        <InlineEditScope
                          className="flex items-center gap-1.5"
                          stopPropagation
                          onSubmit={() => {
                            const nextName = editingBoardDraft.trim()
                            if (nextName) {
                              onInlineUpdateBoard(board.id, { name: nextName })
                            }
                            setEditingBoardId(null)
                            setEditingBoardDraft('')
                          }}
                          onCancel={() => {
                            setEditingBoardId(null)
                            setEditingBoardDraft('')
                          }}
                        >
                          <InlineNameEditor
                            autoFocus
                            value={editingBoardDraft}
                            onChange={setEditingBoardDraft}
                            onSubmit={() => {
                              const nextName = editingBoardDraft.trim()
                              if (nextName) {
                                onInlineUpdateBoard(board.id, { name: nextName })
                              }
                              setEditingBoardId(null)
                              setEditingBoardDraft('')
                            }}
                            onCancel={() => {
                              setEditingBoardId(null)
                              setEditingBoardDraft('')
                            }}
                            className="h-7 text-sm"
                          />
                          <button
                            type="button"
                            aria-label="Open board inspector"
                            title="Open board inspector"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted transition hover:border-border hover:bg-panelMuted hover:text-foreground"
                            onClick={(event) => {
                              event.stopPropagation()
                              onOpenBoardInspector(board.id)
                            }}
                          >
                            <PanelRightOpen className="h-4 w-4" />
                          </button>
                        </InlineEditScope>
                      ) : (
                        <div className="truncate font-medium text-foreground">{board.name}</div>
                      )}
                      <div className="mt-1 text-xs text-muted">{board.items.length} rows</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
      <ContextMenu
        open={Boolean(folderMenuState)}
        x={folderMenuState?.x ?? 0}
        y={folderMenuState?.y ?? 0}
        items={folderMenuItems}
        onClose={() => setFolderMenuState(null)}
      />
    </div>
  )
}

function groupBoards(boards: Board[], folders: BoardFolder[]) {
  const folderMap = new Map<string, { folderPath: string; label: string; color: BoardFolder['color']; boards: Board[]; depth: number }>()
  const orderedFolders = [...folders].sort((left, right) => left.sortOrder - right.sortOrder || left.path.localeCompare(right.path))

  orderedFolders.forEach((folder) => {
    folderMap.set(folder.path, {
      folderPath: folder.path,
      label: folder.name,
      color: folder.color,
      boards: [],
      depth: folder.path.split('/').length - 1,
    })
  })

  boards.forEach((board) => {
    const folderPath = board.folder.trim()
    if (!folderPath) return
    if (!folderMap.has(folderPath)) {
      folderMap.set(folderPath, {
        folderPath,
        label: folderPath.split('/').at(-1) ?? folderPath,
        color: 'slate',
        boards: [],
        depth: folderPath.split('/').length - 1,
      })
    }
    folderMap.get(folderPath)?.boards.push(board)
  })

  return [
    {
      folderPath: '',
      label: '',
      color: 'slate' as const,
      boards: boards.filter((board) => !board.folder.trim()),
      depth: 0,
    },
    ...[...folderMap.values()],
  ]
}

function hasCollapsedAncestor(path: string, collapsedFolders: string[]) {
  return collapsedFolders.some((collapsedPath) => path !== collapsedPath && path.startsWith(`${collapsedPath}/`))
}

function reorderBoardsWithinFolder(boards: Board[], boardId: string, direction: -1 | 1) {
  const currentIndex = boards.findIndex((board) => board.id === boardId)
  if (currentIndex < 0) return []

  const folder = boards[currentIndex].folder.trim().toLowerCase()
  const candidateIndexes = boards
    .map((board, index) => ({ board, index }))
    .filter(({ board }) => board.folder.trim().toLowerCase() === folder)
    .map(({ index }) => index)

  const currentFolderIndex = candidateIndexes.indexOf(currentIndex)
  const targetFolderIndex = currentFolderIndex + direction
  if (targetFolderIndex < 0 || targetFolderIndex >= candidateIndexes.length) {
    return []
  }

  const targetIndex = candidateIndexes[targetFolderIndex]
  const nextBoards = [...boards]
  ;[nextBoards[currentIndex], nextBoards[targetIndex]] = [nextBoards[targetIndex], nextBoards[currentIndex]]
  return nextBoards.map((board) => board.id)
}

function colorHex(color: BoardFolder['color']) {
  return sceneColors.find((entry) => entry.value === color)?.hex ?? '#607086'
}

function formatFolderLabel(label: string) {
  return label.toLocaleUpperCase('nb-NO')
}

function openBoardMenu(
  event: MouseEvent<HTMLElement>,
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
