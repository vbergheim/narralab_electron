import type { MouseEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Folder, FolderPlus, Layers3, Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { InlineEditActions, InlineEditScope, InlineNameEditor } from '@/components/ui/inline-name-editor'
import { Panel } from '@/components/ui/panel'
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
  embedded?: boolean
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
  embedded = false,
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
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([])
  const boardSelectionAnchorRef = useRef<Map<string, number>>(new Map())

  const boardGroups = useMemo(() => groupBoards(boards, folders), [boards, folders])
  const folderPathOrder = useMemo(
    () => boardGroups.filter((group) => Boolean(group.folderPath)).map((group) => group.folderPath),
    [boardGroups],
  )
  const visibleSelectedFolderPaths = useMemo(
    () => selectedFolderPaths.filter((path) => folderPathOrder.includes(path)),
    [folderPathOrder, selectedFolderPaths],
  )
  const selectedBoardIdSet = useMemo(() => new Set(selectedBoardIds), [selectedBoardIds])

  const boardMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!menuState) return []
    const board = boards.find((entry) => entry.id === menuState.boardId)
    if (!board) return []
    
    const targetBoardIds = selectedBoardIdSet.has(menuState.boardId)
      ? selectedBoardIds
      : [menuState.boardId]
    
    const moveUp = reorderBoardsWithinFolder(boards, board.id, -1)
    const moveDown = reorderBoardsWithinFolder(boards, board.id, 1)

    return [
      ...(targetBoardIds.length === 1
        ? [
            {
              label: 'Open Board Inspector',
              onSelect: () => onOpenBoardInspector(board.id),
            },
            {
              label: 'Duplicate Board',
              onSelect: () => onDuplicateBoard(board.id),
            },
          ]
        : []),
      {
        label: targetBoardIds.length === 1 ? 'Delete Board' : `Delete ${targetBoardIds.length} Boards`,
        danger: true,
        onSelect: () => {
          const confirmMessage =
            targetBoardIds.length === 1
              ? `Delete board "${board.name}"?`
              : `Delete ${targetBoardIds.length} boards?`
          if (window.confirm(confirmMessage)) {
            targetBoardIds.forEach((id) => onDeleteBoard(id))
            setSelectedBoardIds([])
          }
        },
      },
      ...(targetBoardIds.length === 1
        ? [
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
        : []),
    ]
  }, [boards, menuState, selectedBoardIds, selectedBoardIdSet, onDeleteBoard, onDuplicateBoard, onOpenBoardInspector, onReorderBoards])

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
    setSelectedBoardIds([])
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

  const handleBoardSelection = (event: MouseEvent<HTMLElement>, boardId: string, scope: string) => {
    setSelectedFolderPaths([])
    const orderedBoardsInScope = boardGroups.find((g) => g.folderPath === scope)?.boards.map((b) => b.id) ?? []
    const anchorRef = {
      get current() {
        return boardSelectionAnchorRef.current.get(scope) ?? null
      },
      set current(value: number | null) {
        if (value === null) {
          boardSelectionAnchorRef.current.delete(scope)
        } else {
          boardSelectionAnchorRef.current.set(scope, value)
        }
      },
    }
    const { nextSelectedIds, nextAnchorIndex } = computeListSelection({
      id: boardId,
      orderedIds: orderedBoardsInScope,
      selectedIds: selectedBoardIds,
      anchorIndex: anchorRef.current,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
    })
    anchorRef.current = nextAnchorIndex
    setSelectedBoardIds(nextSelectedIds)
  }

  if (!open) return null

  const contentArea = (
    <>
      <div
        className={cn(
          'overflow-y-auto overscroll-contain',
          embedded ? 'h-full p-4' : 'max-h-[70vh] p-4',
        )}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedFolderPaths([])
            setSelectedBoardIds([])
          }
        }}
      >
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
                    const draggedBoardIds =
                      (window.narralab.boards as { draggedBoardIds?: string[] } | undefined)?.draggedBoardIds ?? [
                        draggedBoardId,
                      ]
                    draggedBoardIds.forEach((id) => {
                      onMoveBoard(id, group.folderPath, null)
                    })
                    setDraggedBoardId(null)
                    setSelectedBoardIds([])
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
                        setSelectedBoardIds([])
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
                  {group.boards.map((board) => {
                    const isSelected = selectedBoardIdSet.has(board.id)
                    return (
                      <div
                        key={board.id}
                        draggable
                        className={cn(
                          'relative flex items-center gap-2 rounded-lg px-2 py-2 text-left transition',
                          board.id === activeBoardId
                            ? 'border border-accent/60 bg-white/[0.035] ring-1 ring-accent/20'
                            : 'border border-transparent hover:border-border/50 hover:bg-white/[0.022]',
                          isSelected && 'bg-accent/8 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]',
                          draggedBoardId === board.id && 'opacity-50',
                        )}
                        onDragStart={() => {
                          const draggedBoardIds = isSelected && selectedBoardIds.length > 1 ? selectedBoardIds : [board.id]
                          setDraggedBoardId(board.id)
                          window.narralabBoardDrag = { draggedBoardIds }
                        }}
                        onDragEnd={() => {
                          setDraggedBoardId(null)
                          window.narralabBoardDrag = undefined
                        }}
                        onDragOver={(event) => {
                          if (draggedBoardId) {
                            event.preventDefault()
                            event.stopPropagation()
                          }
                        }}
                        onDrop={(event) => {
                          if (draggedBoardId && draggedBoardId !== board.id) {
                            event.preventDefault()
                            event.stopPropagation()
                            const draggedBoardIds = window.narralabBoardDrag?.draggedBoardIds ?? [draggedBoardId]
                            const targetBoardInSameFolder = boards.find((b) => b.id === board.id && b.folder === boards.find((db) => db.id === draggedBoardId)?.folder)
                            if (targetBoardInSameFolder && draggedBoardIds.length === 1) {
                              const siblingBoards = boards.filter((b) => b.folder === targetBoardInSameFolder.folder)
                              const reordered = [...siblingBoards.filter((b) => !draggedBoardIds.includes(b.id))]
                              const targetIndex = reordered.findIndex((b) => b.id === board.id)
                              reordered.splice(targetIndex, 0, ...draggedBoardIds.map((id) => boards.find((b) => b.id === id)!))
                              onReorderBoards(reordered.map((b) => b.id))
                            }
                            setDraggedBoardId(null)
                            setSelectedBoardIds([])
                          }
                        }}
                        onClick={(event) => {
                          if (editingBoardId === board.id) return
                          event.stopPropagation()
                          handleBoardSelection(event, board.id, group.folderPath)
                        }}
                        onDoubleClick={(event) => {
                          if (editingBoardId === board.id) return
                          event.preventDefault()
                          event.stopPropagation()
                          onSelectBoard(board.id)
                          setSelectedBoardIds([])
                          setSelectedFolderPaths([])
                          onClose()
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          const nextSelection = ensureContextSelection(board.id, selectedBoardIds, group.boards.map((b) => b.id))
                          setSelectedBoardIds(nextSelection)
                          const index = group.boards.findIndex((b) => b.id === board.id)
                          const anchorMap = boardSelectionAnchorRef.current
                          anchorMap.set(group.folderPath, index)
                          setMenuState({ boardId: board.id, x: event.clientX, y: event.clientY })
                        }}
                      >
                        {isSelected ? (
                          <div className="absolute inset-y-2 left-0 w-1 rounded-full bg-accent/70" />
                        ) : null}
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
                            <div className="w-full truncate text-left text-sm font-medium text-foreground">
                              {board.name}
                            </div>
                          )}
                          <div className="mt-0.5 text-xs text-muted">{board.items.length} rows</div>
                        </div>
                      </div>
                    )
                  })}
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
      </>
    )

  if (embedded) {
    return (
      <Panel className="flex min-h-0 flex-col overflow-hidden p-0">
        <div className="flex shrink-0 items-center gap-2 border-b border-border/80 px-4 py-3">
          <Layers3 className="h-4 w-4 text-accent" />
          <div>
            <div className="text-sm font-semibold text-foreground">Board Manager</div>
            <div className="text-xs text-muted">
              {boards.length} boards, {folders.length} folders
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden p-4">{contentArea}</div>
      </Panel>
    )
  }

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
        {contentArea}
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
  return label.toLocaleUpperCase('nb-NO')
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
