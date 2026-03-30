import type { MouseEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderPlus, Layers3, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { InlineEditActions, InlineEditScope, InlineNameEditor } from '@/components/ui/inline-name-editor'
import { usePersistedStringArray } from '@/hooks/use-persisted-string-array'
import { cn } from '@/lib/cn'
import { sceneColors } from '@/lib/constants'
import { comparePathDepthDesc, computeListSelection, ensureContextSelection } from '@/lib/selection'
import type { Board, BoardFolder } from '@/types/board'

type BoardGroup = {
  folderPath: string
  label: string
  color: BoardFolder['color']
  boards: Board[]
  depth: number
}

type Props = {
  boards: Board[]
  folders: BoardFolder[]
  activeBoardId: string | null
  open: boolean
  onClose(): void
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

export function BoardManagerDialog({
  boards,
  folders,
  activeBoardId,
  open,
  onClose,
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

  const boardGroups = useMemo(() => groupBoards(boards, folders), [boards, folders])
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

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 w-[600px] max-w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-panel shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-accent" />
            <h2 className="font-semibold text-foreground">Manage Boards</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto overscroll-contain p-4">
          <div className="mb-3 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onCreateBoard(boards.find((board) => board.id === activeBoardId)?.folder ?? null)}
            >
              <Plus className="h-4 w-4" />
              New Board
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFolderFormOpen((current) => !current)}
            >
              <FolderPlus className="h-4 w-4" />
              New Folder
            </Button>
          </div>

          {folderFormOpen ? (
            <div className="mb-3">
              <InlineEditScope
                onSubmit={submitNewFolder}
                onCancel={() => {
                  setFolderDraft('')
                  setFolderFormOpen(false)
                }}
              >
                <div className="flex items-center gap-2">
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
                    className="flex-1"
                  />
                  <InlineEditActions
                    onSave={submitNewFolder}
                    onCancel={() => {
                      setFolderDraft('')
                      setFolderFormOpen(false)
                    }}
                  />
                </div>
              </InlineEditScope>
            </div>
          ) : null}

          <div
            className="space-y-1.5"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedFolderPaths([])
              }
            }}
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
                  group.folderPath && visibleSelectedFolderPaths.includes(group.folderPath) && 'border-accent/60 bg-accent/10 ring-2 ring-accent/15',
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
                    className="flex min-h-8 items-center justify-between gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
                    style={{ paddingLeft: `${group.depth * 14 + 4}px` }}
                    onDragStart={() => setDraggedFolderPath(group.folderPath)}
                    onDragEnd={() => setDraggedFolderPath(null)}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (event.metaKey || event.ctrlKey) {
                        handleFolderSelection(event, group.folderPath)
                      } else {
                        setCollapsedFolders((current) =>
                          current.includes(group.folderPath)
                            ? current.filter((entry) => entry !== group.folderPath)
                            : [...current, group.folderPath],
                        )
                      }
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
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
                    <div className="flex items-center gap-2">
                      <InlineNameEditor
                        autoFocus
                        value={editingFolderDraft}
                        onChange={setEditingFolderDraft}
                        onSubmit={submitFolderEdit}
                        onCancel={() => {
                          setEditingFolderName(null)
                          setEditingFolderDraft('')
                        }}
                        className="h-7 min-w-[120px] flex-1 text-xs"
                      />
                      <InlineEditActions
                        onSave={submitFolderEdit}
                        onCancel={() => {
                          setEditingFolderName(null)
                          setEditingFolderDraft('')
                        }}
                      />
                    </div>
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
                      draggable
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2 py-2 text-left transition',
                        board.id === activeBoardId
                          ? 'border border-accent/60 bg-white/[0.035] ring-1 ring-accent/20'
                          : 'border border-transparent hover:border-border/50 hover:bg-white/[0.022]',
                        draggedBoardId === board.id && 'opacity-50',
                      )}
                      onDragStart={() => setDraggedBoardId(board.id)}
                      onDragEnd={() => setDraggedBoardId(null)}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setMenuState({ boardId: board.id, x: event.clientX, y: event.clientY })
                      }}
                    >
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colorHex(board.color) }}
                      />
                      <div className="min-w-0 flex-1">
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
                              className="h-7 flex-1 text-sm"
                            />
                            <InlineEditActions
                              onSave={() => {
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
                            />
                          </InlineEditScope>
                        ) : (
                          <button
                            type="button"
                            className="w-full truncate text-left text-sm font-medium text-foreground transition hover:text-accent"
                            onClick={() => {
                              onSelectBoard(board.id)
                            }}
                            onDoubleClick={(event) => {
                              event.preventDefault()
                              setEditingBoardId(board.id)
                              setEditingBoardDraft(board.name)
                            }}
                          >
                            {board.name}
                          </button>
                        )}
                        <div className="mt-0.5 text-xs text-muted">{board.items.length} rows</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

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
    </>
  )
}

function groupBoards(boards: Board[], folders: BoardFolder[]): BoardGroup[] {
  const folderMap = new Map<string, BoardGroup>()
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
    if (!folderPath) {
      return
    }
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

  const rootBoards = boards.filter((board) => !board.folder.trim())

  const groups: BoardGroup[] = []

  if (rootBoards.length > 0) {
    groups.push({
      folderPath: '',
      label: '',
      color: 'slate',
      boards: rootBoards,
      depth: 0,
    })
  }

  groups.push(
    ...Array.from(folderMap.values()).sort((left, right) => {
      if (left.depth !== right.depth) {
        return left.depth - right.depth
      }
      return left.folderPath.localeCompare(right.folderPath)
    }),
  )

  return groups
}

function formatFolderLabel(label: string) {
  return label
}

function hasCollapsedAncestor(path: string, collapsedPaths: string[]): boolean {
  const segments = path.split('/')
  for (let index = 1; index < segments.length; index++) {
    const ancestorPath = segments.slice(0, index).join('/')
    if (collapsedPaths.includes(ancestorPath)) {
      return true
    }
  }
  return false
}

function reorderBoardsWithinFolder(boards: Board[], boardId: string, direction: -1 | 1): string[] {
  const board = boards.find((entry) => entry.id === boardId)
  if (!board) return []

  const siblingBoards = boards.filter((entry) => entry.folder === board.folder)
  const currentIndex = siblingBoards.findIndex((entry) => entry.id === boardId)

  if (currentIndex === -1) return []
  if (direction === -1 && currentIndex === 0) return []
  if (direction === 1 && currentIndex === siblingBoards.length - 1) return []

  const reordered = [...siblingBoards]
  const [removed] = reordered.splice(currentIndex, 1)
  reordered.splice(currentIndex + direction, 0, removed)

  return reordered.map((entry) => entry.id)
}

function colorHex(color: BoardFolder['color']) {
  return sceneColors.find((entry) => entry.value === color)?.hex ?? '#607086'
}
