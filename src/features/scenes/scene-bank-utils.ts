import { sceneColors } from '@/lib/constants'
import type { Scene, SceneFolder } from '@/types/scene'

export type SceneGroup = {
  folderPath: string
  label: string
  color: SceneFolder['color']
  scenes: Scene[]
  depth: number
  parentPath: string | null
  sortOrder: number
}

export const ROOT_SCENE_FOLDER_KEY = '__root__'

export function groupScenes(scenes: Scene[], folders: SceneFolder[]) {
  const groups = new Map<string, SceneGroup>()
  const rootScenes: Scene[] = []

  folders.forEach((folder) => {
    groups.set(folder.path, {
      folderPath: folder.path,
      label: folder.name,
      color: folder.color,
      scenes: [],
      depth: folder.path.split('/').length - 1,
      parentPath: folder.parentPath,
      sortOrder: folder.sortOrder,
    })
  })

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
        parentPath: getParentFolderPath(folderPath),
        sortOrder: Number.MAX_SAFE_INTEGER,
      })
    }

    groups.get(folderPath)?.scenes.push(scene)
  })

  const knownPaths = new Set(groups.keys())
  const childrenByParent = new Map<string | null, SceneGroup[]>()

  Array.from(groups.values()).forEach((group) => {
    const parentPath = group.parentPath && knownPaths.has(group.parentPath) ? group.parentPath : null
    const siblings = childrenByParent.get(parentPath) ?? []
    siblings.push(group)
    childrenByParent.set(parentPath, siblings)
  })

  childrenByParent.forEach((siblings) => {
    siblings.sort((left, right) => left.sortOrder - right.sortOrder || left.label.localeCompare(right.label))
  })

  const orderedGroups: SceneGroup[] = []
  const visit = (parentPath: string | null) => {
    const children = childrenByParent.get(parentPath) ?? []
    children.forEach((child) => {
      orderedGroups.push(child)
      visit(child.folderPath)
    })
  }

  visit(null)

  return {
    rootScenes,
    groups: orderedGroups,
  }
}

export function hasCollapsedAncestor(path: string, collapsedFolders: string[]) {
  return collapsedFolders.some((collapsedPath) => path !== collapsedPath && path.startsWith(`${collapsedPath}/`))
}

export function colorHex(color: SceneFolder['color']) {
  return sceneColors.find((entry) => entry.value === color)?.hex ?? '#607086'
}

export function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized
        .split('')
        .map((char) => `${char}${char}`)
        .join('')
    : normalized

  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function formatFolderLabel(label: string) {
  return label.toLocaleUpperCase('nb-NO')
}

export function getParentFolderPath(path: string) {
  const segments = path.split('/').filter(Boolean)
  if (segments.length <= 1) {
    return null
  }

  return segments.slice(0, -1).join('/')
}

export function getMoveTargetSceneIds(sceneId: string, selectedSceneIds: string[]) {
  return selectedSceneIds.includes(sceneId) && selectedSceneIds.length > 1 ? selectedSceneIds : [sceneId]
}
