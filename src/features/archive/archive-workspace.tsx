import type { DragEvent, MouseEvent } from 'react'
import { useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileAudio2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo2,
  Folder,
  FolderOpen,
  Plus,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { Panel } from '@/components/ui/panel'
import { usePersistedStringArray } from '@/hooks/use-persisted-string-array'
import { cn } from '@/lib/cn'
import { sceneColors } from '@/lib/constants'
import type { ArchiveFolder, ArchiveItem } from '@/types/archive'

type Props = {
  folders: ArchiveFolder[]
  items: ArchiveItem[]
  selectedFolderId: string | null
  onSelectFolder(folderId: string | null): void
  onCreateFolder(name: string, parentId?: string | null): void
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
  const [showFolderForm, setShowFolderForm] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderDraft, setEditingFolderDraft] = useState('')
  const [editingFolderColor, setEditingFolderColor] = useState<ArchiveFolder['color']>('slate')
  const [dragOverFolderId, setDragOverFolderId] = useState<string | 'root' | null>(null)
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null)
  const [collapsedFolders, setCollapsedFolders] = usePersistedStringArray('docudoc:collapsed:archive-folders')
  const [menuState, setMenuState] = useState<{ itemId: string; x: number; y: number } | null>(null)
  const [folderMenuState, setFolderMenuState] = useState<{ folderId: string; folderName: string; x: number; y: number } | null>(null)
  const folderNodes = useMemo(() => buildArchiveFolderTree(folders, items), [folders, items])

  const filteredItems = useMemo(
    () => (selectedFolderId ? items.filter((item) => item.folderId === selectedFolderId) : items),
    [items, selectedFolderId],
  )

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
    return [
      {
        label: 'Rename Folder',
        onSelect: () => {
          setEditingFolderId(folderMenuState.folderId)
          setEditingFolderDraft(folderMenuState.folderName)
          const folder = folders.find((entry) => entry.id === folderMenuState.folderId)
          setEditingFolderColor(folder?.color ?? 'slate')
        },
      },
      {
        label: 'Delete Folder',
        danger: true,
        onSelect: () => {
          if (window.confirm(`Delete folder "${folderMenuState.folderName}"? Files will be moved to All Files.`)) {
            onDeleteFolder(folderMenuState.folderId)
          }
        },
      },
    ]
  }, [folderMenuState, folders, onDeleteFolder])

  const handleDropFiles = (event: DragEvent<HTMLDivElement>, folderId: string | null) => {
    event.preventDefault()
    setDragOverFolderId(null)
    if (draggedFolderId) {
      if (draggedFolderId !== folderId) {
        onUpdateFolder(draggedFolderId, { parentId: folderId })
      }
      setDraggedFolderId(null)
      return
    }
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path ?? '')
      .filter(Boolean)
    if (paths.length > 0) {
      onAddFiles(paths, folderId)
      return
    }

    const archiveItemId = event.dataTransfer.getData('application/x-docudoc-archive-item')
    if (archiveItemId) {
      onMoveItem(archiveItemId, folderId)
    }
  }

  const submitNewFolder = () => {
    const name = folderDraft.trim()
    if (!name) return
    onCreateFolder(name, null)
    setFolderDraft('')
    setShowFolderForm(false)
  }

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Panel className="min-h-0 overflow-y-auto p-4">
        <div className="flex items-center justify-between">
          <div className="font-display text-lg font-semibold text-foreground">Archive</div>
          <Button variant="ghost" size="sm" onClick={() => setShowFolderForm((current) => !current)}>
            <Plus className="h-4 w-4" />
            Folder
          </Button>
        </div>

        {showFolderForm ? (
          <div className="mt-3 flex items-center gap-2">
            <Input
              value={folderDraft}
              onChange={(event) => setFolderDraft(event.target.value)}
              placeholder="New archive folder"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  submitNewFolder()
                }
              }}
            />
            <Button
              size="sm"
              onClick={submitNewFolder}
            >
              Add
            </Button>
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
              label="All Files"
              count={items.length}
              color="slate"
              onClick={() => onSelectFolder(null)}
              onDragEnter={() => setDragOverFolderId('root')}
              onDragLeave={() => setDragOverFolderId((current) => (current === 'root' ? null : current))}
              onDrop={(event) => handleDropFiles(event, null)}
            />
          </div>

          {folderNodes.map((folder) => (
            <div
              key={folder.id}
              className={cn(
                'rounded-xl border border-border/50 bg-panelMuted/20 px-2 py-1.5 transition',
                dragOverFolderId === folder.id && 'border-accent/60 bg-accent/10',
                hasCollapsedArchiveAncestor(folder.id, folderNodes, collapsedFolders) && 'hidden',
              )}
            >
              {editingFolderId === folder.id ? (
                <div className="space-y-2 px-4 py-1">
                  <div className="flex items-center gap-2">
                    <Input
                      autoFocus
                      value={editingFolderDraft}
                      onChange={(event) => setEditingFolderDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          const nextName = editingFolderDraft.trim()
                          if (nextName) {
                            onUpdateFolder(folder.id, { name: nextName, color: editingFolderColor })
                          }
                          setEditingFolderId(null)
                          setEditingFolderDraft('')
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          setEditingFolderId(null)
                          setEditingFolderDraft('')
                        }
                      }}
                      className="h-7 text-xs"
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
                </div>
              ) : (
                <FolderButton
                  collapsible={folder.childIds.length > 0}
                  collapsed={collapsedFolders.includes(folder.id)}
                  active={selectedFolderId === folder.id}
                  dropActive={dragOverFolderId === folder.id}
                  label={folder.name}
                  count={folder.itemCount}
                  color={folder.color}
                  depth={folder.depth}
                  onClick={() => onSelectFolder(folder.id)}
                  onDoubleClick={() => {
                    setEditingFolderId(folder.id)
                    setEditingFolderDraft(folder.name)
                    setEditingFolderColor(folder.color)
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setFolderMenuState({ folderId: folder.id, folderName: folder.name, x: event.clientX, y: event.clientY })
                  }}
                  onToggleCollapse={() =>
                    setCollapsedFolders((current) =>
                      current.includes(folder.id)
                        ? current.filter((entry) => entry !== folder.id)
                        : [...current, folder.id],
                    )
                  }
                  onDragStart={() => setDraggedFolderId(folder.id)}
                  onDragEnd={() => setDraggedFolderId(null)}
                  onDragEnter={() => setDragOverFolderId(folder.id)}
                  onDragLeave={() => setDragOverFolderId((current) => (current === folder.id ? null : current))}
                  onDrop={(event) => handleDropFiles(event, folder.id)}
                />
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel
        className="flex min-h-0 flex-col overflow-hidden"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleDropFiles(event, selectedFolderId)}
      >
        <div className="flex items-center justify-between border-b border-border/90 px-5 py-4">
          <div>
            <div className="font-display text-xl font-semibold text-foreground">Document Archive</div>
            <div className="mt-1 text-sm text-muted">
              Drag files in from Finder, or add them manually. Files stay where they are; the archive stores local references.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onAddFiles(null, selectedFolderId)}>
              <FolderOpen className="h-4 w-4" />
              Add Files
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {filteredItems.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="max-w-md rounded-3xl border border-dashed border-border/90 bg-panelMuted/30 px-8 py-10 text-center">
                <div className="text-lg font-semibold text-foreground">Drop documents here</div>
                <div className="mt-2 text-sm text-muted">
                  PDFs, Word docs, spreadsheets, images, audio or video can all live here as local references.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/x-docudoc-archive-item', item.id)
                    event.dataTransfer.effectAllowed = 'move'
                  }}
                  onDoubleClick={() => onOpenItem(item.id)}
                  onContextMenu={(event) => openArchiveMenu(event, item.id, setMenuState)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-panelMuted/45 px-4 py-3 text-left transition hover:border-accent/30 hover:bg-panelMuted"
                >
                  <div className="shrink-0 text-muted">{archiveIconFor(item.kind)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{item.name}</div>
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

function FolderButton({
  collapsible,
  collapsed,
  active,
  dropActive,
  label,
  count,
  color,
  depth = 0,
  onClick,
  onDoubleClick,
  onContextMenu,
  onToggleCollapse,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragLeave,
  onDrop,
}: {
  collapsible?: boolean
  collapsed?: boolean
  active: boolean
  dropActive?: boolean
  label: string
  count: number
  color: ArchiveFolder['color']
  depth?: number
  onClick(): void
  onDoubleClick?(): void
  onContextMenu?(event: MouseEvent<HTMLDivElement>): void
  onToggleCollapse?(): void
  onDragStart?(): void
  onDragEnd?(): void
  onDragEnter?(): void
  onDragLeave?(): void
  onDrop(event: DragEvent<HTMLDivElement>): void
}) {
  return (
    <div
      draggable={Boolean(onDragStart)}
      className={cn(
        'flex min-h-8 items-center gap-2 rounded-lg px-1 py-0.5 transition',
        dropActive
          ? 'bg-accent/12 ring-1 ring-accent/45'
          : active
            ? 'bg-white/[0.05]'
            : 'hover:bg-panelMuted/50',
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
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{ paddingLeft: `${depth * 14 + 4}px` }}
    >
      {collapsible ? (
        <button
          type="button"
          className="flex shrink-0 items-center rounded-md px-1 py-0.5 transition hover:bg-panelMuted hover:text-foreground"
          onClick={(event) => {
            event.stopPropagation()
            onToggleCollapse?.()
          }}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <span className="w-3.5 shrink-0" />
      )}
      <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: colorHex(color) }} />
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        <span className="truncate font-medium text-foreground">{formatFolderLabel(label)}</span>
      </button>
      <div className="ml-2 flex shrink-0 items-center gap-2 text-xs text-muted">
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

function openArchiveMenu(
  event: MouseEvent<HTMLButtonElement>,
  itemId: string,
  setMenuState: (state: { itemId: string; x: number; y: number }) => void,
) {
  event.preventDefault()
  setMenuState({ itemId, x: event.clientX, y: event.clientY })
}
