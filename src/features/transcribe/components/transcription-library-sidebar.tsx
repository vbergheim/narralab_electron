import { useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderPlus,
  MoreVertical,
  Plus,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/ui/panel'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'
import { sceneColors } from '@/lib/constants'
import type { TranscriptionFolder, TranscriptionItem } from '@/types/transcription'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { InlineEditActions, InlineEditScope, InlineNameEditor } from '@/components/ui/inline-name-editor'
import { usePersistedStringArray } from '@/hooks/use-persisted-string-array'
import { comparePathDepthDesc, computeListSelection, ensureContextSelection } from '@/lib/selection'
import { getDraggedTranscriptionItemIds, writeTranscriptionDragData } from '@/lib/transcription-drag'

const ROOT_TX_FOLDER_KEY = '__root__'

type Props = {
  folders: TranscriptionFolder[]
  items: TranscriptionItem[]
  selectedItemId: string | null
  onSelectItem: (itemId: string) => void
  onCreateFolder: (name: string, parentPath?: string | null) => void
  onUpdateFolder: (
    currentPath: string,
    input: { name?: string; color?: TranscriptionFolder['color']; parentPath?: string | null },
  ) => void
  onDeleteFolder: (currentPath: string) => void
  onMoveItemsToFolder: (itemIds: string[], folderPath: string) => void
  onUpdateItem: (itemId: string, name: string) => void
  onDeleteItem: (itemId: string) => void
  onNewTranscription: () => void
}

function formatFolderLabel(label: string) {
  return label.toLocaleUpperCase('nb-NO')
}

function colorHex(color: TranscriptionFolder['color']) {
  return sceneColors.find((entry) => entry.value === color)?.hex ?? '#607086'
}

function hasCollapsedAncestor(path: string, collapsedFolders: string[]) {
  return collapsedFolders.some((collapsedPath) => path !== collapsedPath && path.startsWith(`${collapsedPath}/`))
}

function groupTranscriptionItems(items: TranscriptionItem[], folders: TranscriptionFolder[]) {
  type ItemGroup = {
    folderPath: string
    label: string
    color: TranscriptionFolder['color']
    items: TranscriptionItem[]
    depth: number
    parentPath: string | null
    sortOrder: number
  }

  const groups = new Map<string, ItemGroup>()
  const rootItems: TranscriptionItem[] = []

  folders.forEach((folder) => {
    groups.set(folder.path, {
      folderPath: folder.path,
      label: folder.name,
      color: folder.color,
      items: [],
      depth: folder.path.split('/').length - 1,
      parentPath: folder.parentPath,
      sortOrder: folder.sortOrder,
    })
  })

  items.forEach((item) => {
    const folderPath = item.folder.trim()
    if (!folderPath) {
      rootItems.push(item)
      return
    }

    if (!groups.has(folderPath)) {
      groups.set(folderPath, {
        folderPath,
        label: folderPath.split('/').at(-1) ?? folderPath,
        color: 'slate',
        items: [],
        depth: folderPath.split('/').length - 1,
        parentPath: folderPath.includes('/') ? folderPath.split('/').slice(0, -1).join('/') : null,
        sortOrder: Number.MAX_SAFE_INTEGER,
      })
    }

    groups.get(folderPath)?.items.push(item)
  })

  const knownPaths = new Set(groups.keys())
  const childrenByParent = new Map<string | null, ItemGroup[]>()

  Array.from(groups.values()).forEach((group) => {
    const parentPath = group.parentPath && knownPaths.has(group.parentPath) ? group.parentPath : null
    const siblings = childrenByParent.get(parentPath) ?? []
    siblings.push(group)
    childrenByParent.set(parentPath, siblings)
  })

  childrenByParent.forEach((siblings) => {
    siblings.sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label))
  })

  const orderedGroups: ItemGroup[] = []
  const visit = (parentPath: string | null) => {
    const children = childrenByParent.get(parentPath) ?? []
    children.forEach((child) => {
      orderedGroups.push(child)
      visit(child.folderPath)
    })
  }

  visit(null)

  return {
    rootItems,
    groups: orderedGroups,
  }
}

