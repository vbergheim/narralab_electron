import type { DragEvent, MouseEvent, MutableRefObject, ReactNode } from 'react'
import { useMemo, useRef, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  GripVertical,
  Plus,
  Trash2,
  X,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { Panel } from '@/components/ui/panel'
import { SceneCard } from '@/components/cards/scene-card'
import { Button } from '@/components/ui/button'
import { ContextMenu, type ContextMenuItem } from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { KeyRatingButton } from '@/components/ui/key-rating-button'
import { usePersistedStringArray } from '@/hooks/use-persisted-string-array'
import { sceneColors } from '@/lib/constants'
import type { Board } from '@/types/board'
import { isSceneBoardItem } from '@/types/board'
import type { Scene, SceneFolder } from '@/types/scene'
import type { Tag } from '@/types/tag'
import type { SceneDensity } from '@/types/view'

type Props = {
  scenes: Scene[]
  allScenes: Scene[]
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
  onToggleKeyScene(scene: Scene): void
  onCreateScene(): void
  onCreateFolder(name: string, parentPath?: string | null): void
  onUpdateFolder(currentPath: string, input: { name?: string; color?: SceneFolder['color']; parentPath?: string | null }): void
  onDeleteFolder(currentPath: string): void
  onMoveToFolder(sceneIds: string[], folder: string): void
  onReorderScenes(sceneIds: string[]): void
  onDuplicate(sceneId: string): void
  onDelete(sceneId: string): void
  onDeleteSelected(): void
  onAdd(sceneId: string, afterItemId?: string | null): void
}

export function SceneBankView({
  scenes,
  allScenes,
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
  onToggleKeyScene,
  onCreateScene,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveToFolder,
  onReorderScenes,
  onDuplicate,
  onDelete,
  onDeleteSelected,
  onAdd,
}: Props) {
  const boardSceneIds = useMemo(
    () => new Set(board?.items.filter(isSceneBoardItem).map((item) => item.sceneId) ?? []),
    [board],
  )
  const selectionAnchorRef = useRef<number | null>(null)
  const selectedSceneIdSet = useMemo(() => new Set(selectedSceneIds), [selectedSceneIds])
  const sceneIndexById = useMemo(() => new Map(scenes.map((scene, index) => [scene.id, index])), [scenes])
  const [menuState, setMenuState] = useState<{ sceneId: string; x: number; y: number } | null>(null)
  const [folderMenuState, setFolderMenuState] = useState<{ folderPath: string; color: SceneFolder['color']; x: number; y: number } | null>(null)
  const [collapsedFolders, setCollapsedFolders] = usePersistedStringArray('docudoc:collapsed:scene-folders')
  const [folderFormOpen, setFolderFormOpen] = useState(false)
  const [folderDraft, setFolderDraft] = useState('')
  const [editingFolderName, setEditingFolderName] = useState<string | null>(null)
  const [editingFolderDraft, setEditingFolderDraft] = useState('')
  const [editingFolderColor, setEditingFolderColor] = useState<SceneFolder['color']>('slate')
  const [dragOverFolderPath, setDragOverFolderPath] = useState<string | null>(null)
  const [draggedFolderPath, setDraggedFolderPath] = useState<string | null>(null)

  const groupedScenes = useMemo(() => groupScenes(scenes, folders), [scenes, folders])

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
  }, [boardSceneIds, menuState, onAdd, onDelete, onDeleteSelected, onDuplicate, onMoveToFolder, onOpenInspector, onToggleKeyScene, scenes, selectedSceneIds])

  const folderMenuItems = useMemo<ContextMenuItem[]>(() => {
    if (!folderMenuState) return []

    return [
      {
        label: 'Rename Folder',
        onSelect: () => {
          setEditingFolderName(folderMenuState.folderPath)
          setEditingFolderDraft(folderMenuState.folderPath.split('/').at(-1) ?? folderMenuState.folderPath)
          setEditingFolderColor(folderMenuState.color)
        },
      },
      {
        label: 'Delete Folder',
        danger: true,
        onSelect: () => {
          if (window.confirm(`Delete folder "${folderMenuState.folderPath}"? Scenes will be moved to root.`)) {
            onDeleteFolder(folderMenuState.folderPath)
          }
        },
      },
    ]
  }, [folderMenuState, onDeleteFolder])

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
    setDragOverFolderPath(null)
    if (draggedFolderPath) {
      if (draggedFolderPath !== folder) {
        onUpdateFolder(draggedFolderPath, { parentPath: folder || null })
      }
      setDraggedFolderPath(null)
      return
    }
    const sceneIds = getDraggedSceneIds(event.dataTransfer)
    if (sceneIds.length === 0) return
    onMoveToFolder(sceneIds, folder)
  }

  return (
    <Panel className="h-full overflow-hidden">
      <div className="border-b border-border/90 px-4 py-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
              Scene Bank
            </div>
            <div className="mt-1 hidden truncate text-sm text-muted xl:block">
              Browse the full scene pool and add candidates to the active outline.
            </div>
          </div>
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
        </div>
        {folderFormOpen ? (
          <div className="mt-3 flex items-center gap-2">
            <Input
              value={folderDraft}
              onChange={(event) => setFolderDraft(event.target.value)}
              placeholder="New scene folder"
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
      </div>
      <div
        className={cn(
          'h-[calc(100%-72px)] overflow-y-auto p-4',
          density === 'detailed' ? '' : '',
        )}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          setDragOverFolderPath(null)
          if (draggedFolderPath) {
            onUpdateFolder(draggedFolderPath, { parentPath: null })
            setDraggedFolderPath(null)
            return
          }
          const sceneIds = getDraggedSceneIds(event.dataTransfer)
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
                >
                  <div className="flex min-w-0 flex-1 items-center gap-1.5">
                    <button
                      type="button"
                      className="flex shrink-0 items-center rounded-md px-1 py-0.5 transition hover:bg-panelMuted hover:text-foreground"
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setFolderMenuState({ folderPath: group.folderPath, color: group.color, x: event.clientX, y: event.clientY })
                      }}
                      onClick={() =>
                        setCollapsedFolders((current) =>
                          current.includes(group.folderPath)
                            ? current.filter((entry) => entry !== group.folderPath)
                            : [...current, group.folderPath],
                        )
                      }
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
                    onContextMenu={(event) => {
                      event.preventDefault()
                      setFolderMenuState({ folderPath: group.folderPath, color: group.color, x: event.clientX, y: event.clientY })
                    }}
                    onClick={() =>
                      setCollapsedFolders((current) =>
                        current.includes(group.folderPath)
                          ? current.filter((entry) => entry !== group.folderPath)
                          : [...current, group.folderPath],
                      )
                    }
                    onDoubleClick={(event) => {
                      event.preventDefault()
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
                  <div className="space-y-2 px-6 pb-1 pt-1">
                    <div className="flex items-center gap-1.5">
                      <Input
                        autoFocus
                        value={editingFolderDraft}
                        onChange={(event) => setEditingFolderDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            submitFolderEdit()
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            setEditingFolderName(null)
                            setEditingFolderDraft('')
                          }
                        }}
                        className="h-7 min-w-[120px] rounded-lg px-2 text-xs"
                      />
                      <button
                        type="button"
                        className="rounded-md p-1 transition hover:bg-panelMuted hover:text-foreground"
                        onClick={submitFolderEdit}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-md p-1 transition hover:bg-panelMuted hover:text-foreground"
                        onClick={() => {
                          setEditingFolderName(null)
                          setEditingFolderDraft('')
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
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
                  </div>
                ) : null}

                <div className={cn('mt-1.5 space-y-2 pl-5', collapsedFolders.includes(group.folderPath) && 'hidden')}>
                  {group.scenes.map((scene) => (
                    <SceneBankRow
                      key={scene.id}
                      scene={scene}
                      index={sceneIndexById.get(scene.id) ?? 0}
                      scenes={scenes}
                      tags={tags}
                      density={density}
                      selectedSceneId={selectedSceneId}
                      selectedSceneIds={selectedSceneIds}
                      selectedSceneIdSet={selectedSceneIdSet}
                      selectionAnchorRef={selectionAnchorRef}
                      boardSceneIds={boardSceneIds}
                      onSelect={onSelect}
                      onToggleSelection={onToggleSelection}
                      onSetSelection={onSelectAllVisible}
                      onOpenInspector={onOpenInspector}
                      onToggleKeyScene={onToggleKeyScene}
                      onAdd={onAdd}
                      onContextMenu={setMenuState}
                      onDropOnScene={(draggedSceneIds, targetSceneId) => {
                        const targetScene = allScenes.find((entry) => entry.id === targetSceneId)
                        if (!targetScene) return
                        const nextSceneIds = getReorderedSceneIds(allScenes, draggedSceneIds, targetSceneId)
                        const needsFolderMove = draggedSceneIds.some((sceneId) => {
                          const dragged = allScenes.find((entry) => entry.id === sceneId)
                          return dragged?.folder !== targetScene.folder
                        })
                        if (needsFolderMove) {
                          onMoveToFolder(draggedSceneIds, targetScene.folder)
                        }
                        onReorderScenes(nextSceneIds)
                      }}
                    />
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
            {groupedScenes.rootScenes.map((scene) => (
              <SceneBankRow
                key={scene.id}
                scene={scene}
                index={sceneIndexById.get(scene.id) ?? 0}
                scenes={scenes}
                tags={tags}
                density={density}
                selectedSceneId={selectedSceneId}
                selectedSceneIds={selectedSceneIds}
                selectedSceneIdSet={selectedSceneIdSet}
                selectionAnchorRef={selectionAnchorRef}
                boardSceneIds={boardSceneIds}
                onSelect={onSelect}
                onToggleSelection={onToggleSelection}
                onSetSelection={onSelectAllVisible}
                onOpenInspector={onOpenInspector}
                onToggleKeyScene={onToggleKeyScene}
                onAdd={onAdd}
                onContextMenu={setMenuState}
                onDropOnScene={(draggedSceneIds, targetSceneId) => {
                  const nextSceneIds = getReorderedSceneIds(allScenes, draggedSceneIds, targetSceneId)
                  const needsFolderMove = draggedSceneIds.some((sceneId) => {
                    const dragged = allScenes.find((entry) => entry.id === sceneId)
                    return Boolean(dragged?.folder)
                  })
                  if (needsFolderMove) {
                    onMoveToFolder(draggedSceneIds, '')
                  }
                  onReorderScenes(nextSceneIds)
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
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
    </Panel>
  )
}

function SceneBankRow({
  scene,
  index,
  scenes,
  tags,
  density,
  selectedSceneId,
  selectedSceneIds,
  selectedSceneIdSet,
  selectionAnchorRef,
  boardSceneIds,
  onSelect,
  onToggleSelection,
  onSetSelection,
  onOpenInspector,
  onToggleKeyScene,
  onAdd,
  onContextMenu,
  onDropOnScene,
}: {
  scene: Scene
  index: number
  scenes: Scene[]
  tags: Tag[]
  density: SceneDensity
  selectedSceneId: string | null
  selectedSceneIds: string[]
  selectedSceneIdSet: Set<string>
  selectionAnchorRef: MutableRefObject<number | null>
  boardSceneIds: Set<string>
  onSelect(sceneId: string): void
  onToggleSelection(sceneId: string): void
  onSetSelection(sceneIds: string[]): void
  onOpenInspector(sceneId: string): void
  onToggleKeyScene(scene: Scene): void
  onAdd(sceneId: string, afterItemId?: string | null): void
  onContextMenu(state: { sceneId: string; x: number; y: number } | null): void
  onDropOnScene(draggedSceneIds: string[], targetSceneId: string): void
}) {
  const isOnBoard = boardSceneIds.has(scene.id)
  return (
    <div
      draggable
      onDragStart={(event) => {
        const draggedSceneIds =
          selectedSceneIdSet.has(scene.id) && selectedSceneIds.length > 1 ? selectedSceneIds : [scene.id]
        event.dataTransfer.setData(SCENE_DRAG_IDS_MIME, JSON.stringify(draggedSceneIds))
        event.dataTransfer.setData(SCENE_DRAG_ID_MIME, scene.id)
        event.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const draggedSceneIds = getDraggedSceneIds(event.dataTransfer)
        if (draggedSceneIds.length === 0 || draggedSceneIds.includes(scene.id)) return
        onDropOnScene(draggedSceneIds, scene.id)
      }}
      className={cn(
        'relative rounded-2xl px-2 py-2 transition',
        selectedSceneIdSet.has(scene.id) && 'bg-accent/8 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]',
      )}
      role="button"
      tabIndex={0}
      onClick={(event) =>
        handleSelectionGesture({
          event,
          index,
          sceneId: scene.id,
          scenes,
          selectedSceneIds,
          selectionAnchorRef,
          onSelect,
          onToggleSelection,
          onSetSelection,
        })
      }
      onDoubleClick={() => onOpenInspector(scene.id)}
      onContextMenu={(event) => {
        event.preventDefault()
        handleSelectionGesture({
          event,
          index,
          sceneId: scene.id,
          scenes,
          selectedSceneIds,
          selectionAnchorRef,
          onSelect,
          onToggleSelection,
          onSetSelection,
        })
        onContextMenu({ sceneId: scene.id, x: event.clientX, y: event.clientY })
      }}
    >
      {selectedSceneIdSet.has(scene.id) ? (
        <div className="absolute inset-y-2 left-0 w-1 rounded-full bg-accent/70" />
      ) : null}
      <SceneCard
        scene={scene}
        tags={tags.filter((tag) => scene.tagIds.includes(tag.id))}
        density={density}
        selected={selectedSceneIdSet.has(scene.id) || selectedSceneId === scene.id}
        draggable
        actions={
          <>
            <span
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted/80 transition group-hover:text-foreground"
              aria-hidden="true"
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4" />
            </span>
            <KeyRatingButton value={scene.keyRating} onChange={() => onToggleKeyScene(scene)} />
            {density !== 'detailed' && !isOnBoard ? (
              <InlineActionButton label="Add to outline" onClick={() => onAdd(scene.id)}>
                <Plus className="h-4 w-4" />
              </InlineActionButton>
            ) : null}
          </>
        }
      />
      {density === 'detailed' ? (
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              onAdd(scene.id)
            }}
            disabled={isOnBoard}
          >
            {isOnBoard ? 'Already on board' : 'Add to board'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function InlineActionButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick(): void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-muted transition hover:border-border hover:bg-panelMuted hover:text-foreground"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      {children}
    </button>
  )
}

function handleSelectionGesture({
  event,
  index,
  sceneId,
  scenes,
  selectedSceneIds,
  selectionAnchorRef,
  onSelect,
  onToggleSelection,
  onSetSelection,
}: {
  event?: MouseEvent<HTMLElement>
  index: number
  sceneId: string
  scenes: Scene[]
  selectedSceneIds: string[]
  selectionAnchorRef: MutableRefObject<number | null>
  onSelect(sceneId: string): void
  onToggleSelection(sceneId: string): void
  onSetSelection(sceneIds: string[]): void
}) {
  const isRangeSelection = Boolean(event?.shiftKey) && selectionAnchorRef.current !== null
  const isToggleSelection = Boolean(event?.metaKey || event?.ctrlKey)

  if (isRangeSelection) {
    const start = Math.min(selectionAnchorRef.current ?? index, index)
    const end = Math.max(selectionAnchorRef.current ?? index, index)
    onSetSelection(scenes.slice(start, end + 1).map((scene) => scene.id))
    return
  }

  selectionAnchorRef.current = index

  if (isToggleSelection) {
    onToggleSelection(sceneId)
    return
  }

  if (selectedSceneIds.length > 1 || !selectedSceneIds.includes(sceneId)) {
    onSelect(sceneId)
    return
  }

  onToggleSelection(sceneId)
}

function groupScenes(scenes: Scene[], folders: SceneFolder[]) {
  const groups = new Map<string, { folderPath: string; label: string; color: SceneFolder['color']; scenes: Scene[]; depth: number }>()
  const order = [...folders].sort((left, right) => left.sortOrder - right.sortOrder || left.path.localeCompare(right.path)).map((folder) => folder.path)

  order.forEach((folderPath) => {
    const existing = folders.find((folder) => folder.path === folderPath)
    groups.set(folderPath, {
      folderPath,
      label: existing?.name ?? folderPath.split('/').at(-1) ?? folderPath,
      color: existing?.color ?? 'slate',
      scenes: [],
      depth: folderPath.split('/').length - 1,
    })
  })

  const rootScenes: Scene[] = []

  scenes.forEach((scene) => {
    const folderPath = scene.folder.trim()
    if (!folderPath) {
      rootScenes.push(scene)
      return
    }

    if (!groups.has(folderPath)) {
      groups.set(folderPath, {
        folderPath,
        label: folderPath.split('/').at(-1) ?? folderPath,
        color: 'slate',
        scenes: [],
        depth: folderPath.split('/').length - 1,
      })
      order.push(folderPath)
    }

    groups.get(folderPath)?.scenes.push(scene)
  })

  return {
    rootScenes,
    groups: order.map((folderPath) => groups.get(folderPath)!).filter(Boolean),
  }
}

function hasCollapsedAncestor(path: string, collapsedFolders: string[]) {
  return collapsedFolders.some((collapsedPath) => path !== collapsedPath && path.startsWith(`${collapsedPath}/`))
}

function colorHex(color: SceneFolder['color']) {
  return sceneColors.find((entry) => entry.value === color)?.hex ?? '#607086'
}

function formatFolderLabel(label: string) {
  return label.toLocaleUpperCase('nb-NO')
}

function getDraggedSceneIds(dataTransfer: DataTransfer) {
  const rawIds = dataTransfer.getData(SCENE_DRAG_IDS_MIME)
  if (rawIds) {
    try {
      const parsed = JSON.parse(rawIds)
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      }
    } catch {
      // Fallback to single-scene payload below.
    }
  }

  const singleId = dataTransfer.getData(SCENE_DRAG_ID_MIME)
  return singleId ? [singleId] : []
}

function getMoveTargetSceneIds(sceneId: string, selectedSceneIds: string[]) {
  return selectedSceneIds.includes(sceneId) && selectedSceneIds.length > 1 ? selectedSceneIds : [sceneId]
}

function getReorderedSceneIds(allScenes: Scene[], draggedSceneIds: string[], targetSceneId: string) {
  const draggedSet = new Set(draggedSceneIds)
  const dragged = allScenes.filter((scene) => draggedSet.has(scene.id))
  const remaining = allScenes.filter((scene) => !draggedSet.has(scene.id))
  const insertAt = remaining.findIndex((scene) => scene.id === targetSceneId)

  if (insertAt < 0) {
    return allScenes.map((scene) => scene.id)
  }

  return [
    ...remaining.slice(0, insertAt).map((scene) => scene.id),
    ...dragged.map((scene) => scene.id),
    ...remaining.slice(insertAt).map((scene) => scene.id),
  ]
}

const SCENE_DRAG_IDS_MIME = 'application/x-docudoc-scenes'
const SCENE_DRAG_ID_MIME = 'application/x-docudoc-scene'
const ROOT_SCENE_FOLDER_KEY = '__root__'
