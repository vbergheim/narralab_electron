import type { DragEvent, MouseEvent, ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Filter,
  Folder,
  FolderPlus,
  LayoutGrid,
  Plus,
  Trash2,
  X,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { Panel } from '@/components/ui/panel'
import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { InlineEditActions, InlineEditScope, InlineNameEditor } from '@/components/ui/inline-name-editor'
import { SceneBankFilters } from '@/features/scenes/scene-bank-filters'
import { SceneBankRow } from '@/features/scenes/scene-bank-row'
import { usePersistedStringArray } from '@/hooks/use-persisted-string-array'
import { sceneColors } from '@/lib/constants'
import { comparePathDepthDesc, computeListSelection, ensureContextSelection } from '@/lib/selection'
import { readSceneDragData } from '@/lib/scene-drag'
import type { Board } from '@/types/board'
import { isSceneBoardItem } from '@/types/board'
import type { Scene, SceneFolder } from '@/types/scene'
import type { Tag } from '@/types/tag'
import type { SceneDensity } from '@/types/view'
import {
  colorHex,
  formatFolderLabel,
  getMoveTargetSceneIds,
  groupScenes,
  hasCollapsedAncestor,
  ROOT_SCENE_FOLDER_KEY,
} from './scene-bank-utils'

type Props = {
  scenes: Scene[]
  folders: SceneFolder[]
  tags: Tag[]
  board: Board | null
  density: SceneDensity
  selectedSceneId: string | null
  selectedSceneIds: string[]
  onSelect(sceneId: string): void
  onToggleSelection(sceneId: string): void
  onSelectAllVisible(sceneIds: string[]): void
  onClearSelection(): void
  onOpenInspector(sceneId: string): void
  onInlineUpdateScene(sceneId: string, input: { title: string; synopsis: string }): void
  onToggleKeyScene(scene: Scene): void
  onCreateScene(): void
  onCreateFolder(name: string, parentPath?: string | null): void
  onUpdateFolder(currentPath: string, input: { name?: string; color?: SceneFolder['color']; parentPath?: string | null }): void
  onDeleteFolder(currentPath: string): void
  onMoveToFolder(sceneIds: string[], folder: string): void
  onDuplicate(sceneId: string): void
  onDelete(sceneId: string): void
  onDeleteSelected(): void
  onAdd(sceneId: string, afterItemId?: string | null): void
  onSendToOpenOutline?(sceneIds: string[]): void
  embedded?: boolean
  headerAction?: ReactNode
}

export function SceneBankView({
  scenes,
  folders,
  tags,
  board,
  density,
  selectedSceneId,
  selectedSceneIds,
  onSelect,
  onToggleSelection,
  onSelectAllVisible,
  onClearSelection,
  onOpenInspector,
  onInlineUpdateScene,
  onToggleKeyScene,
  onCreateScene,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveToFolder,
  onDuplicate,
  onDelete,
  onDeleteSelected,
  onAdd,
  onSendToOpenOutline,
  embedded = false,
  headerAction,
}: Props) {
  const boardSceneIds = useMemo(
    () => new Set(board?.items.filter(isSceneBoardItem).map((item) => item.sceneId) ?? []),
    [board],
  )
  const selectionAnchorByScopeRef = useRef<Map<string, number>>(new Map())
  const selectedSceneIdSet = useMemo(() => new Set(selectedSceneIds), [selectedSceneIds])
  const [menuState, setMenuState] = useState<{ sceneId: string; x: number; y: number } | null>(null)
  const [folderMenuState, setFolderMenuState] = useState<{ folderPath: string; color: SceneFolder['color']; x: number; y: number } | null>(null)
  const [collapsedFolders, setCollapsedFolders] = usePersistedStringArray('narralab:collapsed:scene-folders')
  const [folderFormOpen, setFolderFormOpen] = useState(false)
  const [folderDraft, setFolderDraft] = useState('')
  const [editingFolderName, setEditingFolderName] = useState<string | null>(null)
  const [editingFolderDraft, setEditingFolderDraft] = useState('')
  const [editingFolderColor, setEditingFolderColor] = useState<SceneFolder['color']>('slate')
  const [dragOverFolderPath, setDragOverFolderPath] = useState<string | null>(null)
  const [draggedFolderPath, setDraggedFolderPath] = useState<string | null>(null)
  const [selectedFolderPaths, setSelectedFolderPaths] = useState<string[]>([])
  const folderSelectionAnchorRef = useRef<number | null>(null)
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  const groupedScenes = useMemo(() => groupScenes(scenes, folders), [scenes, folders])
  const folderPathOrder = useMemo(() => groupedScenes.groups.map((group) => group.folderPath), [groupedScenes.groups])
  const visibleSelectedFolderPaths = useMemo(
    () => selectedFolderPaths.filter((path) => folderPathOrder.includes(path)),
    [folderPathOrder, selectedFolderPaths],
  )

  const menuItems = useMemo<ContextMenuItem[]>(() => {
    if (!menuState) return []
    const scene = scenes.find((entry) => entry.id === menuState.sceneId)
    if (!scene) return []
    const targetSceneIds = getMoveTargetSceneIds(scene.id, selectedSceneIds)
    const targetScenes = scenes.filter((entry) => targetSceneIds.includes(entry.id))
    const hasAnyFolderedTarget = targetScenes.some((entry) => entry.folder.trim().length > 0)
    const multiSelectionActive = targetSceneIds.length > 1

    return [
      { label: 'Open Inspector', onSelect: () => onOpenInspector(scene.id) },
      {
        label: boardSceneIds.has(scene.id) ? 'Already on Outline' : 'Add to Outline',
        onSelect: () => onAdd(scene.id),
        disabled: boardSceneIds.has(scene.id),
      },
      {
        label: multiSelectionActive ? 'Send Selection to Open Outline' : 'Send to Open Outline',
        onSelect: () => onSendToOpenOutline?.(targetSceneIds),
        disabled: !onSendToOpenOutline,
      },
      { label: 'Duplicate Scene', onSelect: () => onDuplicate(scene.id) },
      {
        label: scene.keyRating >= 5 ? 'Reset Key Rating' : 'Increase Key Rating',
        onSelect: () => onToggleKeyScene(scene),
      },
      {
        label:
          targetSceneIds.length > 1
            ? hasAnyFolderedTarget
              ? 'Move Selection to Root'
              : 'Selection Already in Root'
            : scene.folder
              ? 'Move to Root'
              : 'Keep in Root',
        onSelect: () => onMoveToFolder(targetSceneIds, ''),
        disabled: !hasAnyFolderedTarget,
      },
      {
        label: multiSelectionActive ? 'Delete Selection' : 'Delete Scene',
        danger: true,
        onSelect: () => {
          if (multiSelectionActive) {
            if (
              window.confirm(
                `Delete ${targetSceneIds.length} selected scenes? This removes them from every board.`,
              )
            ) {
              onDeleteSelected()
            }
            return
          }

          if (window.confirm(`Delete "${scene.title}"? This removes it from every board.`)) {
            onDelete(scene.id)
          }
        },
      },
    ]
  }, [boardSceneIds, menuState, onAdd, onDelete, onDeleteSelected, onDuplicate, onMoveToFolder, onOpenInspector, onSendToOpenOutline, onToggleKeyScene, scenes, selectedSceneIds])

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
              ? `Delete ${targetFolderPaths.length} selected folders? Scenes will be moved to root.`
              : `Delete folder "${folderMenuState.folderPath}"? Scenes will be moved to root.`
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

  const handleDropToFolder = (event: DragEvent<HTMLDivElement>, folder: string) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOverFolderPath(null)
    if (draggedFolderPath) {
      if (draggedFolderPath !== folder) {
        onUpdateFolder(draggedFolderPath, { parentPath: folder || null })
      }
      setDraggedFolderPath(null)
      return
    }
    const sceneIds = readSceneDragData(event.dataTransfer)
    if (sceneIds.length === 0) return
    onMoveToFolder(sceneIds, folder)
  }

  const handleFolderSelection = (event: MouseEvent<HTMLElement>, folderPath: string) => {
    onClearSelection()
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

  const toolbar = (
    <div className={cn(embedded ? 'border-b border-border/80 pb-3' : 'border-b border-border/90 px-4 py-4')}>
      {!embedded ? (
        <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
              <LayoutGrid className="h-4 w-4 text-accent" />
              <span>Scene Bank</span>
            </div>
            <div className="mt-1 hidden truncate text-sm text-muted xl:block">
              Browse the full scene pool and add candidates to the active outline.
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="shrink-0"
          >
            <Filter className="h-4 w-4" />
            <span className="hidden lg:inline">Filters</span>
            {filtersExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
          {headerAction}
        </div>
      ) : null}
      {!embedded && filtersExpanded ? (
        <div className="mb-3">
          <SceneBankFilters scenes={scenes} tags={tags} expanded={filtersExpanded} />
        </div>
      ) : !embedded ? (
        <div className="mb-3">
          <SceneBankFilters scenes={scenes} tags={tags} expanded={false} />
        </div>
      ) : null}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Button variant="ghost" size="sm" onClick={onCreateScene} title="New Scene" aria-label="New Scene">
          <Plus className="h-4 w-4" />
          <span className="hidden xl:inline">New Scene</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFolderFormOpen((current) => !current)}
          title="New Folder"
          aria-label="New Folder"
        >
          <FolderPlus className="h-4 w-4" />
          <span className="hidden xl:inline">Folder</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelectAllVisible(scenes.map((scene) => scene.id))}
          title="Select All"
          aria-label="Select All"
        >
          <Check className="h-4 w-4" />
          <span className="hidden xl:inline">Select All</span>
        </Button>
        {selectedSceneIds.length > 0 ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (window.confirm(`Delete ${selectedSceneIds.length} selected scenes? This removes them from every board.`)) {
                  onDeleteSelected()
                }
              }}
              title="Delete Selected"
              aria-label="Delete Selected"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden xl:inline">Delete Selected</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onClearSelection} title="Clear Selection" aria-label="Clear Selection">
              <X className="h-4 w-4" />
              <span className="hidden xl:inline">Clear</span>
            </Button>
          </>
        ) : null}
      </div>
      {folderFormOpen ? (
        <div className="mt-3 px-1">
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
                placeholder="New scene folder"
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
    </div>
  )

  const content = (
      <div
        className={cn(
          embedded ? 'min-h-0 flex-1 overflow-y-auto overscroll-contain pt-3' : 'min-h-0 flex-1 overflow-y-auto overscroll-contain p-4',
          density === 'detailed' ? '' : '',
        )}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onClearSelection()
            setSelectedFolderPaths([])
          }
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setDragOverFolderPath(null)
          if (draggedFolderPath) {
            onUpdateFolder(draggedFolderPath, { parentPath: null })
            setDraggedFolderPath(null)
            return
          }
          const sceneIds = readSceneDragData(event.dataTransfer)
          if (sceneIds.length > 0) {
            onMoveToFolder(sceneIds, '')
          }
        }}
      >
        {groupedScenes.groups.length > 0 ? (
          <div className="space-y-1.5">
            {groupedScenes.groups.map((group) => (
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
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDropToFolder(event, group.folderPath)}
              >
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
                    onClearSelection()
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
                    <span className="min-w-4 text-right text-[10px] text-muted/80">{group.scenes.length}</span>
                  </div>
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

                <div className={cn('mt-1.5 space-y-2 pl-5', collapsedFolders.includes(group.folderPath) && 'hidden')}>
                  {group.scenes.map((scene, localIndex) => (
                    <div key={scene.id} className="space-y-2">
                      <SceneBankRow
                        scene={scene}
                        index={localIndex}
                        orderedScenes={group.scenes}
                        selectionScope={`folder:${group.folderPath}`}
                        tags={tags}
                        density={density}
                        selectedSceneId={selectedSceneId}
                        selectedSceneIds={selectedSceneIds}
                        selectedSceneIdSet={selectedSceneIdSet}
                        selectionAnchorByScopeRef={selectionAnchorByScopeRef}
                        boardSceneIds={boardSceneIds}
                        onSelect={onSelect}
                        onToggleSelection={onToggleSelection}
                        onSetSelection={onSelectAllVisible}
                        onOpenInspector={onOpenInspector}
                        onInlineUpdateScene={onInlineUpdateScene}
                        onToggleKeyScene={onToggleKeyScene}
                        onAdd={onAdd}
                        onContextMenu={setMenuState}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {groupedScenes.rootScenes.length > 0 ? (
          <div
            className={cn(
              groupedScenes.groups.length > 0 && 'mt-4',
              'space-y-2 rounded-xl transition',
              dragOverFolderPath === ROOT_SCENE_FOLDER_KEY && 'bg-accent/8 ring-1 ring-accent/35',
            )}
            onDragEnter={() => setDragOverFolderPath(ROOT_SCENE_FOLDER_KEY)}
            onDragLeave={(event) => {
              const nextTarget = event.relatedTarget
              if (nextTarget && event.currentTarget.contains(nextTarget as Node)) return
              setDragOverFolderPath((current) => (current === ROOT_SCENE_FOLDER_KEY ? null : current))
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleDropToFolder(event, '')}
          >
            {groupedScenes.groups.length > 0 ? (
              <div className="px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                Loose Scenes
              </div>
            ) : null}
            {groupedScenes.rootScenes.map((scene, localIndex) => (
              <div key={scene.id} className="space-y-2">
                <SceneBankRow
                  scene={scene}
                  index={localIndex}
                  orderedScenes={groupedScenes.rootScenes}
                  selectionScope="root"
                  tags={tags}
                  density={density}
                  selectedSceneId={selectedSceneId}
                  selectedSceneIds={selectedSceneIds}
                  selectedSceneIdSet={selectedSceneIdSet}
                  selectionAnchorByScopeRef={selectionAnchorByScopeRef}
                  boardSceneIds={boardSceneIds}
                  onSelect={onSelect}
                  onToggleSelection={onToggleSelection}
                  onSetSelection={onSelectAllVisible}
                  onOpenInspector={onOpenInspector}
                  onInlineUpdateScene={onInlineUpdateScene}
                  onToggleKeyScene={onToggleKeyScene}
                  onAdd={onAdd}
                  onContextMenu={setMenuState}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
  )

  const menus = (
    <>
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
    </>
  )

  const wrappedContent = content

  if (embedded) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {toolbar}
        {wrappedContent}
        {menus}
      </div>
    )
  }

  return (
    <Panel className="flex h-full flex-col overflow-hidden">
      {toolbar}
      {wrappedContent}
      {menus}
    </Panel>
  )
}