export function TranscriptionLibrarySidebar({
  folders,
  items,
  selectedItemId,
  onSelectItem,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveItemsToFolder,
  onUpdateItem,
  onDeleteItem,
  onNewTranscription,
}: Props) {
  const [search, setSearch] = useState('')
  const [collapsedFolders, setCollapsedFolders] = usePersistedStringArray('narralab:collapsed:transcription-folders')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [menuState, setMenuState] = useState<{ id: string; x: number; y: number } | null>(null)
  const [folderMenuState, setFolderMenuState] = useState<{
    folderPath: string
    color: TranscriptionFolder['color']
    x: number
    y: number
  } | null>(null)
  const [folderFormOpen, setFolderFormOpen] = useState(false)
  const [folderDraft, setFolderDraft] = useState('')
  const [dragOverFolderPath, setDragOverFolderPath] = useState<string | null>(null)
  const [draggedFolderPath, setDraggedFolderPath] = useState<string | null>(null)
  const [selectedFolderPaths, setSelectedFolderPaths] = useState<string[]>([])
  const folderSelectionAnchorRef = useRef<number | null>(null)

  const filteredItems = useMemo(() => {
    if (!search) return items
    const s = search.toLowerCase()
    return items.filter((item) => item.name.toLowerCase().includes(s))
  }, [items, search])

  const grouped = useMemo(() => groupTranscriptionItems(filteredItems, folders), [filteredItems, folders])
  const folderPathOrder = useMemo(() => grouped.groups.map((g) => g.folderPath), [grouped.groups])
  const visibleSelectedFolderPaths = useMemo(
    () => selectedFolderPaths.filter((path) => folderPathOrder.includes(path)),
    [selectedFolderPaths, folderPathOrder],
  )

  const submitNewFolder = () => {
    const name = folderDraft.trim()
    if (!name) return
    onCreateFolder(name, null)
    setFolderDraft('')
    setFolderFormOpen(false)
  }

  const handleDropToFolder = (event: React.DragEvent, folderPath: string) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOverFolderPath(null)
    if (draggedFolderPath) {
      if (draggedFolderPath !== folderPath) {
        onUpdateFolder(draggedFolderPath, { parentPath: folderPath || null })
      }
      setDraggedFolderPath(null)
      return
    }
    const ids = getDraggedTranscriptionItemIds(event.dataTransfer)
    if (ids.length === 0) return
    onMoveItemsToFolder(ids, folderPath)
    void window.narralab.windows.setDragSession(null)
  }

  const allowDropWhileDragging = (event: React.DragEvent) => {
    if (getDraggedTranscriptionItemIds(event.dataTransfer).length > 0 || draggedFolderPath) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  const handleFolderSelection = (event: React.MouseEvent<HTMLElement>, folderPath: string) => {
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

  const [editingFolderName, setEditingFolderName] = useState<string | null>(null)
  const [editingFolderDraft, setEditingFolderDraft] = useState('')
  const [editingFolderColor, setEditingFolderColor] = useState<TranscriptionFolder['color']>('slate')

  const submitFolderEdit = () => {
    if (!editingFolderName) return
    const nextName = editingFolderDraft.trim()
    if (!nextName) return
    onUpdateFolder(editingFolderName, { name: nextName, color: editingFolderColor })
    setEditingFolderName(null)
    setEditingFolderDraft('')
  }

  const folderMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!folderMenuState) return []
    const targetFolderPaths = visibleSelectedFolderPaths.includes(folderMenuState.folderPath)
      ? visibleSelectedFolderPaths
      : [folderMenuState.folderPath]
    const orderedFolderPaths = [...targetFolderPaths].sort(comparePathDepthDesc)

    return [
      ...(targetFolderPaths.length === 1
        ? [
            {
              label: 'Rename Folder',
              onSelect: () => {
                setEditingFolderName(folderMenuState.folderPath)
                setEditingFolderDraft(folderMenuState.folderPath.split('/').at(-1) ?? folderMenuState.folderPath)
                setEditingFolderColor(folderMenuState.color)
              },
            },
          ]
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
              ? `Delete ${targetFolderPaths.length} selected folders? Transcripts will move to the library root.`
              : `Delete folder "${folderMenuState.folderPath}"? Transcripts will move to the library root.`
          if (window.confirm(confirmText)) {
            orderedFolderPaths.forEach((folderPath) => onDeleteFolder(folderPath))
            setSelectedFolderPaths([])
          }
        },
      },
    ]
  }, [folderMenuState, onDeleteFolder, setCollapsedFolders, visibleSelectedFolderPaths])

  const itemContextMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!menuState) return []
    const id = menuState.id
    const name = items.find((i) => i.id === id)?.name ?? ''

    return [
      {
        label: 'Rename',
        onSelect: () => {
          setEditValue(name)
          setEditingId(id)
        },
      },
      {
        label: 'Delete Transcript',
        danger: true,
        onSelect: () => {
          if (confirm('Delete this transcript?')) {
            onDeleteItem(id)
          }
        },
      },
    ]
  }, [menuState, items, onDeleteItem])

  return (
    <Panel className="flex min-h-0 flex-col overflow-hidden bg-panel/50">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border/60 p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-[11px] font-bold uppercase tracking-widest text-muted">Library</h3>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              title="New Folder"
              className="h-7 w-7 p-0"
              onClick={() => setFolderFormOpen((o) => !o)}
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/60" />
          <Input
            className="h-8 pl-8 text-xs"
            placeholder="Search library..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Button variant="accent" size="sm" className="w-full justify-start gap-2" onClick={onNewTranscription}>
          <Plus className="h-4 w-4" />
          New Transcription
        </Button>
      </div>

      {folderFormOpen ? (
        <div className="shrink-0 border-b border-border/40 px-4 py-3">
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
                placeholder="New transcription folder"
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
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 pt-2 scrollbar-thin"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDragOverFolderPath(null)
          if (draggedFolderPath) {
            onUpdateFolder(draggedFolderPath, { parentPath: null })
            setDraggedFolderPath(null)
            return
          }
          const ids = getDraggedTranscriptionItemIds(e.dataTransfer)
          if (ids.length > 0) {
            onMoveItemsToFolder(ids, '')
            void window.narralab.windows.setDragSession(null)
          }
        }}
      >
        {grouped.groups.length > 0 ? (
          <div className="space-y-1.5">
            {grouped.groups.map((group) => (
              <div
                key={group.folderPath}
                className={cn(
                  'rounded-xl border border-border/50 bg-panelMuted/20 px-2 py-1.5 transition',
                  dragOverFolderPath === group.folderPath && 'border-accent/60 bg-accent/10',
                  visibleSelectedFolderPaths.includes(group.folderPath) && 'border-accent/60 bg-accent/10 ring-2 ring-accent/15',
                  hasCollapsedAncestor(group.folderPath, collapsedFolders) && 'hidden',
                )}
                onDragEnter={() => setDragOverFolderPath(group.folderPath)}
                onDragLeave={(event) => {
                  const nextTarget = event.relatedTarget
                  if (nextTarget && event.currentTarget.contains(nextTarget as Node)) return
                  setDragOverFolderPath((current) => (current === group.folderPath ? null : current))
                }}
                onDragOver={(event) => {
                  if (getDraggedTranscriptionItemIds(event.dataTransfer).length > 0 || draggedFolderPath) {
                    event.preventDefault()
                  }
                }}
                onDrop={(event) => handleDropToFolder(event, group.folderPath)}
              >
                <div
                  draggable
                  className="flex min-h-8 items-center justify-between gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted"
                  style={{ paddingLeft: `${group.depth * 14 + 4}px` }}
                  onDragStart={() => setDraggedFolderPath(group.folderPath)}
                  onDragEnd={() => setDraggedFolderPath(null)}
                  onDragOver={allowDropWhileDragging}
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
                  <span className="min-w-4 text-right text-[10px] text-muted/80">{group.items.length}</span>
                </div>

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
                  className={cn('mt-1.5 space-y-1 pl-5', collapsedFolders.includes(group.folderPath) && 'hidden')}
                  onDragOver={allowDropWhileDragging}
                >
                  {group.items.map((item) => {
                    const isActive = selectedItemId === item.id
                    const isEditing = editingId === item.id
                    return (
                      <div
                        key={item.id}
                        draggable={!isEditing}
                        onDragStart={(ev) => {
                          if (isEditing) {
                            ev.preventDefault()
                            return
                          }
                          writeTranscriptionDragData(ev.dataTransfer, [item.id])
                          void window.narralab.windows.setDragSession({ kind: 'transcription', itemIds: [item.id] })
                        }}
                        onDragEnd={() => {
                          window.setTimeout(() => {
                            void window.narralab.windows.setDragSession(null)
                          }, 2000)
                        }}
                        onDragOver={allowDropWhileDragging}
                        className={cn(
                          'group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition',
                          isActive ? 'bg-accent/10 text-accent' : 'hover:bg-panelMuted/30 text-foreground/70',
                          'cursor-pointer',
                        )}
                        onClick={() => onSelectItem(item.id)}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          setMenuState({ id: item.id, x: e.clientX, y: e.clientY })
                        }}
                      >
                        <FileText className={cn('h-4 w-4 shrink-0', isActive ? 'text-accent' : 'text-muted/60')} />
                        {isEditing ? (
                          <InlineNameEditor
                            value={editValue}
                            onChange={setEditValue}
                            onSubmit={() => {
                              onUpdateItem(item.id, editValue)
                              setEditingId(null)
                            }}
                            onCancel={() => setEditingId(null)}
                            className="flex-1"
                          />
                        ) : (
                          <span className="flex-1 truncate">{item.name}</span>
                        )}
                        <button
                          title="Item actions"
                          className="opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMenuState({ id: item.id, x: e.clientX, y: e.clientY })
                          }}
                        >
                          <MoreVertical className="h-3.5 w-3.5 text-muted" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {grouped.rootItems.length > 0 ? (
          <div
            className={cn(
              grouped.groups.length > 0 && 'mt-4',
              'space-y-1 rounded-xl transition',
              dragOverFolderPath === ROOT_TX_FOLDER_KEY && 'bg-accent/8 ring-1 ring-accent/35',
            )}
            onDragEnter={() => setDragOverFolderPath(ROOT_TX_FOLDER_KEY)}
            onDragLeave={(event) => {
              const nextTarget = event.relatedTarget
              if (nextTarget && event.currentTarget.contains(nextTarget as Node)) return
              setDragOverFolderPath((current) => (current === ROOT_TX_FOLDER_KEY ? null : current))
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDropToFolder(event, '')}
          >
            {grouped.groups.length > 0 ? (
              <div className="px-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Loose Transcripts
              </div>
            ) : null}
            {grouped.rootItems.map((item) => {
              const isActive = selectedItemId === item.id
              const isEditing = editingId === item.id
              return (
                <div
                  key={item.id}
                  draggable={!isEditing}
                  onDragStart={(ev) => {
                    if (isEditing) {
                      ev.preventDefault()
                      return
                    }
                    writeTranscriptionDragData(ev.dataTransfer, [item.id])
                    void window.narralab.windows.setDragSession({ kind: 'transcription', itemIds: [item.id] })
                  }}
                  onDragEnd={() => {
                    window.setTimeout(() => {
                      void window.narralab.windows.setDragSession(null)
                    }, 2000)
                  }}
                  onDragOver={allowDropWhileDragging}
                  className={cn(
                    'group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition',
                    isActive ? 'bg-accent/10 text-accent' : 'hover:bg-panelMuted/30 text-foreground/70',
                    'cursor-pointer',
                  )}
                  onClick={() => onSelectItem(item.id)}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    setMenuState({ id: item.id, x: e.clientX, y: e.clientY })
                  }}
                >
                  <FileText className={cn('h-4 w-4 shrink-0', isActive ? 'text-accent' : 'text-muted/60')} />
                  {isEditing ? (
                    <InlineNameEditor
                      value={editValue}
                      onChange={setEditValue}
                      onSubmit={() => {
                        onUpdateItem(item.id, editValue)
                        setEditingId(null)
                      }}
                      onCancel={() => setEditingId(null)}
                      className="flex-1"
                    />
                  ) : (
                    <span className="flex-1 truncate">{item.name}</span>
                  )}
                  <button
                    title="Item actions"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuState({ id: item.id, x: e.clientX, y: e.clientY })
                    }}
                  >
                    <MoreVertical className="h-3.5 w-3.5 text-muted" />
                  </button>
                </div>
              )
            })}
          </div>
        ) : null}

        {folders.length === 0 && items.length === 0 && (
          <div className="mt-8 px-4 text-center text-xs text-muted/60">No saved transcriptions yet.</div>
        )}
      </div>

      {menuState ? (
        <ContextMenu
          open={true}
          x={menuState.x}
          y={menuState.y}
          items={itemContextMenuItems}
          onClose={() => setMenuState(null)}
        />
      ) : null}
      {folderMenuState ? (
        <ContextMenu
          open={true}
          x={folderMenuState.x}
          y={folderMenuState.y}
          items={folderMenuItems}
          onClose={() => setFolderMenuState(null)}
        />
      ) : null}
    </Panel>
  )
}
