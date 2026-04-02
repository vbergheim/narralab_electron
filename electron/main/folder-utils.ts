import type { SceneColor, SceneFolder } from '@/types/scene'

type FolderLike = {
  path: string
  name: string
  parentPath: string | null
  color: SceneColor
  sortOrder: number
}

export function parseStoredFolders<T extends FolderLike>(value?: string | null): T[] {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return normalizeStoredFolders(
      parsed
        .filter((entry): entry is { name?: unknown; color?: unknown; sortOrder?: unknown } => typeof entry === 'object' && entry !== null)
        .map((entry) => ({
          path:
            'path' in entry && typeof entry.path === 'string'
              ? entry.path.trim()
              : typeof entry.name === 'string'
                ? entry.name.trim()
                : '',
          name: typeof entry.name === 'string' ? entry.name.trim() : '',
          parentPath:
            'parentPath' in entry && typeof entry.parentPath === 'string' && entry.parentPath.trim().length > 0
              ? entry.parentPath.trim()
              : null,
          color: isSceneColor(entry.color) ? entry.color : 'slate',
          sortOrder: typeof entry.sortOrder === 'number' ? entry.sortOrder : 0,
        }))
        .filter((entry) => entry.path.length > 0 || entry.name.length > 0) as T[],
    )
  } catch {
    return []
  }
}

export function normalizeStoredFolders<T extends FolderLike>(folders: T[]): T[] {
  const deduped: T[] = []

  folders
    .map((folder, index) => {
      const path = normalizeFolderPath(folder.path || folder.name)
      if (!path) return null
      return {
        ...folder,
        path,
        name: getFolderNameFromPath(path),
        parentPath: getParentFolderPath(path),
        color: folder.color ?? 'slate',
        sortOrder: typeof folder.sortOrder === 'number' ? folder.sortOrder : index,
      } satisfies FolderLike
    })
    .filter((folder): folder is T => Boolean(folder))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.path.localeCompare(right.path))
    .forEach((folder) => {
      if (!deduped.some((entry) => entry.path.toLowerCase() === folder.path.toLowerCase())) {
        deduped.push({ ...folder, sortOrder: deduped.length })
      }
    })

  return deduped
}

export function makeFolderRecord<T extends FolderLike>(path: string, color: SceneColor, sortOrder: number): T {
  const normalizedPath = normalizeFolderPath(path)
  if (!normalizedPath) {
    throw new Error('Folder path cannot be empty')
  }

  return {
    path: normalizedPath,
    name: getFolderNameFromPath(normalizedPath),
    parentPath: getParentFolderPath(normalizedPath),
    color,
    sortOrder,
  } as T
}

export function normalizeFolderPath(value?: string | null) {
  if (!value) return ''
  return value
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/')
}

export function normalizeNullableFolderPath(value?: string | null) {
  const normalized = normalizeFolderPath(value)
  return normalized || null
}

export function buildFolderPath(name: string, parentPath?: string | null) {
  const normalizedName = normalizeFolderPath(name)
  const normalizedParentPath = normalizeFolderPath(parentPath)
  return normalizedParentPath ? `${normalizedParentPath}/${normalizedName}` : normalizedName
}

export function getFolderNameFromPath(path: string) {
  const normalizedPath = normalizeFolderPath(path)
  if (!normalizedPath) return ''
  const segments = normalizedPath.split('/')
  return segments[segments.length - 1] ?? ''
}

export function getParentFolderPath(path: string) {
  const normalizedPath = normalizeFolderPath(path)
  if (!normalizedPath || !normalizedPath.includes('/')) return null
  return normalizedPath.split('/').slice(0, -1).join('/') || null
}

export function isFolderWithinPath(path: string | null | undefined, basePath: string) {
  const normalizedPath = normalizeFolderPath(path)
  const normalizedBasePath = normalizeFolderPath(basePath)
  if (!normalizedPath || !normalizedBasePath) return false
  return (
    normalizedPath.toLowerCase() === normalizedBasePath.toLowerCase() ||
    normalizedPath.toLowerCase().startsWith(`${normalizedBasePath.toLowerCase()}/`)
  )
}

export function replaceFolderPathPrefix(path: string, fromPath: string, toPath: string) {
  const normalizedPath = normalizeFolderPath(path)
  const normalizedFromPath = normalizeFolderPath(fromPath)
  const normalizedToPath = normalizeFolderPath(toPath)

  if (!normalizedFromPath) return normalizedPath
  if (normalizedPath.toLowerCase() === normalizedFromPath.toLowerCase()) {
    return normalizedToPath
  }

  const suffix = normalizedPath.slice(normalizedFromPath.length)
  return normalizeFolderPath(`${normalizedToPath}${suffix}`)
}

function isSceneColor(value: unknown): value is SceneFolder['color'] {
  return typeof value === 'string' && [
    'charcoal',
    'slate',
    'amber',
    'ochre',
    'crimson',
    'rose',
    'olive',
    'moss',
    'teal',
    'cyan',
    'blue',
    'indigo',
    'violet',
    'plum',
  ].includes(value)
}
