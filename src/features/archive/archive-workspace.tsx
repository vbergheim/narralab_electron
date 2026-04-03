import type { DragEvent, MouseEvent } from 'react'
import { useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Check,
  FileAudio2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo2,
  Folder,
  FolderOpen,
  LibraryBig,
  Plus,
  Search,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { InlineEditActions, InlineEditScope, InlineNameEditor } from '@/components/ui/inline-name-editor'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { usePersistedStringArray } from '@/hooks/use-persisted-string-array'
import { cn } from '@/lib/cn'
import { sceneColors } from '@/lib/constants'
import { computeListSelection, ensureContextSelection } from '@/lib/selection'
import type { ArchiveFolder, ArchiveItem } from '@/types/archive'

type Props = {
  folders: ArchiveFolder[]
  items: ArchiveItem[]
  selectedFolderId: string | null
  onSelectFolder(folderId: string | null): void
  onCreateFolder(name: string, parentId?: string | null, color?: ArchiveFolder['color']): void
  onUpdateFolder(folderId: string, input: { name?: string; color?: ArchiveFolder['color']; parentId?: string | null }): void
  onDeleteFolder(folderId: string): void
  onAddFiles(filePaths?: string[] | null, folderId?: string | null): void
  onMoveItem(itemId: string, folderId: string | null): void
  onOpenItem(itemId: string): void
  onRevealItem(itemId: string): void
  onDeleteItem(itemId: string): void
}

export function ArchiveWorkspace({
  folders,
  items,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onAddFiles,
  onMoveItem,
  onOpenItem,
  onRevealItem,
  onDeleteItem,
}: Props) {
  const [folderDraft, setFolderDraft] = useState('')
  const [folderDraftColor, setFolderDraftColor] = useState<ArchiveFolder['color']>('slate')
  const [showFolderForm, setShowFolderForm] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderDraft, setEditingFolderDraft] = useState('')
  const [editingFolderColor, setEditingFolderColor] = useState<ArchiveFolder['color']>('slate')
  const [dragOverFolderId, setDragOverFolderId] = useState<string | 'root' | null>(null)
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null)
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null)
  const [collapsedFolders, setCollapsedFolders] = usePersistedStringArray('narralab:collapsed:archive-folders')
  const [menuState, setMenuState] = useState<{ itemId: string; x: number; y: number } | null>(null)
  const [folderMenuState, setFolderMenuState] = useState<{ folderId: string; folderName: string; x: number; y: number } | null>(null)
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const folderSelectionAnchorRef = useRef<number | null>(null)
  const folderNodes = useMemo(() => buildArchiveFolderTree(folders, items), [folders, items])
  const folderIdOrder = useMemo(() => folderNodes.map((folder) => folder.id), [folderNodes])
  const folderById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders])
  const visibleSelectedFolderIds = useMemo(
    () => selectedFolderIds.filter((id) => folderIdOrder.includes(id)),
    [folderIdOrder, selectedFolderIds],
  )

  const filteredItems = useMemo(
    () => (selectedFolderId ? items.filter((item) => item.folderId === selectedFolderId) : items),
    [items, selectedFolderId],
  )
  const visibleItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase()
    if (!query) return filteredItems
    return filteredItems.filter((item) =>
      [item.name, item.filePath, item.extension, folderById.get(item.folderId ?? '')?.name ?? '']
        .join(' ')
        .toLocaleLowerCase()
        .includes(query),
    )
  }, [filteredItems, folderById, searchQuery])
  const activeFolder = selectedFolderId ? folderById.get(selectedFolderId) ?? null : null

  const menuItems = useMemo<ContextMenuItem[]>(() => {
    if (!menuState) return []
    return [
      { label: 'Open', onSelect: () => onOpenItem(menuState.itemId) },
      { label: 'Reveal in Finder', onSelect: () => onRevealItem(menuState.itemId) },
      {
        label: 'Delete From Archive',
        danger: true,
        onSelect: () => {
          if (window.confirm('Remove this file from the archive list? The file itself will not be deleted.')) {
            onDeleteItem(menuState.itemId)
          }
        },
      },
    ]
  }, [menuState, onDeleteItem, onOpenItem, onRevealItem])
  const folderMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!folderMenuState) return []
    const targetFolderIds = visibleSelectedFolderIds.includes(folderMenuState.folderId)
      ? visibleSelectedFolderIds
      : [folderMenuState.folderId]
    const depthById = new Map(folderNodes.map((node) => [node.id, node.depth]))
    const orderedFolderIds = [...targetFolderIds].sort((left, right) => (depthById.get(right) ?? 0) - (depthById.get(left) ?? 0))
    return [
      ...(targetFolderIds.length === 1
        ? [{
        label: 'Rename Folder',
        onSelect: () => {
          setEditingFolderId(folderMenuState.folderId)
          setEditingFolderDraft(folderMenuState.folderName)
          const folder = folders.find((entry) => entry.id === folderMenuState.folderId)
          setEditingFolderColor(folder?.color ?? 'slate')
        },
      }]
        : []),
      {
        label: 'Expand All',
        onSelect: () => {
          setCollapsedFolders((current) =>
            current.filter(
              (entry) =>
                !targetFolderIds.some((folderId) => isArchiveFolderDescendantOrSelf(entry, folderId, folderNodes)),
            ),
          )
        },
      },
      {
        label: targetFolderIds.length > 1 ? 'Delete Selection' : 'Delete Folder',
        danger: true,
        onSelect: () => {
          const confirmText =
            targetFolderIds.length > 1
              ? `Delete ${targetFolderIds.length} selected folders? Files will be moved to All Files.`
              : `Delete folder "${folderMenuState.folderName}"? Files will be moved to All Files.`
          if (window.confirm(confirmText)) {
            orderedFolderIds.forEach((folderId) => onDeleteFolder(folderId))
            setSelectedFolderIds([])
          }
        },
      },
    ]
  }, [folderMenuState, folderNodes, folders, onDeleteFolder, setCollapsedFolders, visibleSelectedFolderIds])

  const handleDropFiles = (event: DragEvent<HTMLDivElement>, folderId: string | null) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOverFolderId(null)
    if (draggedFolderId) {
      if (draggedFolderId !== folderId) {
        onUpdateFolder(draggedFolderId, { parentId: folderId })
        onSelectFolder(folderId)
      }
      setDraggedFolderId(null)
      return
    }

    if (draggedItemId) {
      onMoveItem(draggedItemId, folderId)
      onSelectFolder(folderId)
      setDraggedItemId(null)
      return
    }

    const paths = window.narralab.archive.items.resolveDroppedPaths(Array.from(event.dataTransfer.files))
    if (paths.length > 0) {
      onAddFiles(paths, folderId)
      onSelectFolder(folderId)
      return
    }

    const archiveItemId = event.dataTransfer.getData('application/x-narralab-archive-item')
    if (archiveItemId) {
      onMoveItem(archiveItemId, folderId)
      onSelectFolder(folderId)
    }
  }

  const submitNewFolder = () => {
    const name = folderDraft.trim()
    if (!name) return
    onCreateFolder(name, null, folderDraftColor)
    setFolderDraft('')
    setFolderDraftColor('slate')
    setShowFolderForm(false)
  }

  const handleFolderSelection = (event: MouseEvent<HTMLElement>, folderId: string) => {
    const { nextSelectedIds, nextAnchorIndex } = computeListSelection({
      id: folderId,
      orderedIds: folderIdOrder,
      selectedIds: visibleSelectedFolderIds,
      anchorIndex: folderSelectionAnchorRef.current,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey,
      ctrlKey: event.ctrlKey,
    })
    folderSelectionAnchorRef.current = nextAnchorIndex
    setSelectedFolderIds(nextSelectedIds)
    onSelectFolder(folderId)
  }

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Panel
        className="min-h-0 overflow-y-auto overscroll-contain p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setSelectedFolderIds([])
          }
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
            <LibraryBig className="h-4 w-4 text-accent" />
            <span>Archive</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowFolderForm((current) => !current)}>
            <Plus className="h-4 w-4" />
            Folder
          </Button>
        </div>

        {showFolderForm ? (
          <div className="mt-3 px-1">
            <InlineEditScope
              onSubmit={submitNewFolder}
              onCancel={() => {
                setFolderDraft('')
                setFolderDraftColor('slate')
                setShowFolderForm(false)
              }}
            >
              <div className="flex items-center gap-2">
                <InlineNameEditor
                  autoFocus
                  value={folderDraft}
                  placeholder="New archive folder"
                  onChange={setFolderDraft}
                  onSubmit={submitNewFolder}
                  onCancel={() => {
                    setFolderDraft('')
                    setFolderDraftColor('slate')
                    setShowFolderForm(false)
                  }}
                  className="flex-1"
                />
                <InlineEditActions
                  onSave={submitNewFolder}
                  onCancel={() => {
                    setFolderDraft('')
                    setFolderDraftColor('slate')
                    setShowFolderForm(false)
                  }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {sceneColors.map((color) => (
                  <button
                    key={`new-archive-folder-${color.value}`}
                    type="button"
                    className={cn(
                      'relative h-4 w-4 rounded-full border transition',
                      folderDraftColor === color.value ? 'border-white/90 ring-1 ring-white/40' : 'border-white/10',
                    )}
                    style={{ backgroundColor: color.hex }}
                    onClick={() => setFolderDraftColor(color.value)}
                    aria-label={color.label}
                    title={color.label}
                  >
                    {folderDraftColor === color.value ? (
                      <Check className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow" />
                    ) : null}
                  </button>
                ))}
              </div>
            </InlineEditScope>
          </div>
        ) : null}

        <div className="mt-4 space-y-1.5">
          <div
            className={cn(
              'rounded-xl border border-border/50 bg-panelMuted/20 px-2 py-1.5 transition',
              dragOverFolderId === 'root' && 'border-accent/60 bg-accent/10',
            )}
          >
              <FolderButton
                active={selectedFolderId === null}
                dropActive={dragOverFolderId === 'root'}
                selected={visibleSelectedFolderIds.length === 0 && selectedFolderId === null}
                label="All Files"
                count={items.length}
                color="slate"
                onClick={(event) => {
                  if (event.metaKey || event.ctrlKey) {
                    setSelectedFolderIds([])
                  }
                  onSelectFolder(null)
                }}
              onDragEnter={() => setDragOverFolderId('root')}
              onDragLeave={() => setDragOverFolderId((current) => (current === 'root' ? null : current))}
              onDragOver={(event) => {
                event.preventDefault()
                event.dataTransfer.dropEffect = draggedFolderId ? 'move' : 'copy'
              }}
              onDrop={(event) => handleDropFiles(event, null)}
            />
          </div>

          {folderNodes.map((folder) => (
            <div
              key={folder.id}
              className={cn(
                'rounded-xl border border-border/50 bg-panelMuted/20 px-2 py-1.5 transition',
                dragOverFolderId === folder.id && 'border-accent/60 bg-accent/10',
                visibleSelectedFolderIds.includes(folder.id) && 'border-accent/60 bg-accent/10 ring-2 ring-accent/15',
                hasCollapsedArchiveAncestor(folder.id, folderNodes, collapsedFolders) && 'hidden',
              )}
            >
              {editingFolderId === folder.id ? (
                <InlineEditScope
                  className="space-y-2 px-6 pb-1 pt-1"
                  onSubmit={() => {
                    const nextName = editingFolderDraft.trim()
                    if (nextName) {
                      onUpdateFolder(folder.id, { name: nextName, color: editingFolderColor })
                    }
                    setEditingFolderId(null)
                    setEditingFolderDraft('')
                  }}
                  onCancel={() => {
                    setEditingFolderId(null)
                    setEditingFolderDraft('')
                  }}
                >
                  <div className="flex items-center gap-2">
                    <InlineNameEditor
                      autoFocus
                      value={editingFolderDraft}
                      onChange={setEditingFolderDraft}
                      onSubmit={() => {
                        const nextName = editingFolderDraft.trim()
                        if (nextName) {
                          onUpdateFolder(folder.id, { name: nextName, color: editingFolderColor })
                        }
                        setEditingFolderId(null)
                        setEditingFolderDraft('')
                      }}
                      onCancel={() => {
                        setEditingFolderId(null)
                        setEditingFolderDraft('')
                      }}
                      className="h-7 min-w-[120px] flex-1 text-xs"
                    />
                    <InlineEditActions
                      onSave={() => {
                        const nextName = editingFolderDraft.trim()
                        if (nextName) {
                          onUpdateFolder(folder.id, { name: nextName, color: editingFolderColor })
                        }
                        setEditingFolderId(null)
                        setEditingFolderDraft('')
                      }}
                      onCancel={() => {
                        setEditingFolderId(null)
                        setEditingFolderDraft('')
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {sceneColors.map((color) => (
                      <button
                        key={`${folder.id}-${color.value}`}
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
              ) : (
                <ArchiveFolderRow
                  folder={folder}
                  collapsed={collapsedFolders.includes(folder.id)}
                  active={selectedFolderId === folder.id}
                  selected={visibleSelectedFolderIds.includes(folder.id)}
                  dropActive={dragOverFolderId === folder.id}
                  onRowClick={(event) => {
                    event.stopPropagation()
                    if (event.metaKey || event.ctrlKey) {
                      handleFolderSelection(event, folder.id)
                      onSelectFolder(folder.id)
                    } else {
                      onSelectFolder(folder.id)
                    }
                  }}
                  onToggleCollapse={(event) => {
                    event.stopPropagation()
                    setCollapsedFolders((current) =>
                      current.includes(folder.id)
                        ? current.filter((entry) => entry !== folder.id)
                        : [...current, folder.id],
                    )
                  }}
                  onRequestRename={() => {
                    setEditingFolderId(folder.id)
                    setEditingFolderDraft(folder.name)
                    setEditingFolderColor(folder.color)
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    const nextSelection = ensureContextSelection(folder.id, visibleSelectedFolderIds, folderIdOrder)
                    setSelectedFolderIds(nextSelection)
                    folderSelectionAnchorRef.current = folderIdOrder.indexOf(folder.id)
                    onSelectFolder(folder.id)
                    setFolderMenuState({ folderId: folder.id, folderName: folder.name, x: event.clientX, y: event.clientY })
                  }}
                  onDragStart={() => setDraggedFolderId(folder.id)}
                  onDragEnd={() => setDraggedFolderId(null)}
                  onDragEnter={() => setDragOverFolderId(folder.id)}
                  onDragLeave={() => setDragOverFolderId((current) => (current === folder.id ? null : current))}
                  onDragOver={(event) => {
                    event.preventDefault()
                    event.dataTransfer.dropEffect = draggedFolderId ? 'move' : 'copy'
                  }}
                  onDrop={(event) => handleDropFiles(event, folder.id)}
                />
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        className="flex min-h-0 flex-col overflow-hidden"
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = draggedFolderId ? 'move' : 'copy'
        }}
        onDrop={(event) => handleDropFiles(event, selectedFolderId)}
      >
        <div className="flex items-center justify-between border-b border-border/90 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
              <LibraryBig className="h-4 w-4 text-accent" />
              <span>{activeFolder ? formatFolderLabel(activeFolder.name) : 'Archive'}</span>
            </div>
            <div className="mt-1 text-sm text-muted">
              {activeFolder
                ? `${visibleItems.length} item${visibleItems.length === 1 ? '' : 's'} in selected folder.`
                : 'All archived links across folders. Drop onto a folder in the left panel to move items there.'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onAddFiles(null, selectedFolderId)}>
              <FolderOpen className="h-4 w-4" />
              Add Files
            </Button>
          </div>
        </div>

        <div className="border-b border-border/70 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pl-9"
              placeholder={activeFolder ? 'Search in this folder…' : 'Search archive…'}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {visibleItems.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md rounded-3xl border border-dashed border-border/90 bg-panelMuted/30 px-8 py-10 text-center">
                <div className="text-lg font-semibold text-foreground">
                  {searchQuery.trim() ? 'No matches' : 'Drop documents here'}
                </div>
                <div className="mt-2 text-sm text-muted">
                  {searchQuery.trim()
                    ? 'Try a different search, or clear the query.'
                    : 'PDFs, Word docs, spreadsheets, images, audio or video can all live here as local references.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.stopPropagation()
                    setDraggedItemId(item.id)
                    event.dataTransfer.setData('application/x-narralab-archive-item', item.id)
                    event.dataTransfer.setData('text/plain', item.id)
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => setDraggedItemId(null)}
                  onDoubleClick={() => onOpenItem(item.id)}
                  onContextMenu={(event) => openArchiveMenu(event, item.id, setMenuState)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-panelMuted/45 px-4 py-3 text-left transition hover:border-accent/30 hover:bg-panelMuted"
                >
                  <div className="shrink-0 text-muted">{archiveIconFor(item.kind)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate font-medium text-foreground">{item.name}</div>
                      <span className="shrink-0 rounded-full border border-border/70 bg-panel px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted">
                        {folderLabelForItem(item, folderById)}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-muted">{item.filePath}</div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted">
                    <div>{item.extension ? item.extension.toUpperCase() : item.kind}</div>
                    <div className={cn(item.exists ? 'text-muted' : 'text-red-200')}>
                      {item.exists ? formatFileSize(item.fileSize) : 'Missing'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Panel>

      <ContextMenu
        open={Boolean(menuState)}
        x={menuState?.x ?? 0}
        y={menuState?.y ?? 0}
        items={menuItems}
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

type ArchiveFolderTreeNode = ArchiveFolder & {
  depth: number
  childIds: string[]
  itemCount: number
}

function ArchiveFolderRow({
  folder,
  collapsed,
  active,
  selected,
  dropActive,
  onRowClick,
  onToggleCollapse,
  onRequestRename,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  folder: ArchiveFolderTreeNode
  collapsed: boolean
  active: boolean
  selected: boolean
  dropActive: boolean
  onRowClick(event: MouseEvent<HTMLDivElement>): void
  onToggleCollapse(event: MouseEvent<HTMLButtonElement>): void
  onRequestRename(): void
  onContextMenu(event: MouseEvent<HTMLDivElement>): void
  onDragStart(): void
  onDragEnd(): void
  onDragEnter(): void
  onDragOver(event: DragEvent<HTMLDivElement>): void
  onDragLeave(): void
  onDrop(event: DragEvent<HTMLDivElement>): void
}) {
  const collapsible = folder.childIds.length > 0

  return (
    <div
      draggable
      className={cn(
        'flex min-h-8 items-center gap-2 rounded-lg px-1 py-0.5 transition text-muted',
        dropActive
          ? 'bg-accent/12 ring-1 ring-accent/45'
          : selected
            ? 'bg-accent/10 text-foreground ring-1 ring-accent/35'
            : active
              ? 'bg-white/[0.05] text-foreground'
              : 'hover:bg-panelMuted/50 hover:text-foreground',
      )}
      onDragEnter={(event) => {
        event.preventDefault()
        onDragEnter()
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        const nextTarget = event.relatedTarget
        if (nextTarget && event.currentTarget.contains(nextTarget as Node)) return
        onDragLeave()
      }}
      onDragOver={(event) => {
        event.preventDefault()
        onDragOver(event)
      }}
      onDrop={onDrop}
      onClick={onRowClick}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ paddingLeft: `${folder.depth * 14 + 4}px` }}
    >
      {collapsible ? (
        <button
          type="button"
          className="flex shrink-0 items-center rounded-md px-1 py-0.5 transition hover:bg-panelMuted hover:text-foreground"
          onClick={onToggleCollapse}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: colorHex(folder.color) }} />
      <button
        type="button"
        className="min-w-0 flex-1 rounded-md px-1 py-0.5 text-left transition hover:bg-panelMuted hover:text-foreground"
        onDoubleClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onRequestRename()
        }}
      >
        <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.18em]">
          {formatFolderLabel(folder.name)}
        </span>
      </button>
      <div className="ml-2 flex shrink-0 items-center gap-2 text-[10px] text-muted/80">
        <span className="min-w-4 text-right">{folder.itemCount}</span>
      </div>
    </div>
  )
}

function FolderButton({
  collapsible,
  collapsed,
  active,
  selected,
  dropActive,
  label,
  count,
  color,
  depth = 0,
  onClick,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  collapsible?: boolean
  collapsed?: boolean
  active: boolean
  selected?: boolean
  dropActive?: boolean
  label: string
  count: number
  color: ArchiveFolder['color']
  depth?: number
  onClick(event: MouseEvent<HTMLDivElement>): void
  onContextMenu?(event: MouseEvent<HTMLDivElement>): void
  onDragStart?(): void
  onDragEnd?(): void
  onDragEnter?(): void
  onDragOver?(event: DragEvent<HTMLDivElement>): void
  onDragLeave?(): void
  onDrop(event: DragEvent<HTMLDivElement>): void
}) {
  return (
    <div
      draggable={Boolean(onDragStart)}
      className={cn(
        'flex min-h-8 items-center gap-2 rounded-lg px-1 py-0.5 transition text-muted',
        dropActive
          ? 'bg-accent/12 ring-1 ring-accent/45'
          : selected
            ? 'bg-accent/10 text-foreground ring-1 ring-accent/35'
          : active
            ? 'bg-white/[0.05] text-foreground'
            : 'hover:bg-panelMuted/50 hover:text-foreground',
      )}
      onDragEnter={(event) => {
        event.preventDefault()
        onDragEnter?.()
      }}
      onDragLeave={(event) => {
        event.preventDefault()
        const nextTarget = event.relatedTarget
        if (nextTarget && event.currentTarget.contains(nextTarget as Node)) return
        onDragLeave?.()
      }}
      onDragOver={(event) => {
        event.preventDefault()
        onDragOver?.(event)
      }}
      onDrop={onDrop}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ paddingLeft: `${depth * 14 + 4}px` }}
    >
      {collapsible ? (
        <button
          type="button"
          className="flex shrink-0 items-center rounded-md px-1 py-0.5 transition hover:bg-panelMuted hover:text-foreground"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: colorHex(color) }} />
      <div className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.18em]">
          {formatFolderLabel(label)}
        </span>
      </div>
      <div className="ml-2 flex shrink-0 items-center gap-2 text-[10px] text-muted/80">
        <span className="min-w-4 text-right">{count}</span>
      </div>
    </div>
  )
}

function archiveIconFor(kind: ArchiveItem['kind']) {
  switch (kind) {
    case 'image':
      return <FileImage className="h-4 w-4" />
    case 'audio':
      return <FileAudio2 className="h-4 w-4" />
    case 'video':
      return <FileVideo2 className="h-4 w-4" />
    case 'spreadsheet':
      return <FileSpreadsheet className="h-4 w-4" />
    default:
      return <FileText className="h-4 w-4" />
  }
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024 * 1024) return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`
  if (size >= 1024) return `${Math.round(size / 1024)} KB`
  return `${size} B`
}

function colorHex(color: ArchiveFolder['color']) {
  return sceneColors.find((entry) => entry.value === color)?.hex ?? '#607086'
}

function formatFolderLabel(label: string) {
  return label.toLocaleUpperCase('nb-NO')
}

function folderLabelForItem(item: ArchiveItem, folderById: Map<string, ArchiveFolder>) {
  if (!item.folderId) {
    return 'Loose'
  }

  return folderById.get(item.folderId)?.name ?? 'Folder'
}

function buildArchiveFolderTree(folders: ArchiveFolder[], items: ArchiveItem[]) {
  const childrenByParent = new Map<string | null, ArchiveFolder[]>()

  folders.forEach((folder) => {
    const key = folder.parentId ?? null
    const existing = childrenByParent.get(key) ?? []
    existing.push(folder)
    childrenByParent.set(key, existing)
  })

  childrenByParent.forEach((group) => {
    group.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
  })

  const nodes: Array<ArchiveFolder & { depth: number; childIds: string[]; itemCount: number }> = []

  const walk = (parentId: string | null, depth: number) => {
    const children = childrenByParent.get(parentId) ?? []
    children.forEach((folder) => {
      const childIds = (childrenByParent.get(folder.id) ?? []).map((entry) => entry.id)
      nodes.push({
        ...folder,
        depth,
        childIds,
        itemCount: items.filter((item) => item.folderId === folder.id).length,
      })
      walk(folder.id, depth + 1)
    })
  }

  walk(null, 0)
  return nodes
}

function hasCollapsedArchiveAncestor(
  folderId: string,
  nodes: Array<ArchiveFolder & { depth: number; childIds: string[]; itemCount: number }>,
  collapsedFolders: string[],
) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  let current = nodeById.get(folderId) ?? null

  while (current?.parentId) {
    if (collapsedFolders.includes(current.parentId)) {
      return true
    }
    current = nodeById.get(current.parentId) ?? null
  }

  return false
}

function isArchiveFolderDescendantOrSelf(
  folderId: string,
  ancestorId: string,
  nodes: Array<ArchiveFolder & { depth: number; childIds: string[]; itemCount: number }>,
) {
  if (folderId === ancestorId) {
    return true
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  let current = nodeById.get(folderId) ?? null

  while (current?.parentId) {
    if (current.parentId === ancestorId) {
      return true
    }
    current = nodeById.get(current.parentId) ?? null
  }

  return false
}

function openArchiveMenu(
  event: MouseEvent<HTMLButtonElement>,
  itemId: string,
  setMenuState: (state: { itemId: string; x: number; y: number }) => void,
) {
  event.preventDefault()
  setMenuState({ itemId, x: event.clientX, y: event.clientY })
}
