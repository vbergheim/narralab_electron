import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronRight, Folder, Layers3, Plus, Settings } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { sceneColors } from '@/lib/constants'
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
  buttonRef?: React.RefObject<HTMLButtonElement | null>
  onClose(): void
  onSelectBoard(boardId: string): void
  onOpenManager(): void
  onCreateBoard(): void
}

export function BoardSelectorDropdown({
  boards,
  folders,
  activeBoardId,
  open,
  buttonRef,
  onClose,
  onSelectBoard,
  onOpenManager,
  onCreateBoard,
}: Props) {
  const [collapsedFolders, setCollapsedFolders] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [position, setPosition] = useState({ top: 100, left: 50 })

  const boardGroups = useMemo(() => groupBoards(boards, folders), [boards, folders])

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return boardGroups

    const query = searchQuery.toLowerCase()
    return boardGroups
      .map((group) => ({
        ...group,
        boards: group.boards.filter((board) => board.name.toLowerCase().includes(query)),
      }))
      .filter((group) => group.boards.length > 0)
  }, [boardGroups, searchQuery])

  // Calculate position based on button
  useEffect(() => {
    if (buttonRef?.current && open) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
      })
    }
  }, [buttonRef, open])

  if (!open) return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[100]" onClick={onClose} />
      <div 
        className="fixed z-[101] w-[360px] rounded-xl border border-border/60 bg-panel shadow-2xl"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
        }}
      >
        <div className="p-4">
          <input
            type="text"
            placeholder="Search boards..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-10 w-full rounded-lg border border-border/60 bg-background/50 px-4 text-sm text-foreground placeholder:text-muted/70 transition focus:border-accent/60 focus:bg-background focus:outline-none focus:ring-2 focus:ring-accent/20"
            autoFocus
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto overscroll-contain px-3 pb-3">
          {filteredGroups.length === 0 ? (
            <div className="px-3 py-12 text-center text-sm text-muted/80">
              {searchQuery.trim() ? 'No boards match your search' : 'No boards available'}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredGroups.map((group) => (
                <div key={group.folderPath || '__root'} className="space-y-1">
                  {group.folderPath ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition hover:bg-panelMuted/60"
                      onClick={() =>
                        setCollapsedFolders((current) =>
                          current.includes(group.folderPath)
                            ? current.filter((entry) => entry !== group.folderPath)
                            : [...current, group.folderPath],
                        )
                      }
                    >
                      {collapsedFolders.includes(group.folderPath) ? (
                        <ChevronRight className="h-3.5 w-3.5 text-muted/60" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted/60" />
                      )}
                      <Folder className="h-4 w-4" style={{ color: colorHex(group.color) }} />
                      <span className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-muted">{group.label}</span>
                      <span className="ml-auto text-xs text-muted/50">{group.boards.length}</span>
                    </button>
                  ) : null}

                  {!collapsedFolders.includes(group.folderPath) && (
                    <div className={cn(group.folderPath ? 'ml-6 space-y-1' : 'space-y-1')}>
                      {group.boards.map((board) => (
                        <button
                          key={board.id}
                          type="button"
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition',
                            board.id === activeBoardId
                              ? 'bg-accent/12 text-foreground shadow-sm ring-1 ring-accent/25'
                              : 'hover:bg-panelMuted/50',
                          )}
                          onClick={() => {
                            onSelectBoard(board.id)
                            onClose()
                          }}
                        >
                          <div
                            className="h-2.5 w-2.5 shrink-0 rounded-full shadow-sm"
                            style={{ backgroundColor: colorHex(board.color) }}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium">{board.name}</span>
                          {board.id === activeBoardId && <Layers3 className="h-4 w-4 text-accent" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-border/40 p-3">
          <Button variant="ghost" size="sm" className="flex-1 py-2" onClick={() => { onCreateBoard(); onClose(); }}>
            <Plus className="h-4 w-4" />
            New Board
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 py-2" onClick={() => { onOpenManager(); onClose(); }}>
            <Settings className="h-4 w-4" />
            Manage...
          </Button>
        </div>
      </div>
    </>,
    document.body,
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

function colorHex(color: BoardFolder['color']) {
  return sceneColors.find((entry) => entry.value === color)?.hex ?? '#607086'
}
